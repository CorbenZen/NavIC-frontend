import { useState } from 'react';
import { ArrowRight, UserRound } from 'lucide-react';
import { api } from '@services/api';

export function Onboarding({ user, onComplete }) {
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [usn, setUsn] = useState(user?.usn || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const updated = await api.updateUserProfile({ full_name: fullName.trim(), phone: phone.trim(), department: department.trim(), usn: usn.trim() || null });
      onComplete(updated);
    } catch (err) {
      setError(err.message || 'Could not save your profile. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="onboarding-screen">
      <section className="onboarding-card">
        <div className="onboarding-heading">
          {user?.avatar_url ? <img className="onboarding-avatar" src={user.avatar_url} alt="Profile picture" /> : <div className="onboarding-avatar onboarding-avatar-fallback"><UserRound /></div>}
          <div>
            <span className="onboarding-eyebrow">NAVIC · PROFILE SETUP</span>
            <h1>Complete your profile</h1>
            <p>Add a few details to finish setting up your account.</p>
          </div>
        </div>
        <div className="onboarding-account">
          <strong>{user?.full_name || 'Your account'}</strong>
          <span>{user?.email || user?.user_id}</span>
        </div>
        <form className="onboarding-form" onSubmit={submit}>
          <label>Full name<input required maxLength="200" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
          <label>Contact phone number<input required type="tel" minLength="7" maxLength="32" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label>Department<input required maxLength="120" placeholder="e.g. Computer Science" value={department} onChange={(event) => setDepartment(event.target.value)} /></label>
          <label>USN <span className="onboarding-optional">(optional)</span><input maxLength="64" value={usn} onChange={(event) => setUsn(event.target.value)} /></label>
          <div className="onboarding-role"><span>Assigned access</span><strong>{user?.role || 'viewer'}</strong><small>Access is assigned by NavIC administrators.</small></div>
          {error ? <div className="login-error" role="alert">{error}</div> : null}
          <button className="btn btn-primary onboarding-submit" type="submit" disabled={busy}>{busy ? 'Saving profile…' : 'Complete Profile & Continue'} {!busy && <ArrowRight size={16} />}</button>
        </form>
      </section>
    </main>
  );
}
