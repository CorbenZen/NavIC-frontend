/* Shared account menu and account service dialogs used from both shell locations. */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { BadgeCheck, BusFront, ChevronDown, CircleHelp, FileText, LogOut, MessageSquareText, Settings2, UserRound, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@services/api';
import { DialogPortal } from '../modals';
import { Avatar, Badge } from '../common';
import { initial } from '@react/utils/format';
import { useTheme } from '../../context/ThemeContext';
import { ShellPopover, ShellTooltip } from './ShellPopover';

const OPTIONS = [
  ['profile', UserRound, 'Profile'], ['pass', BusFront, 'Bus Pass'], ['feedback', MessageSquareText, 'Feedback'],
  ['support', CircleHelp, 'CBTMS Support'], ['settings', Settings2, 'Settings'], ['terms', FileText, 'Terms & Conditions'],
];

function Modal({ title, onClose, children, wide = false, returnFocusRef }) {
  return <DialogPortal overlayClassName="service-modal-backdrop" dialogClassName="service-modal" labelledBy="service-modal-title" onClose={onClose} returnFocusRef={returnFocusRef} wide={wide}>
      <header><h2 id="service-modal-title">{title}</h2><button className="icon-btn" type="button" onClick={onClose} aria-label="Close dialog"><X /></button></header>
      <div className="service-modal-body">{children}</div>
  </DialogPortal>;
}

function ProfilePanel({ user }) {
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '', department: user?.department || '', usn: user?.usn || '' });
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const change = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); setNotice(''); try { await api.updateUserProfile({ ...form, usn: form.usn || null }); setNotice('Profile updated.'); } catch (failure) { setError(failure.message); } finally { setBusy(false); } }
  return <form className="service-form" onSubmit={submit}>
    <div className="profile-summary">{user?.avatar_url ? <img src={user.avatar_url} alt="" /> : <span>{initial(user?.full_name || user?.email)}</span>}<div><b>{user?.full_name || 'NavIC user'}</b><small>{user?.active === false ? 'Inactive' : 'Active account'}</small></div></div>
    <label>Full name<input value={form.full_name} maxLength="200" required onChange={change('full_name')} /></label>
    <label>Email address<input value={user?.email || ''} readOnly /></label>
    <label>Phone number<input value={form.phone} maxLength="32" onChange={change('phone')} /></label>
    <label>Department<input value={form.department} maxLength="120" onChange={change('department')} /></label>
    <label>USN / Student ID<input value={form.usn} maxLength="64" onChange={change('usn')} /></label>
    <div className="service-readonly"><span>Role</span><b>{user?.role || 'user'}</b><span>Account</span><b>{user?.active === false ? 'Inactive' : 'Active'}</b></div>
    {notice && <p className="service-success" role="status">{notice}</p>}{error && <p className="service-error" role="alert">{error}</p>}
    <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
  </form>;
}

