/*
 * SPA entry point: resolves the cookie-backed user, auth routes and fleet page.
 * Session identity comes from the FastAPI auth API; demo identity is fallback-only.
 */
import { AlertTriangle, RotateCcw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@services/api';
import { Login } from './pages/authentication/Login';
import { SignUp } from './pages/authentication/SignUp';
import { VerifyEmailLink } from './pages/authentication/VerifyEmailLink';
import { Shell } from './layouts/Shell';
import { ToastProvider } from './components/feedback';
import { FleetProvider } from './context/FleetContext';
import { NAV_ITEMS, canAccessPath } from './utils/navigation';
import { Alerts } from './pages/alerts/Alerts';
import { Devices } from './pages/fleet/Devices';
import { Diagnostics } from './pages/telemetry/Diagnostics';
import { Drivers } from './pages/users/Drivers';
import { Geofences } from './pages/fleet/Geofences';
import { Overview } from './pages/dashboard/Overview';
import { Onboarding } from './pages/profile/Onboarding';
import { LiveTracking } from './pages/telemetry/LiveTracking';
import { Reports } from './pages/telemetry/Reports';
import { RoutesPage } from './pages/fleet/Routes';
import { SettingsPage } from './pages/settings/Settings';
import { Trips } from './pages/fleet/Trips';
import { Vehicles } from './pages/vehicles/Vehicles';
import { PublicBusShare } from './pages/public/PublicBusShare';
import '@styles/global/styles.css';

const KNOWN_PATHS = new Set([...NAV_ITEMS.map((item) => item.path), '/overview', '/onboarding', '/sign-in', '/sign-up', '/public/bus']);
const VERIFY_PATH = '/auth/verify';
const EMAIL_VERIFY_PATH = '/auth/verify-email';
const PUBLIC_BUS_PATH_PREFIX = '/public/bus/';

// React StrictMode and quick reloads can run the verify effect twice.  A
// single-use token must not be submitted twice concurrently, so share the
// in-flight request for the same token.  Once it settles the entry is removed,
// allowing a later deliberate reuse attempt to receive the normal 400.
const verifyRequests = new Map();
function verifyOnce(token, emailVerification = false) {
  const key = `${emailVerification ? 'email' : 'magic'}:${token}`;
  if (!verifyRequests.has(key)) {
    const request = emailVerification ? api.verifyEmail(token) : api.verifyMagicLink(token);
    verifyRequests.set(key, request);
    const clear = () => verifyRequests.delete(key);
    request.then(clear, clear);
  }
  return verifyRequests.get(key);
}

function cleanPath(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

const APP_BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, '');

function routePath(pathname) {
  const cleaned = cleanPath(pathname);
  if (APP_BASE_PATH && (cleaned === APP_BASE_PATH || cleaned.startsWith(`${APP_BASE_PATH}/`))) {
    return cleanPath(cleaned.slice(APP_BASE_PATH.length) || '/');
  }
  return cleaned;
}

function routeUrl(pathname) {
  const cleaned = cleanPath(pathname);
  return APP_BASE_PATH ? `${APP_BASE_PATH}${cleaned === '/' ? '/' : cleaned}` : cleaned;
}

function normalisePath(pathname) {
  const cleaned = routePath(pathname);
  // Handle public bus share paths with dynamic tokens
  if (cleaned.startsWith(PUBLIC_BUS_PATH_PREFIX)) {
    return PUBLIC_BUS_PATH_PREFIX;
  }
  return KNOWN_PATHS.has(cleaned) ? cleaned : '/';
}

function BootScreen({ error, onRetry }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ width: 'min(480px, 100%)', padding: 28 }}>
        <div className="row" style={{ marginBottom: 14 }}>
          <img className="navic-logo boot-logo" src={`${import.meta.env.BASE_URL}images/logo.png`} alt="NavIC College Bus Tracking and Management System" width="2000" height="2000" />
        </div>
        {error ? (
          <>
            <div className="error-banner" style={{ marginBottom: 14 }}>
              <AlertTriangle />
              <span>{error}</span>
            </div>
            <p className="small muted" style={{ lineHeight: 1.6 }}>
              Confirm the FastAPI backend is running, then retry. The local Vite server forwards API requests automatically.
            </p>
            <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={onRetry}>
              <RotateCcw /> Retry connection
            </button>
          </>
        ) : (
          <div className="loading-block" style={{ padding: '20px 0 4px' }}>
            <span className="spinner" /> Connecting to the CBTMS service…
          </div>
        )}
      </div>
    </div>
  );
}

function AccessDenied({ navigate }) {
  return (
    <div className="card" style={{ maxWidth: 560, margin: '40px auto', padding: 30 }}>
      <div className="login-sent-icon danger" style={{ marginBottom: 14 }}>
        <ShieldCheck />
      </div>
      <h2 style={{ marginTop: 0 }}>Management access required</h2>
      <p className="muted" style={{ lineHeight: 1.65 }}>
        Your account can view live operations and reports but cannot manage vehicles, drivers, routes, devices or settings. Ask a
        transport administrator if you need an elevated role.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
        Return to overview
      </button>
    </div>
  );
}

