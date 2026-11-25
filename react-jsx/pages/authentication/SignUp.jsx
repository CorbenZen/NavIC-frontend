import { ShieldCheck, UserRound } from 'lucide-react';
import { Brand } from '../../components/common/Brand';
import { SignUpForm } from '../../components/forms';

/** Shared account creation layout; release details come from backend metadata. */
export function SignUp({ meta, navigate = () => {} }) {
  return (
    <div className="login-screen">
      <aside className="login-aside">
        <Brand />

        <div className="login-copy">
          <h1>
            Create your <em>NavIC account</em>.
          </h1>
          <p>
            Register as a student or teacher with a unique User ID and password. Your account is stored in the CBTMS
            database and is ready to use immediately — no email verification is required.
          </p>
          <div className="login-points">
            <div className="login-point">
              <UserRound />
              Student and teacher account types
            </div>
            <div className="login-point">
              <ShieldCheck />
              Passwords are salted and hashed on the server
            </div>
          </div>
        </div>

        <div className="login-foot">{meta?.application || 'NavIC CBTMS'} v{meta?.version || '—'} · {meta?.environment || 'unknown environment'}</div>
      </aside>

      <section className="login-panel">
        <div className="login-card">
          <SignUpForm
            navigate={navigate}
            onRegistered={(userId) =>
              navigate(`/sign-in?user_id=${encodeURIComponent(userId)}&registered=1`)
            }
          />
        </div>
      </section>
    </div>
  );
}