function PassPanel() {
  const [loading, setLoading] = useState(true); const [pass, setPass] = useState(null); const [error, setError] = useState(''); const [verification, setVerification] = useState(null);
  useEffect(() => { let alive = true; api.busPass().then((result) => { if (alive) setPass(result?.pass || null); }).catch((failure) => { if (alive) setError(failure.message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, []);
  async function verify() { try { const token = new URL(pass.verification_url).pathname.split('/').at(-1); setVerification(await api.verifyBusPass(token)); } catch (failure) { setVerification({ valid: false, status: failure.message || 'Could not verify' }); } }
  if (loading) return <div className="service-loading">Loading your bus pass…</div>;
  if (error) return <p className="service-error" role="alert">{error}</p>;
  if (!pass) return <div className="service-empty"><BusFront /><b>No bus pass is linked to your account</b><span>If you need a pass, contact CBTMS Support. No route or vehicle assignment is currently available.</span></div>;
  const status = pass.status;
  return <div className="digital-pass">
    <div className="digital-pass-head"><div><small>{pass.college_name}</small><h3>Student Bus Pass</h3></div><Badge tone={status === 'ACTIVE' ? 'success' : status === 'EXPIRED' ? 'danger' : 'warning'}>{status}</Badge></div>
    <div className="digital-pass-content"><div className="pass-fields"><div><small>Student</small><b>{pass.student_name || '—'}</b></div><div><small>USN / Student ID</small><b>{pass.usn || '—'}</b></div><div><small>Route</small><b>{pass.route_name || 'Unassigned'}</b></div><div><small>Bus</small><b>{pass.bus_registration || 'Unassigned'}</b></div><div><small>Expires</small><b>{pass.expires_at ? new Date(pass.expires_at).toLocaleDateString() : '—'}</b></div></div>
      <div className="pass-qr"><QRCodeSVG value={pass.verification_url} size={132} level="M" includeMargin /><small>Scan to verify pass</small></div></div>
    <button type="button" className="btn" onClick={verify}><BadgeCheck size={16} /> Verify pass</button>
    {verification && <p className={verification.valid ? 'service-success' : 'service-error'} role="status">{verification.valid ? `Pass verified · ${verification.status}` : `Pass is ${verification.status}`}</p>}
  </div>;
}

function FeedbackPanel() {
  const [rating, setRating] = useState(5); const [category, setCategory] = useState('Bus Service'); const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false); const [success, setSuccess] = useState(false); const [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await api.submitFeedback({ rating, category, comments }); setSuccess(true); } catch (failure) { setError(failure.message); } finally { setBusy(false); } }
  if (success) return <p className="service-success" role="status">Thank you. Your feedback has been recorded.</p>;
  return <form className="service-form" onSubmit={submit}><label>Rating<select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} star{n !== 1 ? 's' : ''}</option>)}</select></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{['Bus Service','Driver Behaviour','Route','Tracking Accuracy','Application Issue','Other'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Comments<textarea value={comments} minLength="3" maxLength="3000" required rows="5" onChange={(event) => setComments(event.target.value)} /></label>{error && <p className="service-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send feedback'}</button></form>;
}

function SupportPanel() {
  const [info, setInfo] = useState(null); const [category, setCategory] = useState('Application'); const [priority, setPriority] = useState('NORMAL');
  const [subject, setSubject] = useState(''); const [description, setDescription] = useState(''); const [contact, setContact] = useState('');
  const [ticket, setTicket] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { api.supportInfo().then(setInfo).catch(() => setInfo({})); }, []);
  async function submit(event) { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { const result = await api.submitSupport({ subject, category, description, priority, contact: contact || null }); setTicket(result.ticket_id); } catch (failure) { setError(failure.message); } finally { setBusy(false); } }
  return <div><div className="support-faq"><b>Common help</b><details><summary>My bus is not appearing on the map</summary><p>Check that your route and bus are assigned, then contact support if live tracking remains unavailable.</p></details><details><summary>How do I request a bus pass?</summary><p>Submit a support ticket under Bus Pass with your USN and route details.</p></details><p>Contact: {info?.email || 'Email not configured'} · {info?.phone || 'Phone not configured'}</p></div>
    {ticket ? <div className="service-success" role="status">Request received. Your ticket number is <strong>{ticket}</strong>.</div> : <form className="service-form" onSubmit={submit}><label>Subject<input required minLength="3" maxLength="180" value={subject} onChange={(e) => setSubject(e.target.value)} /></label><label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{['Account','Bus Pass','Tracking','Application','Other'].map((x) => <option key={x}>{x}</option>)}</select></label><label>Priority<select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option></select></label><label>Description<textarea required minLength="10" maxLength="4000" rows="4" value={description} onChange={(e) => setDescription(e.target.value)} /></label><label>Contact (optional)<input type="email" maxLength="254" value={contact} onChange={(e) => setContact(e.target.value)} /></label>{error && <p className="service-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Create support ticket'}</button></form>}</div>;
}

function PreferencesPanel() {
  const defaults = { in_app_notifications: true, bus_arrivals: true, route_deviations: true, default_map_view: 'streets', default_map_zoom: 12 };
  const [values, setValues] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    api.userPreferences().then((result) => setValues({ ...defaults, ...result })).catch((failure) => setError(failure.message));
  }, []);

  const set = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const result = await api.saveUserPreferences(values);
      setValues({ ...defaults, ...result });
      setSaved(true);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const handleThemeChange = async (event) => {
    const newTheme = event.target.value;
    await setTheme(newTheme);
  };

  return <form className="service-form" onSubmit={submit}>
    <fieldset><legend>Notifications</legend>{[['in_app_notifications','In-app notifications'],['bus_arrivals','Bus arrival notifications'],['route_deviations','Route deviation notifications']].map(([key,label]) => <label className="preference-toggle" key={key}><span>{label}</span><input type="checkbox" checked={values[key]} onChange={(e) => set(key, e.target.checked)} /></label>)}</fieldset>
    <label>Default map view<select value={values.default_map_view} onChange={(e) => set('default_map_view', e.target.value)}><option value="streets">Streets</option><option value="satellite">Satellite</option></select></label>
    <label>Default map zoom <small>{values.default_map_zoom}</small><input type="range" min="4" max="19" value={values.default_map_zoom} onChange={(e) => set('default_map_zoom', Number(e.target.value))} /></label>
    <label>Theme<select value={theme} onChange={handleThemeChange}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
    {saved && <p className="service-success" role="status">Preferences saved.</p>}
    {error && <p className="service-error" role="alert">{error}</p>}
    <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button>
  </form>;
}

function TermsPanel() {
  const [terms, setTerms] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api.terms().then(setTerms).catch((failure) => setError(failure.message)); }, []);
  if (error) return <p className="service-error">{error}</p>;
  if (!terms) return <div className="service-loading">Loading policy text…</div>;
  return <div className="terms-panel">{terms.approval_required && <p className="terms-draft">Draft wording — institutional approval required before production use.</p>}{terms.sections.map((section) => <section key={section.title}><h3>{section.title}</h3><p>{section.body}</p></section>)}</div>;
}

