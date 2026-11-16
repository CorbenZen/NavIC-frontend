# Trip and reports HTTP 500 investigation

## Finding and repair

The reported 500 could not be reproduced against the available database snapshot. The configured database was copied to `/tmp/navic-http500-live.sqlite3`; direct `/trips` and report requests returned 200 with the demo stopped and while running at 4x. The live service's `/health` returned `status=ok`, `database=ok`, and migration status was `0008_user_second_name (head)`. The user-facing screenshot did not include a request URL or server traceback, and the browser session needed to reproduce it was unavailable. Therefore the original incident's exact exception and root cause remain **NOT TESTED / NOT CONFIRMED**; no historical traceback was accessible to paste.

The code review found failure cases that could break trip/report calculations on degenerate persisted telemetry: points were assumed to already be ordered, timestamps could mix naive and timezone-aware values, and invalid/non-finite coordinates or speeds could propagate into calculations or JSON. The fix sorts by device and normalized UTC timestamp (retaining equal-time points), ignores invalid coordinates, excludes non-finite optional values from calculations, clamps the haversine input, normalizes report date ranges, and sanitizes non-finite floats before serialization. Tests cover moving, idle, stopped, same-position, duplicate-time, out-of-order, long-gap, mixed-timezone, and invalid numeric values.

Unhandled backend errors now log a traceback with an 8-character reference ID and return only a structured generic error plus that ID. The frontend API error carries the ID, and the shared error banner uses the same format for trips and reports: `Couldn't load <resource> (500). Ref <id>.` (with the Retry button).

## Files changed for this repair

- `navic_tcp/reporting.py`
- `navic_tcp/fastapi_app.py`
- `backend/python_fastapi/application/main.py`
- `backend/tests/test_reporting_services.py`
- `backend/tests/test_fastapi_reports.py`
- `frontend/javascript-services/api.js`
- `frontend/react-jsx/components/feedback/ErrorBanner.jsx`
- `frontend/react-jsx/components/forms/DataSourceFilter.jsx`
- `frontend/react-jsx/context/FleetContext.jsx`
- `frontend/react-jsx/pages/alerts/Alerts.jsx`
- `frontend/react-jsx/pages/dashboard/Overview.jsx`
- `frontend/react-jsx/pages/fleet/Geofences.jsx`
- `frontend/react-jsx/pages/fleet/Trips.jsx`
- `frontend/react-jsx/pages/public/PublicBusShare.jsx`
- `frontend/react-jsx/pages/settings/Settings.jsx`
- `frontend/react-jsx/pages/telemetry/Diagnostics.jsx`
- `frontend/react-jsx/pages/telemetry/LiveTracking.jsx`
- `frontend/react-jsx/pages/telemetry/Reports.jsx`
- `scripts/check_api_routes.py` (new repeatable endpoint sweep)

Each edited source file had a copy made under `backups/http500_20261116T115336Z/` or `backups/http500_20261116T120046Z/` before edits. Later additional edits were backed up under `backups/http500_20261116T124500Z/` and `backups/http500_20261116T122525Z/`. All simulation runs used the disposable `/tmp` database copy; the configured database was not changed.

## Command evidence

`npm run check`:

```text
exit 0
ESLint: 0 errors (35 existing warnings)
Vite production build: completed, 2176 modules transformed
```

Route sweep (`scripts/check_api_routes.py`, isolated backend, temporary SQLite copy):

```text
API route sweep PASS: 16 UI paths and 15 report types in all three states
demo-start 200 {"started":true,"speed_multiplier":4.0}
demo-stop 200 {"stopped":true}
```

The sweep made 46 GET requests per state: 16 UI API paths and 15 report types with `view=table` and `view=charts`; all returned 200 while stopped, running, and stopped again. The separate 60-second 4x check printed:

```text
simulation start at 4x: 200
after 60 seconds at 4x: 31 endpoints; statuses=[200]
failures: []
demo stop: 200
```

Pytest (all live test folders except the hanging composition module, with demo bypass off and `DATABASE_URL` set to the temporary copy):

```text
195 passed, 22 subtests passed in 23.88s
```

The complete `pytest backend/tests tests` run is **NOT TESTED** to completion: it stalled in `backend/tests/test_backend_app.py` during module-level `TestClient.__enter__()` / Starlette lifespan startup and was stopped by a 120-second timeout. That test module produced no test result output. No changes were made to stored database rows.

`npm run smoke` was run with Chromium and Firefox, but the route matrix did not start. Both browsers stopped at the smoke setup guard; Chromium also reported a 404 resource:

```text
FAILURE Chromium smoke setup error: Set SMOKE_USER_ID and SMOKE_PASSWORD, or run against the app explicit demo-auth mode.
FAILURE Firefox smoke setup error: Set SMOKE_USER_ID and SMOKE_PASSWORD, or run against the app explicit demo-auth mode.
```

The harness could not detect the expected `Demo access · auth off` banner even with the isolated backend process configured for development bypass; the source of that discrepancy was not resolved. Earlier smoke attempts also hit a Vite 502 while the temporary backend was launched from the frontend directory; that startup-path issue was corrected for the final attempt.

Thus Playwright page rendering, Trips/Reports UI, and the requested in-browser 60-second scenario are **NOT TESTED**. The standalone backend 60-second simulation check and API sweep above did run. `ruff check` on the edited Python modules and `python -m py_compile` on the backend and route-sweep script both completed successfully.

## Remaining gap

The implementation now handles the likely degenerate-data failure modes and returns consistent referenceable errors, but the exact original HTTP 500 remains unconfirmed until it is reproduced with an authenticated browser request and the matching backend log. The test harness's TestClient lifespan stall and smoke setup's missing authentication/demo identity also need resolving to complete the full requested suites.
