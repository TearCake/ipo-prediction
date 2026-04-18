from __future__ import annotations

import os
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from math import log1p
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

MODEL_FILENAME = "model.pkl"
DB_FILENAME = "predictions.db"
PAGE_SIZE = 10
FEATURE_NAMES = [
    "QIB",
    "HNI",
    "RII",
    "Total",
    "Issue_Size",
    "Offer_Price",
    "QIB_to_RII",
    "Total_to_Size",
]
MODEL_METRICS = [
    {"model": "CatBoost", "mae": 13.24, "r2": 0.51},
    {"model": "Random Forest", "mae": 13.49, "r2": 0.50},
    {"model": "Gradient Boosting", "mae": 14.32, "r2": 0.49},
]


class PredictRequest(BaseModel):
    IPO_Name: str | None = None
    QIB: float = Field(..., ge=0)
    HNI: float = Field(..., ge=0)
    RII: float = Field(..., ge=0)
    Issue_Size: float = Field(..., ge=0)
    Offer_Price: float | None = Field(default=None, ge=0)


class PredictResponse(BaseModel):
    predicted_gain_percent: float
    category: str
    predicted_listing_price: float | None
    explanation: str


def classify_gain(predicted_gain_percent: float) -> str:
    if predicted_gain_percent < 0:
        return "Loss"
    if predicted_gain_percent <= 10:
        return "Flat"
    if predicted_gain_percent <= 25:
        return "Moderate Gain"
    return "High Gain"


def build_explanation(qib: float, total: float, category: str, gain_percent: float) -> str:
    demand_signal = "strong" if (qib >= 20 and total >= 30) else "weak"

    if demand_signal == "strong":
        return "Strong institutional demand indicates higher listing potential."

    return "Weak subscription demand suggests limited listing gain."


def parse_origins() -> list[str]:
    configured = os.getenv("CORS_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
        "http://[::1]:3000",
        "https://your-frontend-domain",
    ]


def build_feature_vector(payload: PredictRequest) -> list[float]:
    qib_log = log1p(payload.QIB)
    hni_log = log1p(payload.HNI)
    rii_log = log1p(payload.RII)

    total_raw = payload.QIB + payload.HNI + payload.RII
    total_log = log1p(total_raw)
    issue_size_log = log1p(payload.Issue_Size)

    qib_to_rii = qib_log / (rii_log + 1)
    total_to_size = total_log / (issue_size_log + 1)
    offer_price = payload.Offer_Price if payload.Offer_Price is not None else 0.0

    return [
        qib_log,
        hni_log,
        rii_log,
        total_log,
        issue_size_log,
        offer_price,
        qib_to_rii,
        total_to_size,
    ]


def select_model_input_vector(model: Any, full_feature_vector: list[float]) -> np.ndarray:
    expected = getattr(model, "n_features_in_", None)
    if expected is None or expected <= 0:
        return np.array([full_feature_vector], dtype=float)

    if expected == len(full_feature_vector):
        return np.array([full_feature_vector], dtype=float)

    raise ValueError(
        f"Model expects {expected} features, but inference pipeline produced {len(full_feature_vector)}."
    )


def build_feature_importance(model: Any) -> list[dict[str, float | str]]:
    raw_scores: list[float] = []
    if hasattr(model, "feature_importances_"):
        raw_scores = [float(value) for value in model.feature_importances_]
    elif hasattr(model, "coef_"):
        coef_array = np.array(model.coef_).flatten()
        raw_scores = [abs(float(value)) for value in coef_array]

    if not raw_scores:
        return []

    names = FEATURE_NAMES[: len(raw_scores)]
    if len(names) < len(raw_scores):
        names.extend([f"feature_{index + 1}" for index in range(len(names), len(raw_scores))])

    pairs = [
        {"feature": names[index], "importance": float(raw_scores[index])}
        for index in range(len(raw_scores))
    ]
    pairs.sort(key=lambda item: float(item["importance"]), reverse=True)
    return pairs


