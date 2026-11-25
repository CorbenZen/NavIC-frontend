import { AlertTriangle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Field } from './Field';
import { signIn } from '@services/authentication/authService';

/**
 * Sign-in form for the primary User ID + password flow.
 *
 * The form performs no mock authentication: every submission reaches
 * ``POST /api/auth/login`` and the returned user is handed to ``App.jsx``.
 */
export function SignInForm({
  onAuthenticated,
  initialUserId = '',
  navigate = () => {},
}) {
  const [userId, setUserId] = useState(initialUserId);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!userId.trim() || !password) {
      setError('Please enter your ID and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await signIn(userId.trim(), password);
      setPassword('');
      onAuthenticated?.(result.user);
    } catch (requestError) {
      setError(requestError.message || 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="eyebrow">Account access</div>
      <h2>Sign in to CBTMS</h2>
      <p>Enter the User ID and password you chose when creating your NavIC account.</p>

      <form className="login-form" onSubmit={submit} noValidate>
        {error ? (
          <div className="login-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <Field label="User ID">
          <input
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
            required
            maxLength={254}
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="e.g. NAVIC001"
            aria-describedby="user-id-help"
          />
        </Field>
        <Field label="Password">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                background: 'var(--surface)',
                color: 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '40px',
                height: '40px',
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
        <p className="hint" id="user-id-help">
          Administrators can enter their administrator email address in the User ID field.
        </p>

        <button type="submit" className="btn btn-primary" disabled={busy} style={{ minHeight: 42, marginTop: 4 }}>
          {busy ? 'Signing in…' : 'Sign In'}
          {!busy ? <ArrowRight /> : null}
        </button>
      </form>

      <div className="auth-switch">
        New to NavIC?{' '}
        <button type="button" className="auth-link" onClick={() => navigate('/sign-up')}>
          Create Account
        </button>
      </div>
    </>
  );
}