function RouteView({ path, navigate, user }) {
  // Public bus share page doesn't require auth
  if (path === PUBLIC_BUS_PATH_PREFIX) {
    const token = window.location.pathname.split(PUBLIC_BUS_PATH_PREFIX)[1];
    return <PublicBusShare token={token} />;
  }
  if (!canAccessPath(path, user?.role)) return <AccessDenied navigate={navigate} />;
  switch (path) {
    case '/overview':
      return <Overview navigate={navigate} />;
    case '/tracking':
      return <LiveTracking />;
    case '/trips':
      return <Trips />;
    case '/vehicles':
      return <Vehicles />;
    case '/drivers':
      return <Drivers />;
    case '/routes':
      return <RoutesPage />;
    case '/geofences':
      return <Geofences />;
    case '/devices':
      return <Devices />;
    case '/reports':
      return <Reports />;
    case '/diagnostics':
      return <Diagnostics />;
    case '/alerts':
      return <Alerts navigate={navigate} />;
    case '/settings':
      return <SettingsPage />;
    case '/':
    default:
      return <Overview navigate={navigate} />;
  }
}

export default function App() {
  const [path, setPath] = useState(() => normalisePath(routePath(window.location.pathname)));
  const [meta, setMeta] = useState(null);
  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState('checking');
  const [bootError, setBootError] = useState('');
  const [bootAttempt, setBootAttempt] = useState(0);
  const [verifyState, setVerifyState] = useState(() => [VERIFY_PATH, EMAIL_VERIFY_PATH].includes(path) ? 'checking' : 'idle');
  const [verifyError, setVerifyError] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const verificationMode = path === EMAIL_VERIFY_PATH ? 'email' : 'magic';
  const [verificationPrefill, setVerificationPrefill] = useState('');

  useEffect(() => {
    const onPop = () => {
      const next = routePath(window.location.pathname);
      if (next === VERIFY_PATH || next === EMAIL_VERIFY_PATH) {
        setVerifyState('idle');
        setPath('/');
        return;
      }
      setPath(normalisePath(next));
      const vehicle = new URLSearchParams(window.location.search).get('vehicle');
      if (cleanPath(next) === '/tracking' && vehicle) {
        window.dispatchEvent(new CustomEvent('navic:focus-vehicle', { detail: { vehicle } }));
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    let active = true;
    let successTimer = null;
    const landingUrl = new URL(window.location.href);
    const authError = landingUrl.searchParams.get('auth_error');
    if (authError) {
      // Google OAuth removed - this was for Google auth errors
      console.warn('Received auth_error param but Google OAuth has been removed:', authError);
    }
    if (authError || landingUrl.searchParams.has('auth')) {
      landingUrl.searchParams.delete('auth_error');
      landingUrl.searchParams.delete('auth');
      window.history.replaceState({}, '', `${landingUrl.pathname}${landingUrl.search}${landingUrl.hash}`);
    }
    const pathname = routePath(window.location.pathname);
    const isEmailVerification = pathname === EMAIL_VERIFY_PATH;
    const isVerify = pathname === VERIFY_PATH || isEmailVerification;

    (async () => {
      let metaResult = null;
      try {
        metaResult = await api.meta();
        if (!active) return;
        setMeta(metaResult);
      } catch (error) {
        if (!active) return;
        if (!isVerify) {
          setBootError(error.message || 'Could not reach the API service.');
          setAuthState('error');
        }
      }

      if (isVerify) {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const requestedEmail = params.get('email') || '';
        if (requestedEmail) setVerifyEmail(requestedEmail);
        // Remove the token from the address bar before any network/analytics work.
        window.history.replaceState({}, '', routeUrl(pathname));
        if (!token) {
          setVerifyError('This sign-in link is incomplete. Request a new link to continue.');
          setVerifyState('error');
          return;
        }
        try {
          const result = await verifyOnce(token, isEmailVerification);
          if (!active) return;
          window.history.replaceState({}, '', routeUrl('/'));
          setUser(result.user);
          setAuthState('authenticated');
          setVerifyEmail(result.user?.email || requestedEmail);
          setVerifyState('success');
          successTimer = window.setTimeout(() => {
            if (!active) return;
            setPath('/');
            setVerifyState('idle');
          }, 700);
        } catch (error) {
          if (!active) return;
          setVerifyError(error.message || 'The sign-in link is invalid, expired, or has already been used.');
          setVerifyState('error');
          setAuthState('anonymous');
        }
        return;
      }

      try {
        const me = await api.authMe();
        if (!active) return;
        setUser(me);
        setAuthState('authenticated');
        const landing = me?.is_profile_complete === false ? '/onboarding' : '/overview';
        if (me?.username !== 'demo' && ['/sign-in', '/sign-up'].includes(routePath(window.location.pathname))) {
          window.history.replaceState({}, '', routeUrl(landing));
          setPath(landing);
        } else if (routePath(window.location.pathname) === '/onboarding' && me?.is_profile_complete !== false) {
          window.history.replaceState({}, '', routeUrl('/overview'));
          setPath('/overview');
        } else if (me?.is_profile_complete === false && routePath(window.location.pathname) !== '/onboarding') {
          window.history.replaceState({}, '', routeUrl(landing));
          setPath(landing);
        }
      } catch {
        if (!active) return;
        setUser(null);
        if (metaResult?.demo_auth_bypass === true && metaResult?.auth_required === false) {
          setUser({ username: 'demo', role: 'admin', email: 'demo@local.invalid' });
          setAuthState('authenticated');
        } else {
          setAuthState('anonymous');
          const currentPath = routePath(window.location.pathname);
          if (!['/sign-in', '/sign-up', VERIFY_PATH, EMAIL_VERIFY_PATH].includes(currentPath)
            && !currentPath.startsWith(PUBLIC_BUS_PATH_PREFIX)) {
            window.history.replaceState({}, '', routeUrl('/sign-in'));
            setPath('/sign-in');
          }
        }
      }
    })();

    return () => {
      active = false;
      if (successTimer) window.clearTimeout(successTimer);
    };
  }, [bootAttempt]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setAuthState('anonymous');
      const currentPath = routePath(window.location.pathname);
      if (!['/sign-in', '/sign-up', VERIFY_PATH, EMAIL_VERIFY_PATH].includes(currentPath)
        && !currentPath.startsWith(PUBLIC_BUS_PATH_PREFIX)) {
        window.history.replaceState({}, '', routeUrl('/sign-in'));
        setPath('/sign-in');
      }
    };
    window.addEventListener('navic:unauthorized', onUnauthorized);
    return () => window.removeEventListener('navic:unauthorized', onUnauthorized);
  }, []);

  const navigate = useCallback((next) => {
    const request = new URL(next, window.location.origin);
    let target = normalisePath(routePath(request.pathname));
    if (authState === 'authenticated' && user?.username !== 'demo' && ['/sign-in', '/sign-up'].includes(target)) target = '/overview';
    const suffix = `${request.search}${request.hash}`;
    if (`${routeUrl(target)}${suffix}` !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.pushState({}, '', `${routeUrl(target)}${suffix}`);
    }
    setPath(target);
    if (target === '/tracking' && request.searchParams.get('vehicle')) {
      window.dispatchEvent(new CustomEvent('navic:focus-vehicle', { detail: { vehicle: request.searchParams.get('vehicle') } }));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [authState, user?.username]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Even if the server call fails, remove local UI state. The HttpOnly cookie
      // is only truly cleared by the server response.
    }
    setUser(null);
    setAuthState('anonymous');
    setVerifyState('idle');
    setPath('/');
    window.history.replaceState({}, '', routeUrl('/'));
  }, []);

  const requestNewLink = useCallback(() => {
    setVerificationPrefill(verifyEmail);
    setVerifyState('idle');
    setVerifyError('');
    setAuthState('anonymous');
    setPath('/');
    window.history.replaceState({}, '', routeUrl('/'));
  }, [verifyEmail]);

  const shellPath = useMemo(() => normalisePath(path), [path]);
  // Keep the demo shell useful while letting an explicit cookie session replace it.
  const demoIdentity = meta?.demo_auth_bypass === true && user?.username === 'demo';

  if (verifyState !== 'idle') {
    return (
      <VerifyEmailLink
        state={verifyState}
        verificationMode={verificationMode}
        message={verifyError}
        email={verifyEmail}
        onRequestNew={requestNewLink}
        onContinue={verifyState === 'error' ? requestNewLink : null}
      />
    );
  }
  if (authState === 'checking') return <BootScreen />;
  if (authState === 'error') {
    return (
      <BootScreen
        error={bootError}
        onRetry={() => {
          setBootError('');
          setAuthState('checking');
          setBootAttempt((value) => value + 1);
        }}
      />
    );
  }
  const showAuthForm = authState === 'anonymous' || demoIdentity;
  const onAuthenticated = (nextUser) => {
    setVerificationPrefill('');
    setUser(nextUser);
    setAuthState('authenticated');
    const destination = nextUser?.is_profile_complete === false ? '/onboarding' : '/overview';
    setPath(destination);
    window.history.replaceState({}, '', routeUrl(destination));
  };
  if (showAuthForm && path === '/sign-up') return <SignUp meta={meta} navigate={navigate} />;
  if (showAuthForm && path === '/sign-in') return <Login meta={meta} navigate={navigate} onAuthenticated={onAuthenticated} />;
  if (showAuthForm) return <Login meta={meta} navigate={navigate} onAuthenticated={onAuthenticated} />;

  if (user?.is_profile_complete === false) {
    return <Onboarding user={user} onComplete={(updated) => {
      setUser(updated);
      setPath('/overview');
      window.history.replaceState({}, '', routeUrl('/overview'));
    }} />;
  }

  return (
    <ToastProvider>
      <FleetProvider enabled={authState === 'authenticated'} user={user}>
        <Shell path={shellPath} navigate={navigate} user={user} meta={meta} onLogout={logout}>
          <RouteView path={shellPath} navigate={navigate} user={user} />
        </Shell>
      </FleetProvider>
    </ToastProvider>
  );
}
