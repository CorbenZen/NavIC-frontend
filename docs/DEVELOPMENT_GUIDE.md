# Development Guide

This guide describes how to open, set up, run, test and troubleshoot the NavIC
project in VS Code. Commands are written for Linux/macOS; Windows activation is
shown where it differs.

## 1. Prerequisites

- Python 3.11+ (the project is currently exercised on Python 3.14/3.15).
- Node.js + npm.
- Git (optional).
- SQLite is the local database; no external service is required.

## 2. Open the project in VS Code

1. Open VS Code.
2. Choose **File → Open Folder…** and select the `NavIC` repository root.
3. Open a terminal with **Terminal → New Terminal**.
4. Select the Python interpreter with **Python: Select Interpreter**:
   - this workspace's working interpreter is `.venv-local/bin/python`;
   - `.vscode/settings.json` already points the Python extension and terminals
     at it;
   - create `.venv` only if you prefer a fresh environment.

The shared `.vscode/` folder configures interpretation, debugging, tasks and
frontend/backend launch entries for the whole repository.

## 3. Create and activate a virtual environment

```bash
./setup-fedora.sh
```

The manifests live at `backend/requirements.txt` and
`backend/requirements-dev.txt`; they also cover the shared `navic_tcp` modules.

## 4. Install frontend dependencies

```bash
cd frontend && npm ci && cd ..
```

## 5. Configure environment variables

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env   # optional; only needed to override defaults
```

Edit `.env` and replace placeholders. Never commit `.env`.
`backend/.env.example` documents the backend-specific subset; the backend loads
the project-root `.env`.

Important development defaults:

| Variable | Development value |
| --- | --- |
| `APP_ENV` | `development` |
| `DATABASE_URL` | SQLite in `~/.local/share/navic/navic.sqlite3` by default |
| `FRONTEND_URL` | `http://localhost:5173` |
| `TCP_ENABLED` | `true` |
| `TCP_HOST` / `TCP_PORT` | `127.0.0.1` / `5000` |
| `DEVICE_REGISTRY` | `config/devices.demo.json` |
| `EMAIL_PROVIDER` | `console` |
| `FRONTEND_DIST` | `frontend/vite/build` |

`backend/run.py` loads `.env` from the repository root without overriding
variables already exported in the shell.

## 6. Seed the demo database

The database lives in the user's local application data directory. On first
startup, NavIC copies the old root `navic_dev.db` if the destination is absent.

```bash
.venv-local/bin/python -m backend.python_sqlalchemy.database.seed
```

The seeder is idempotent: it creates/updates demo records and never deletes
data or creates credentials.

## 7. Start both servers

```bash
./start-navic.sh
```

This starts:

- FastAPI + WebSocket on <http://localhost:8000>;
- the embedded TCP telemetry receiver on `127.0.0.1:5000` (unless
  `TCP_ENABLED=false`);
- the built SPA from `frontend/vite/build` at `/`.

Useful checks:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/meta
```

For a temporary local demo without signing in:

```bash
DEMO_AUTH_BYPASS=true .venv-local/bin/python backend/run.py
```

This only works when `APP_ENV` is a development value.

## 8. Start services separately (optional)

In a second terminal:

```bash
cd frontend
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api`, `/buses`, `/devices`,
`/drivers`, `/routes`, `/auth`, `/ws`, `/alerts`, `/settings`, `/trips`,
`/geofences` and `/health` to `http://localhost:8000`, including WebSocket
upgrades.

## 9. Build the frontend

```bash
cd frontend
npm run build
```

The build writes `frontend/vite/build/`, which the backend serves when
`FRONTEND_DIST` points there (the default). Use this when you want the
same-origin production bundle.

## 10. Run the tests

Backend tests:

```bash
.venv-local/bin/python -m unittest discover -s backend/tests -t . -v
```

TCP-specific tests:

```bash
.venv-local/bin/python -m unittest discover -s tests -v
```

The project uses `unittest`; `pytest` is not installed. The current suite is
**164 tests**: 120 backend (including 27 modular-app tests in
`backend/tests/test_backend_app.py`) and 44 TCP.

## 11. Run the TCP simulator

The TCP application remains independent and unchanged. Start the backend
first, then:

```bash
python -m navic_tcp.client_main \
  --host 127.0.0.1 --port 5000 \
  --registry config/devices.demo.json \
  --devices 6 --interval 1 --continuous
```

Other entry points:

```bash
# TCP server + tracking API only (no website FastAPI app)
python -m navic_tcp.server_main --host 127.0.0.1 --port 9000 --api-host 127.0.0.1 --api-port 8001

# User management
python -m navic_tcp.manage_users list
```

## 12. VS Code tips

- Use the Explorer to navigate the three main components:
  `frontend/`, `backend/`, `navic_tcp/`.
- The Python extension should point at your chosen virtual environment.
- `.vscode/launch.json` provides **Website backend (FastAPI + TCP)**,
  **Tracking server (TCP + HTTP API)**, **Simulate 3 tracking devices** and a
  **Website frontend (Chrome)** debug configuration for <http://localhost:5173>.
- `.vscode/tasks.json` provides:
  - `Website: start backend (FastAPI + TCP)`
  - `Website: start frontend (Vite dev server)`
  - `Website: build frontend`
  - `Website: seed demo data`
  - `Website: run backend tests`
  - `Website: run all tests`
  - `Tracking: …` tasks for the independent TCP application.
- Run the default build task (**Terminal → Run Build Task**) to start both the
  backend and frontend in parallel.
- If `python.defaultInterpreterPath` points at a non-existent environment,
  update it or select the interpreter through the command palette.

## 13. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ModuleNotFoundError: navic_tcp` | Running from the wrong directory or root not on `sys.path` | Run `python backend/run.py` from the repo root; it inserts the root automatically |
| `ModuleNotFoundError: fastapi` | Dependencies not installed in the active environment | `python -m pip install -r backend/requirements.txt` |
| `Address already in use` | Port 8000 or 5000 already occupied | Stop the other process or set `TCP_PORT` / run Uvicorn on another port |
| `database is locked` | Two writers on the SQLite file | Stop duplicate backend processes |
| Frontend calls fail with 404/HTML | Backend not running, or Vite proxy target wrong | Start `python backend/run.py` on port 8000 |
| Login redirects to the wrong origin | `FRONTEND_URL` does not match the browser origin | Set `FRONTEND_URL=http://localhost:5173` |
| CSRF errors on writes | Missing session/cookie or stale tab | Sign in again and refresh the page |
| `FRONTEND_DIST` not found | Build not present or path wrong | Run `cd frontend && npm run build`; default is `frontend/vite/build` |
| Tests import the wrong test module | Backend tests need the package root | Use `-t .` with `python -m unittest discover -s backend/tests -t .` |
| Vite warns about `"use client"` | Upstream `lucide-react` directive | Harmless warning |
| `.venv/bin/python` missing | Only `.venv-local` exists in this workspace | Use `.venv-local/bin/python` or create `.venv` |

## 14. What not to do

- Do not move or rewrite modules inside `navic_tcp/`; it is an independent
  component and the shared backend implementation.
- Do not commit `.env`, `navic_dev.db`, `dev-mail.jsonl` or `node_modules/`.
- Do not rebuild `frontend/vite/build` unless you intend to update the served bundle.
- Do not replace the existing React/Vite/FastAPI stack without approval.
