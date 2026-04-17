# Backend (FastAPI)

## Requirements

- Python 3.10+
- `model.pkl` present in this folder
- CatBoost available in environment (installed via `requirements.txt`)

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health`
- `POST /predict`
- `GET /dashboard`
- `GET /insights`
- `GET /history?page=1&q=`

## Persistence

- Prediction history is persisted in SQLite at `backend/predictions.db`.
- Data survives backend restarts.

## Predict Request JSON

```json
{
  "QIB": 45.2,
  "HNI": 12.5,
  "RII": 8.2,
  "Issue_Size": 500,
  "Offer_Price": 450
}
```

Notes:
- `Total` is always recomputed in backend as `QIB + HNI + RII`.
- All numeric fields must be non-negative.

Preprocessing used for inference:
- `QIB_log = log1p(QIB)`
- `HNI_log = log1p(HNI)`
- `RII_log = log1p(RII)`
- `Total_log = log1p(QIB + HNI + RII)`
- `Issue_Size_log = log1p(Issue_Size)`
- `QIB_to_RII = QIB_log / (RII_log + 1)`
- `Total_to_Size = Total_log / (Issue_Size_log + 1)`

Final feature order:
- `[QIB_log, HNI_log, RII_log, Total_log, Issue_Size_log, Offer_Price, QIB_to_RII, Total_to_Size]`

## Predict Response JSON

```json
{
  "predicted_gain_percent": 18.34,
  "category": "Moderate Gain",
  "predicted_listing_price": 532.53,
  "explanation": "High institutional participation and healthy overall subscription indicate strong demand. Model outlook: Moderate Gain (18.34%)."
}
```

## CORS

Default allowed origins:
- `http://localhost:3000`
- `https://your-frontend-domain`

Override via env var:

```bash
set CORS_ORIGINS=http://localhost:3000,https://your-real-domain.com
```
