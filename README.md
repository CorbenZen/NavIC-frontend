# NavIC CBTMS Frontend

React, Vite, and Leaflet operations console for the NavIC College Bus Tracking Management System.

## Run locally

From this repository root, install dependencies with `npm ci` and start Vite from the repository root with `npm run dev`. The development proxy reads `BACKEND_URL` from the project `.env` and defaults to `http://localhost:8000`; run the separate NavIC backend to provide API and WebSocket data. Copy `.env.example` to `.env.local` only when frontend overrides are needed.

Run `npm run check` for lint and production build. Run `npm run smoke` when the backend, a signed-in or demo-auth session, and the Playwright browser binaries are available. Bundled fleet telemetry is simulator-backed; no IVTD hardware is connected.
