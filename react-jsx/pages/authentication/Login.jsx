/* Sign-in page; credentials are submitted to the ID auth API and user state is returned to App. */
import { Database, Gauge, MapPinned, Wifi } from 'lucide-react';
import { Brand } from '../../components/common/Brand';
import { SignInForm } from '../../components/forms';

export function Login({ meta, onAuthenticated, initialUserId = '', navigate = () => {} }) {
  const params = new URLSearchParams(window.location.search);
  const prefill = initialUserId || params.get('user_id') || '';
  const justRegistered = params.get('registered') === '1';

  return (
    <div className="login-screen">
      <aside className="login-aside">
        <Brand />

        <div className="login-copy">
          <h1>
            One operational view of the <em>entire fleet</em>.
          </h1>
          <p>
            Track vehicle positions, manage drivers, routes and IVTD devices, and produce reports from persisted telemetry.
            Every number in this console comes from the connected CBTMS database.
          </p>
          <div className="login-points">
            <div className="login-point">
              <MapPinned />
              Live positions and recorded trip history
            </div>
            <div className="login-point">
              <Database />
              Vehicles, drivers, routes and device registry
            </div>
            <div className="login-point">
              <Gauge />
              Speed, stoppage and utilisation reporting
            </div>
            <div className="login-point">
              <Wifi />
              WebSocket updates with TCP receiver ingest
            </div>
          </div>
        </div>

        <div className="login-foot">
          {meta?.application || 'CBTMS NavIC'} v{meta?.version || '—'} · {meta?.environment || 'unknown environment'}
        </div>
      </aside>

      <section className="login-panel">
        <div className="login-card">
          {justRegistered ? (
            <div className="login-note" role="status">
              Account created. Sign in with your User ID.
            </div>
          ) : null}
          <SignInForm
            onAuthenticated={onAuthenticated}
            initialUserId={prefill}
            navigate={navigate}
          />
        </div>
      </section>
    </div>
  );
}