def build_scatter_payload(history: list[dict[str, Any]]) -> dict[str, Any]:
    points = []
    for item in history[:40]:
        x_value = float(item.get("qib", 0)) + float(item.get("hni", 0)) + float(item.get("rii", 0))
        y_value = float(item.get("predicted_gain", 0))
        points.append(
            {
                "x": x_value,
                "y": y_value,
                "label": str(item.get("ipo_name", "IPO")),
            }
        )

    correlation: float | None = None
    if len(points) >= 2:
        x_vals = np.array([p["x"] for p in points], dtype=float)
        y_vals = np.array([p["y"] for p in points], dtype=float)
        if np.std(x_vals) > 0 and np.std(y_vals) > 0:
            correlation = float(np.corrcoef(x_vals, y_vals)[0, 1])

    return {
        "points": points,
        "x_label": "Subscription Multiplier (x)",
        "y_label": "Listing Gain (%)",
        "correlation": correlation,
    }


def build_summary_payload(history: list[dict[str, Any]]) -> dict[str, float | None]:
    if not history:
        return {"sentiment_score": None, "success_rate": None}

    gains = np.array([float(item.get("predicted_gain", 0)) for item in history], dtype=float)
    positive_ratio = float(np.mean(gains > 0))
    success_rate = positive_ratio * 100.0

    # Map average gain to a readable 0-100 sentiment scale.
    avg_gain = float(np.mean(gains))
    sentiment_score = float(np.clip((avg_gain + 50.0), 0.0, 100.0))

    return {
        "sentiment_score": sentiment_score,
        "success_rate": success_rate,
    }


