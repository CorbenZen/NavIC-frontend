/*
 * Shared application frame: responsive sidebar, breadcrumbs, global status,
 * theme and account actions. Fleet state is read once through useFleet and
 * passed to the navigation so every badge reflects the existing store.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Search, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { useFleet } from '../hooks/useFleet';
import { useSidebarState } from '../hooks/useSidebarState';
import { NAV_GROUPS, routeMeta } from '../utils/navigation';
import { selectDeviceAttention } from '../utils/deviceAttention';
import { cx } from '../components/common';
import { UserMenu } from '../components/navigation/AccountMenu';
import { ThemeSelector } from '../components/navigation/ThemeSelector';
import { InstallAppButton } from '../components/navigation/InstallAppButton';
import { ShellTooltip } from '../components/navigation/ShellPopover';
import { CommandPalette } from '../components/navigation/CommandPalette';
import { Sidebar } from '../components/navigation/Sidebar';
import { searchShortcutLabel } from '../utils/searchShortcut';

function StatusHint({ id, label, className, children }) {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  return <>
    <span
      ref={triggerRef}
      className={className}
      tabIndex={0}
      aria-label={label}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >{children}</span>
    <ShellTooltip id={id} triggerRef={triggerRef} open={open} label={label} placement="bottom-end" />
  </>;
}

function SearchHintButton({ onClick }) {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const tooltipId = 'topbar-search-tooltip';
  return <>
    <button
      ref={triggerRef}
      type="button"
      className="icon-btn command-palette-trigger"
      onClick={onClick}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-label="Open command palette"
      aria-describedby={open ? tooltipId : undefined}
    ><Search /></button>
    <ShellTooltip id={tooltipId} triggerRef={triggerRef} open={open} label={`Search pages and fleet (${searchShortcutLabel()})`} placement="bottom-end" />
  </>;
}

export function Shell({ path, navigate, user, meta, onLogout, children }) {
  const { summary, tracking, devices, wsState, unreadAlerts, lastUpdated, apiStatus, apiUrl, retryBackend, demoSimulation } = useFleet();
  const sidebarState = useSidebarState();
  const { isMobile, isMobileOpen, isCollapsed, closeMobile, setCollapsed, toggleMobile } = sidebarState;
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [freshnessClock, setFreshnessClock] = useState(0);
  const sidebarRef = useRef(null);
  const hamburgerRef = useRef(null);
  const topbarSentinelRef = useRef(null);
  const [topbarScrolled, setTopbarScrolled] = useState(false);
  const metaInfo = routeMeta(path);
  const activeGroup = NAV_GROUPS.find((group) => group.items.some((item) => item.path === path)) || NAV_GROUPS[0];
  const groupTarget = activeGroup.items.find((item) => item.path !== path)?.path || '/';
  const deviceAttention = useMemo(() => selectDeviceAttention(devices).count, [devices]);
  const simulated = Number(summary?.simulation?.simulated_fixes || 0) > 0 || Number(summary?.simulation?.simulated_devices || 0) > 0;
  const hasFreshPosition = freshnessClock > 0 && tracking.some((row) => {
    const timestamp = Date.parse(row.timestamp || '');
    const age = freshnessClock - timestamp;
    return Number.isFinite(timestamp) && age >= 0 && age <= 120000 && row.latitude != null && row.longitude != null;
  });

  const closeDrawer = useCallback(() => {
    closeMobile();
    requestAnimationFrame(() => hamburgerRef.current?.focus());
  }, [closeMobile]);

  useEffect(() => {
    const timer = window.setInterval(() => setFreshnessClock(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // A 1px sentinel lets the sticky bar react to page scroll without a high-rate listener.
  useEffect(() => {
    const sentinel = topbarSentinelRef.current;
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(([entry]) => setTopbarScrolled(!entry.isIntersecting), { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Close the mobile drawer only when the route actually changes. Reacting to
  // isMobileOpen itself would close the drawer the instant it opened.
  const previousPathRef = useRef(path);
  useEffect(() => {
    if (previousPathRef.current === path) return;
    previousPathRef.current = path;
    if (isMobile && isMobileOpen) closeDrawer();
  }, [path, isMobile, isMobileOpen, closeDrawer]);

  useEffect(() => {
    if (!isMobile || !isMobileOpen) return undefined;
    const focusFirst = requestAnimationFrame(() => {
      sidebarRef.current?.querySelector('a[href], button:not([disabled])')?.focus();
    });
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(sidebarRef.current?.querySelectorAll('a[href], button:not([disabled])') || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.classList.add('sidebar-scroll-locked');
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFirst);
      document.body.classList.remove('sidebar-scroll-locked');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile, isMobileOpen, closeDrawer]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const go = (next) => {
    navigate(next);
    if (isMobile) closeDrawer();
  };
  const wsLabel = apiStatus === 'offline' ? 'API offline' : apiStatus !== 'online' || wsState !== 'online' ? 'Reconnecting' : 'Connected';
  return (
    <div className={cx('app-shell', isCollapsed && !isMobile && 'sidebar-collapsed', isMobile && 'sidebar-mobile', isMobileOpen && 'sidebar-drawer-open')}>
      <Sidebar
        path={path} role={user?.role} collapsed={isCollapsed} mobileOpen={isMobileOpen}
        isMobile={isMobile} unreadAlerts={unreadAlerts} deviceAttention={deviceAttention}
        wsState={wsState} connectionStatus={wsLabel} hasFreshPosition={apiStatus === 'online' && hasFreshPosition}
        lastUpdated={lastUpdated} user={user} onLogout={onLogout} onNavigate={go}
        onCloseDrawer={closeDrawer} onSearch={() => setIsCommandPaletteOpen(true)}
        onToggleCollapsed={() => setCollapsed((collapsed) => !collapsed)} sidebarRef={sidebarRef}
      />

      <div className="main-shell">
        <span ref={topbarSentinelRef} className="topbar-sentinel" aria-hidden="true" />
        <header className="topbar" data-scrolled={topbarScrolled || undefined}>
          <button
            ref={hamburgerRef} type="button" className="icon-btn mobile-menu"
            onClick={toggleMobile} aria-label={isMobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isMobileOpen} aria-controls="primary-navigation"
          >
            {isMobileOpen ? <ChevronLeft /> : <Menu />}
          </button>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <ol>
              {isMobile ? null : <li><a href="/" onClick={(event) => { event.preventDefault(); go('/'); }}>CBTMS</a></li>}
              <li><ChevronRight /><a href={groupTarget} onClick={(event) => { event.preventDefault(); go(groupTarget); }}>{activeGroup.label}</a></li>
              <li><ChevronRight /><span aria-current="page">{metaInfo.title}</span></li>
            </ol>
          </nav>
          <div className="topbar-actions" inert={isMobile && isMobileOpen}>
            <div className="topbar-status-group" role="group" aria-label="Connection and data status">
              {meta?.demo_auth_bypass ? <StatusHint id="demo-auth-tooltip" className="topbar-badge demo-auth-warning" label="Demo access · auth off. Authentication is disabled in this mode.">Demo access · auth off</StatusHint> : null}
              {simulated ? <StatusHint id="simulation-tooltip" className="topbar-badge is-warning compact-status" label="Simulation mode · data comes from the simulator, not real hardware">Simulation mode</StatusHint> : null}
              {demoSimulation?.running ? (
                <StatusHint
                  id="simulation-running-tooltip"
                  className={cx('topbar-badge', 'is-warning', 'compact-status', 'pulse')}
                  label={`Demo simulation running · ${demoSimulation.speed_multiplier || 1}× speed · ${demoSimulation.devices?.length || 0} vehicles`}
                >
                  <Zap size={12} style={{ marginRight: 4, animation: 'pulse 1s infinite' }} />
                  <span style={{ fontWeight: 600 }}>Simulation running</span>
                  <span className="topbar-badge-pill" style={{ background: 'var(--warning)', color: '#000', padding: '0 6px', borderRadius: 9999, fontSize: 11, marginLeft: 6 }}>
                    {demoSimulation.speed_multiplier || 1}×
                  </span>
                </StatusHint>
              ) : null}
              <StatusHint id="live-link-tooltip" className={cx('live-chip', 'compact-status', wsLabel === 'Connected' ? 'online' : wsLabel === 'API offline' ? 'offline' : 'reconnecting')} label={`API and WebSocket status · ${wsLabel}`}><span className="live-dot" /><span>{wsLabel}</span></StatusHint>
            </div>
            <span className="topbar-divider" aria-hidden="true" />
            <div className="topbar-controls">
              <InstallAppButton />
              <ThemeSelector />
              <SearchHintButton onClick={() => setIsCommandPaletteOpen(true)} />
              {user ? <UserMenu key={path} user={user} onLogout={onLogout} variant="topbar" /> : null}
            </div>
          </div>
        </header>
        {apiStatus === 'offline' ? <div className="backend-offline-banner" role="status">
          <span>Backend unreachable, retrying...</span>
          <details><summary>Connection details</summary><code>GET {apiUrl}</code></details>
          <button type="button" className="btn btn-sm" onClick={retryBackend}>Retry</button>
        </div> : null}
        <main className={cx('content', metaInfo.flush && 'flush')} data-api-state={apiStatus} inert={isMobile && isMobileOpen}>{children}</main>
      </div>
      {isCommandPaletteOpen ? <CommandPalette onClose={() => setIsCommandPaletteOpen(false)} navigate={navigate} /> : null}
    </div>
  );
}
