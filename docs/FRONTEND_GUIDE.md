# Frontend guide

The frontend is a React JSX single page application built and served by Vite.
Technology roots are explicit in Explorer while conventional `package.json`,
lockfile, `index.html`, and Vite configuration remain easy to find.

## Source locations

- `frontend/react-jsx/main.jsx` mounts React; `App.jsx` owns route selection and
  application providers.
- `frontend/react-jsx/components/` contains reusable interface components,
  grouped into common, navigation, buttons, cards, forms, tables, modals,
  charts, and feedback.
- `frontend/react-jsx/pages/` contains authentication, dashboard, fleet,
  vehicles, telemetry, alerts, user, settings, and profile pages.
- `frontend/react-jsx/layouts/`, `hooks/`, `context/`, and `utils/` hold the
  app shell, shared fleet state, hooks, and domain display helpers.
- `frontend/leaflet-react/` owns Leaflet and React Leaflet map components,
  marker icons, layers, and camera controls.
- `frontend/javascript-services/` owns HTTP API calls and the reconnecting
  WebSocket client.
- `frontend/css-styles/global/styles.css` is the global responsive stylesheet.
- `frontend/static-assets/` stores source images/logos. Files under
  `frontend/public/` are served at stable root URLs such as `/images/logo.png`.

## Vite configuration

Vite configuration is `frontend/vite/vite.config.js`. Development proxy rules
forward API prefixes to FastAPI and preserve WebSocket upgrades. HTML requests
for routes that overlap API paths fall back to the SPA. Vite aliases (`@react`,
`@services`, `@leaflet`, `@styles`, `@assets`) point at the named source roots.
Production output goes to `frontend/vite/build/`, which the FastAPI app serves.

## Development

```bash
cd frontend
npm ci
npm run dev
```

The development server is available at `http://localhost:5173`; Vite forwards
same-origin API requests to the project-root `BACKEND_URL` (default
`http://localhost:8000`).
Build with `npm run build`. The HTML entry is `frontend/index.html`, which
loads `/react-jsx/main.jsx`.

Keep HTTP calls in `javascript-services/api.js` rather than creating
page-specific fetch wrappers. Fleet polling and live updates are coordinated by
`react-jsx/context/FleetContext.jsx`. Leaflet map rendering and camera behavior
stay inside `leaflet-react/`.

## Authentication UI

- `frontend/react-jsx/pages/authentication/Login.jsx` renders the sign-in page
  around `components/forms/SignInForm.jsx`. The form posts `user_id` and
  `password` to `/api/auth/login`; administrators enter their configured email
  in the User ID field. Google sign-in remains available as a secondary action.
- `frontend/react-jsx/pages/authentication/SignUp.jsx` renders
  `components/forms/SignUpForm.jsx`, which collects first/second name, account
  type, User ID, password, confirmation and a student-only USN before calling
  `/api/auth/register`.
- `frontend/javascript-services/authentication/authService.js` exposes
  `signIn`, `signUp`, `signOut` and `currentUser`; `registrationService.js`
  forwards to `signUp`. `App.jsx` restores the session with `api.authMe()`.
- No email address or verification screen is part of the new registration
  flow. The legacy `/auth/verify-email` route remains handled for old links.
