import { AlertTriangle, Mail, MailCheck, RefreshCw } from 'lucide-react';
import { Brand } from '../../components/common/Brand';

/**
 * Landing screen for a magic-link verification attempt.
 *
 * `App.jsx` owns the token exchange; this component only renders the four
 * verification states and the recovery actions.
 */
export function VerifyEmailLink({ state, verificationMode = 'magic', message, email, onContinue, onRequestNew }) {
  const verifyingEmail = verificationMode === 'email';
  return (
    <div className="verify-screen">
      <div className="verify-card" aria-live="polite">
        <Brand />
        {state === 'checking' ? (
          <>
            <div className="login-sent-icon">
              <Mail />
            </div>
            <h1>Verifying your sign-in link</h1>
            <p>{verifyingEmail ? 'Please wait while NavIC verifies your email and signs you in.' : 'Please wait while the API validates this single-use link and creates your secure session.'}</p>
            <div className="loading-block" style={{ justifyContent: 'center', padding: '8px 0 0' }}>
              <span className="spinner" /> Checking link…
            </div>
          </>
        ) : state === 'success' ? (
          <>
            <div className="login-sent-icon success">
              <MailCheck />
            </div>
            <h1>{verifyingEmail ? 'Email verified' : 'Signed in'}</h1>
            <p>{verifyingEmail ? 'Your email is verified and your secure session is active. Opening the fleet overview…' : 'Your session is active. Opening the fleet overview…'}</p>
          </>
        ) : (
          <>
            <div className="login-sent-icon danger">
              <AlertTriangle />
            </div>
            <h1>{verifyingEmail ? 'This verification link cannot be used' : 'This link cannot be used'}</h1>
            <p>{message || (verifyingEmail ? 'The verification link is invalid, expired, or has already been used.' : 'The sign-in link is invalid, expired, or has already been used.')}</p>
            {email ? <p className="small muted">Requested for {email}</p> : null}
            <div className="stack" style={{ gap: 10, marginTop: 8 }}>
              <button type="button" className="btn btn-primary" onClick={onRequestNew} style={{ minHeight: 42 }}>
                <RefreshCw /> {verifyingEmail ? 'Return to sign in' : 'Request a new sign-in link'}
              </button>
              {onContinue ? (
                <button type="button" className="btn" onClick={onContinue}>
                  Return to sign in
                </button>
              ) : null}
            </div>
            <div className="login-note">
              For your security, each link expires after a short time and can only be used once. Never forward a sign-in link.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
