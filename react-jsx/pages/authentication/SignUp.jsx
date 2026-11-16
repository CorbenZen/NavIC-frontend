import { ShieldCheck, UserRound } from 'lucide-react';
import { Brand } from '../../components/common/Brand';
import { SignUpForm } from '../../components/forms';

export function SignUp({ navigate = () => {} }) {
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

        <div className="login-foot">NavIC CBTMS · Secure account registration</div>
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
