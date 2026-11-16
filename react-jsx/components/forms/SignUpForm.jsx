import { AlertTriangle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Field } from './Field';
import { registerAccount } from '@services/authentication/registrationService';

const USER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/;

/**
 * Registration form for the primary User ID + password flow.
 *
 * The USN field is rendered only for students and is mandatory there.  Teacher
 * accounts never submit a USN.  No email address is collected.
 */
export function SignUpForm({ onRegistered, navigate = () => {} }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [accountType, setAccountType] = useState('student');
  const [userId, setUserId] = useState('');
  const [usn, setUsn] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) return 'Please enter your first and second name.';
    if (!userId.trim()) return 'Please choose a User ID.';
    if (!USER_ID.test(userId.trim())) {
      return 'User ID must be 3-32 characters, start with a letter or digit, and contain only letters, digits, dots, underscores or hyphens.';
    }
    if (accountType === 'student' && !usn.trim()) return 'USN ID is required for student accounts.';
    if (!password) return 'Please enter a password.';
    if (password.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
    if (password.trim().toUpperCase() === userId.trim().toUpperCase()) {
      return 'Password must not be the same as your User ID.';
    }
    if (password !== confirmPassword) return 'Passwords do not match.';
    return '';
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await registerAccount({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        account_type: accountType,
        user_id: userId.trim().toUpperCase(),
        usn_id: accountType === 'student' ? usn.trim().toUpperCase() : null,
        password,
        confirm_password: confirmPassword,
      });
      setPassword('');
      setConfirmPassword('');
      onRegistered?.(result?.user?.user_id || userId.trim().toUpperCase());
    } catch (requestError) {
      setError(requestError.message || 'Could not create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="eyebrow">New account</div>
      <h2>Create Account</h2>
      <p>Choose a unique User ID and password. No email address is required.</p>

      <form className="login-form" onSubmit={submit} noValidate>
        {error ? (
          <div className="login-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="form-grid-two">
          <Field label="First Name">
            <input
              autoComplete="given-name"
              required
              maxLength={80}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </Field>
          <Field label="Second Name">
            <input
              autoComplete="family-name"
              required
              maxLength={80}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Account Type">
          <select
            value={accountType}
            onChange={(event) => {
              setAccountType(event.target.value);
              if (event.target.value === 'teacher') setUsn('');
              setError('');
            }}
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </Field>

        <Field label="User ID" hint="3-32 characters. This is your unique sign-in ID.">
          <input
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={32}
            value={userId}
            onChange={(event) => setUserId(event.target.value.toUpperCase())}
            placeholder="e.g. NAVIC001"
          />
        </Field>

        {accountType === 'student' ? (
          <Field label="USN ID" hint="Required for student accounts and unique per student.">
            <input
              required
              maxLength={64}
              value={usn}
              onChange={(event) => setUsn(event.target.value.toUpperCase())}
              placeholder="e.g. 1AB23CS045"
            />
          </Field>
        ) : null}

        <Field label="Password" hint="At least 8 characters and one letter.">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
        <Field label="Confirm Password">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
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

        <button type="submit" className="btn btn-primary" disabled={busy} style={{ minHeight: 42, marginTop: 4 }}>
          {busy ? 'Creating account…' : 'Create Account'}
          {!busy ? <ArrowRight /> : null}
        </button>
      </form>

      <div className="auth-switch">
        Already registered?{' '}
        <button type="button" className="auth-link" onClick={() => navigate('/sign-in')}>
          Sign In
        </button>
      </div>
    </>
  );
}
