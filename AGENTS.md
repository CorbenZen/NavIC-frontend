# CBTMS project guide

College Bus Tracking Management System (NavIC) is a student-facing prototype with a FastAPI/SQLAlchemy backend, newline-delimited JSON TCP telemetry receiver, simulator, REST and WebSocket APIs, and a React + Vite + Leaflet frontend. The configured local data store is SQLite; do not assume PostgreSQL is present. No IVTD hardware is connected, so bundled telemetry is simulated.

## Project commands

- Setup: `./setup-fedora.sh` (Fedora) or install Python requirements from `backend/requirements.txt` and run `npm install` in `frontend/`.
- Run both servers: `./start-navic.sh`.
- Backend only: `.venv-local/bin/python backend/run.py` (or follow README local setup).
- Frontend only: `cd frontend && npm run dev`.
- Simulator: `.venv-local/bin/python -m navic_tcp.client_main --devices 6 --continuous`.
- Python tests: `.venv-local/bin/pytest backend/tests tests` (keep pytest discovery scoped to these live test folders; do not collect `backups/` or `_archive/`).
- Python lint: `.venv-local/bin/ruff check backend navic_tcp tests scripts`.
- Frontend lint/build: `cd frontend && npm run check`; smoke test: `cd frontend && npm run smoke` when available.
- Migration status: `cd backend && ../.venv-local/bin/alembic current` using the configured database; use a scratch database for migration up/down checks.

## Conventions

- Keep React components in JSX and Python modules documented with accurate purpose comments/docstrings.
- Preserve the existing layered layout unless a concrete bug or maintainability issue justifies a change.
- Treat the `simulated` flag and data-source category as provenance. Never invent battery, signal, ignition, ETA inputs, hardware records, or IVTD protocol behavior.
- Keep secrets out of output and docs; document environment variable names only.
- Use additive and reversible database migrations. Do not mutate or erase stored fleet, telemetry, trip, alert, geofence, device, or share-token records.

## Safety rules

- Do not use Git commands or Git integrations for this project.
- Do not delete source files. Move obsolete files to `_archive/<timestamp>/` preserving their paths, and record each move in `docs/CLEANUP_LOG.md`.
- Never rewrite database data. Skip only destructive work or work requiring unavailable secrets, record the reason, and continue elsewhere.
- Do not silence undefined names with dummy declarations; trace and repair the intended behavior.
- Do not rewrite working code for style alone. Re-run relevant checks after bug fixes or structural changes.
- Do not add runtime dependencies unless necessary; record new tooling and the reason.
- Reports must cite commands actually run. Use `NOT TESTED` when a check could not be run. Do not claim route coverage unless the browser smoke test ran and passed.