def get_db_connection(db_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def init_db(db_path: Path) -> None:
    with get_db_connection(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS prediction_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ipo_name TEXT NOT NULL,
                qib REAL NOT NULL,
                hni REAL NOT NULL,
                rii REAL NOT NULL,
                issue_size REAL NOT NULL,
                predicted_gain REAL NOT NULL,
                category TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
            """
        )
        connection.commit()


def row_to_history_item(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "ipo_name": str(row["ipo_name"]),
        "qib": float(row["qib"]),
        "hni": float(row["hni"]),
        "rii": float(row["rii"]),
        "issue_size": float(row["issue_size"]),
        "predicted_gain": float(row["predicted_gain"]),
        "category": str(row["category"]),
        "timestamp": str(row["timestamp"]),
    }


def insert_prediction_record(
    db_path: Path,
    *,
    ipo_name: str,
    qib: float,
    hni: float,
    rii: float,
    issue_size: float,
    predicted_gain: float,
    category: str,
    timestamp: str,
) -> None:
    with get_db_connection(db_path) as connection:
        connection.execute(
            """
            INSERT INTO prediction_history (
                ipo_name, qib, hni, rii, issue_size, predicted_gain, category, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (ipo_name, qib, hni, rii, issue_size, predicted_gain, category, timestamp),
        )
        connection.commit()


def fetch_dashboard_summary(db_path: Path) -> dict[str, Any]:
    with get_db_connection(db_path) as connection:
        summary = connection.execute(
            "SELECT COUNT(*) AS total_predictions, AVG(predicted_gain) AS avg_gain FROM prediction_history"
        ).fetchone()
        latest = connection.execute(
            "SELECT predicted_gain, category FROM prediction_history ORDER BY id DESC LIMIT 1"
        ).fetchone()

    total_predictions = int(summary["total_predictions"]) if summary else 0
    avg_gain = float(summary["avg_gain"]) if summary and summary["avg_gain"] is not None else 0.0

    recent_prediction = {"gain": 0.0, "category": "No data"}
    if latest is not None:
        recent_prediction = {
            "gain": float(latest["predicted_gain"]),
            "category": str(latest["category"]),
        }

    return {
        "total_predictions": total_predictions,
        "avg_gain": avg_gain,
        "recent_prediction": recent_prediction,
    }


def fetch_history_records(db_path: Path, page: int, query: str = "") -> tuple[list[dict[str, Any]], int]:
    where_clause = ""
    params: list[Any] = []
    if query:
        where_clause = "WHERE LOWER(ipo_name) LIKE ?"
        params.append(f"%{query.lower()}%")

    offset = (page - 1) * PAGE_SIZE
    with get_db_connection(db_path) as connection:
        count_row = connection.execute(
            f"SELECT COUNT(*) AS total FROM prediction_history {where_clause}", params
        ).fetchone()

        items_rows = connection.execute(
            f"""
            SELECT ipo_name, qib, hni, rii, issue_size, predicted_gain, category, timestamp
            FROM prediction_history
            {where_clause}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
            """,
            [*params, PAGE_SIZE, offset],
        ).fetchall()

    total = int(count_row["total"]) if count_row else 0
    items = [row_to_history_item(row) for row in items_rows]
    return items, total


def fetch_recent_history(db_path: Path, limit: int) -> list[dict[str, Any]]:
    with get_db_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT ipo_name, qib, hni, rii, issue_size, predicted_gain, category, timestamp
            FROM prediction_history
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [row_to_history_item(row) for row in rows]


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_path = Path(__file__).resolve().parent / MODEL_FILENAME
    db_path = Path(__file__).resolve().parent / DB_FILENAME
    if not model_path.exists():
        raise RuntimeError(f"Model file not found at {model_path}")

    app.state.model = joblib.load(model_path)
    app.state.db_path = db_path
    init_db(db_path)
    yield


app = FastAPI(title="IPO Predictor API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    messages: list[str] = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error.get("loc", []) if part != "body")
        msg = error.get("msg", "Invalid value")
        if location:
            messages.append(f"{location}: {msg}")
        else:
            messages.append(msg)

    message = "; ".join(messages) if messages else "Validation failed"
    return JSONResponse(status_code=422, content={"error": message})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/dashboard")
async def dashboard() -> dict[str, Any]:
    summary = fetch_dashboard_summary(app.state.db_path)

    return {
        "total_predictions": summary["total_predictions"],
        "avg_gain": summary["avg_gain"],
        "best_model": "CatBoost",
        "recent_prediction": summary["recent_prediction"],
    }


@app.get("/insights")
async def insights() -> dict[str, Any]:
    history_data = fetch_recent_history(app.state.db_path, limit=40)
    return {
        "feature_importance": build_feature_importance(app.state.model),
        "model_metrics": MODEL_METRICS,
        "scatter": build_scatter_payload(history_data),
        "summary": build_summary_payload(history_data),
    }


@app.get("/history")
async def history(page: int = Query(1, ge=1), q: str = Query(default="")) -> dict[str, Any]:
    query = q.strip()
    items, total = fetch_history_records(app.state.db_path, page=page, query=query)

    return {
        "items": items,
        "total": total,
        "page": page,
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(payload: PredictRequest) -> PredictResponse:
    computed_total = payload.QIB + payload.HNI + payload.RII
    feature_vector = build_feature_vector(payload)

    try:
        model_input = select_model_input_vector(app.state.model, feature_vector)
        raw_prediction: Any = app.state.model.predict(model_input)
        predicted_gain_percent = float(raw_prediction[0])
    except ValueError as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Model prediction failed"})

    predicted_listing_price: float | None = None
    if payload.Offer_Price is not None:
        predicted_listing_price = payload.Offer_Price * (1 + predicted_gain_percent / 100)

    category = classify_gain(predicted_gain_percent)
    explanation = build_explanation(payload.QIB, computed_total, category, predicted_gain_percent)

    insert_prediction_record(
        app.state.db_path,
        ipo_name=payload.IPO_Name.strip() if payload.IPO_Name else "Unknown IPO",
        qib=payload.QIB,
        hni=payload.HNI,
        rii=payload.RII,
        issue_size=payload.Issue_Size,
        predicted_gain=predicted_gain_percent,
        category=category,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    return PredictResponse(
        predicted_gain_percent=predicted_gain_percent,
        category=category,
        predicted_listing_price=predicted_listing_price,
        explanation=explanation,
    )
