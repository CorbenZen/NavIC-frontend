# CBTMS NavIC Frontend

The NavIC frontend is the browser-based operations console for a college bus tracking prototype. It uses React, Vite, and Leaflet to present fleet status, live map updates, trip history, reports, and fleet management pages. The UI reads its data from the separate NavIC FastAPI backend; it does not generate fleet records itself.

> **Data note:** The bundled fleet feed is simulator-backed. No IVTD hardware is connected, and simulated records are identified as such.
---
## Requirements

Node.js and npm. The backend should be running for live API data and the end-to-end smoke test.

## Install and run

From this repository root:

```bash
npm ci
cp .env.example .env.local       # optional VITE_* settings
npm run dev
```

Open <http://localhost:5173>. The Vite development proxy forwards API and WebSocket requests to `BACKEND_URL`, defaulting to `http://localhost:8000`. If your backend uses another address, add `BACKEND_URL=http://localhost:PORT` to `.env.local`. Start the backend separately; see the [backend repository](https://github.com/CorbenZen/NavIC-backend).

## Quality checks

```bash
npm run check      # ESLint and production build
npm run smoke      # browser route and interaction smoke checks
npm run contrast   # theme token contrast checks
```

The smoke test requires the backend, a usable demo or signed-in session, and the Playwright browser binaries. The frontend build output is generated locally and should not be committed.

## Source layout

- `react-jsx/` — application pages, shared components, hooks, and state.
- `css-styles/` — global styles and theme tokens.
- `leaflet-react/` — map components and Leaflet integration.
- `javascript-services/` — API and frontend service helpers.
- `public/` — static assets and app icons.
- `scripts/` — smoke-test and contrast-check scripts.
- `vite/` — Vite development and proxy configuration.

For the complete project overview and one-command local setup, see the [complete NavIC repository](https://github.com/CorbenZen/NavIC-complete).
