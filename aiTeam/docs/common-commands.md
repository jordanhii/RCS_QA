# Common Commands

Run commands from the repository root unless noted.

## Backend

Install dependencies:

```bash
cd backend
npm install
```

Start backend:

```bash
cd backend
npm run dev
```

Production-style start:

```bash
cd backend
npm start
```

Backend expects MongoDB at:

```text
mongodb://127.0.0.1:27017/qa_alert_system
```

Known gap: the backend package currently has no test script. Backend changes are
usually verified by starting MongoDB, running the backend, and checking the
affected endpoint or frontend flow.

## Frontend

Install dependencies:

```bash
cd frontend
npm install
```

Start Vite dev server:

```bash
cd frontend
npm run dev
```

Run frontend tests:

```bash
cd frontend
npm test
```

Vite usually serves the frontend on port `5173` unless that port is occupied.

## Python Workers

Inspect worker scripts before changing sync/export behavior:

```bash
python3 rc_sync_service.py
python3 export_worker.py
python3 igo_export_worker.py
```

Only start long-running workers when needed for manual verification.

Known gap: worker runtime arguments and environment needs should be confirmed
from the worker source before running them. Do not assume every worker can be
validated by a no-argument command.

## Focused Verification Guide

- Frontend logic change: run `cd frontend && npm test`.
- Vue UI change: run `cd frontend && npm run dev`, then manually check the affected route.
- Backend route change: start MongoDB and `cd backend && npm run dev`, then call the affected endpoint.
- Schema change: verify old documents, startup migration behavior, and frontend consumers.
- Sync/export change: verify worker script behavior and backend route integration.

## Verification Reporting

Every final report should include:

- command or manual check run
- result
- checks not run
- reason checks were not run
- residual risk
