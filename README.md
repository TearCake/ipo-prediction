# IPO Listing Gain Prediction App

![Frontend](https://img.shields.io/badge/Frontend-Next.js%2016-black)
![Backend](https://img.shields.io/badge/Backend-FastAPI-009688)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)
![Database](https://img.shields.io/badge/Database-SQLite-003B57)
![Status](https://img.shields.io/badge/Status-Active-2ea44f)

Full-stack IPO listing gain prediction project with:

- `backend/`: FastAPI inference API + analytics endpoints + SQLite persistence
- `frontend/`: Next.js app serving the UI and stitched static pages

## Project Structure

```text
.
├─ backend/
│  ├─ main.py
│  ├─ requirements.txt
│  ├─ model.pkl
│  └─ predictions.db (created at runtime)
└─ frontend/
   ├─ app/
   ├─ public/stitch/
   ├─ package.json
   └─ next.config.ts
```

## Prerequisites

- Python `3.10+`
- Node.js `20+` (recommended for Next.js 16)
- npm `10+`

## Quick Start (From Root)

### 1) Backend setup and run

```powershell
# from repository root
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\backend\requirements.txt

# run API on :8000
uvicorn --app-dir backend main:app --reload --host 0.0.0.0 --port 8000
```

Backend docs:

- Health check: `http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/docs`

### 2) Frontend setup and run

Open a second terminal:

```powershell
cd .\frontend
npm install
npm run dev
```

Frontend app runs at `http://localhost:3000`.

## API Endpoints

- `GET /health`
- `POST /predict`
- `GET /dashboard`
- `GET /insights`
- `GET /history?page=1&q=`

## Notes

- Ensure `backend/model.pkl` exists before starting backend.
- Prediction history is saved in SQLite at `backend/predictions.db`.
- CORS defaults include `http://localhost:3000`.

## Development

Frontend lint:

```powershell
cd .\frontend
npm run lint
```

## License

Add a `LICENSE` file if you want to publish this repository publicly.