export function UserMenu({ user, onLogout, variant = 'topbar', collapsed = false, statusLabel }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const [focusFirst, setFocusFirst] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const chipRef = useRef(null);
  const menuId = `user-menu-${useId().replaceAll(':', '')}`;
  const displayName = user?.full_name || user?.username || user?.email || 'Account';
  const statusTone = statusLabel === 'Connected' ? 'online' : statusLabel === 'Reconnecting' ? 'pending' : 'offline';
  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => chipRef.current?.focus());
  }, []);

  const item = OPTIONS.find(([key]) => key === active);
  return <>
    <div className={`account-menu user-menu user-menu-${variant}`}>
      <button
        ref={chipRef}
        type="button"
        className="user-chip account-chip"
        data-sidebar-status={variant === 'sidebar' && collapsed ? statusTone : undefined}
        onMouseEnter={() => setTooltipOpen(variant === 'sidebar' && collapsed)}
        onMouseLeave={() => setTooltipOpen(false)}
        onFocus={() => setTooltipOpen(variant === 'sidebar' && collapsed)}
        onBlur={() => setTooltipOpen(false)}
        aria-label={`Account menu for ${displayName}${variant === 'sidebar' && collapsed ? `. WebSocket ${statusLabel}` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(event) => { setFocusFirst(event.detail === 0); setOpen((value) => !value); }}
      >
        <Avatar name={user?.full_name || user?.username || user?.email || 'User'} src={user?.avatar_url} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        <span className="user-chip-meta"><b>{displayName}</b><span>{user?.role || 'Role not reported'}</span></span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {variant === 'sidebar' && collapsed ? <ShellTooltip id={`${menuId}-status`} triggerRef={chipRef} open={tooltipOpen && !open} label={`WebSocket ${statusLabel}`} placement="right" /> : null}
      <ShellPopover id={menuId} triggerRef={chipRef} open={open} onClose={closeMenu} autoFocusFirst={focusFirst} placement={variant === 'sidebar' ? collapsed ? 'right-end' : 'top-start' : 'bottom-end'} offset={variant === 'sidebar' ? collapsed ? 12 : 8 : 8} className={`account-dropdown user-menu-panel${variant === 'sidebar' ? ' is-sidebar-menu' : ''}`} kind="menu" label="Account menu">
        <div className="shell-menu-header">
          <Avatar name={user?.full_name || user?.username || user?.email || 'User'} src={user?.avatar_url} className="shell-menu-avatar" />
          <span><strong>{displayName}</strong><small>{user?.role || 'Role not reported'}</small>{user?.email ? <small>{user.email}</small> : null}</span>
        </div>
        {OPTIONS.map(([key, Icon, label]) => <button type="button" role="menuitem" tabIndex={-1} key={key} onClick={() => { setActive(key); closeMenu(false); }}><Icon aria-hidden="true" />{label}</button>)}
        <div className="shell-menu-separator" role="separator" />
        <button type="button" role="menuitem" tabIndex={-1} className="is-danger" onClick={() => { closeMenu(false); onLogout?.(); }}><LogOut aria-hidden="true" />Sign out</button>
      </ShellPopover>
    </div>
    {item && <Modal title={item[2]} onClose={() => setActive('')} returnFocusRef={chipRef} wide={active === 'pass' || active === 'support' || active === 'terms'}>
      {active === 'profile' && <ProfilePanel user={user} />}{active === 'pass' && <PassPanel />}{active === 'feedback' && <FeedbackPanel />}{active === 'support' && <SupportPanel />}{active === 'settings' && <PreferencesPanel />}{active === 'terms' && <TermsPanel />}
    </Modal>}
  </>;
}
