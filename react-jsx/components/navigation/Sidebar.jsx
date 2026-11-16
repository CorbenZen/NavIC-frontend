/*
 * Main navigation drawer and its brand, search, sections, and live footer.
 * Route labels come from navigation.js; status counts and connection state
 * come from FleetContext through Shell, with no sidebar-owned data polling.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { UserMenu } from './AccountMenu';
import { ShellTooltip } from './ShellPopover';
import { cx } from '../common';
import { navGroupsForRole } from '../../utils/navigation';
import { timeAgo } from '../../utils/format';
import { searchShortcutLabel } from '../../utils/searchShortcut';

function SidebarBrand({ collapsed }) {
  return (
    <div className="sidebar-brand-row">
      <a className="sidebar-brand" href="/" aria-label="CBTMS dashboard">
        <span className="sidebar-brand-tile">
          <img src={`${import.meta.env.BASE_URL}${collapsed ? 'tab.png' : 'images/logo.png'}`} alt="" />
        </span>
        <span className="sidebar-brand-copy"><strong>CBTMS</strong><small>Fleet tracking</small></span>
      </a>
    </div>
  );
}

function SidebarSearchTrigger({ collapsed, onSearch }) {
  const triggerRef = useRef(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipId = 'sidebar-search-tooltip';
  const shortcut = searchShortcutLabel();
  return <>
    <button
      ref={triggerRef}
      className="sidebar-search"
      type="button"
      onClick={onSearch}
      aria-label={`Search pages and fleet (${shortcut})`}
      aria-describedby={collapsed && tooltipOpen ? tooltipId : undefined}
      onMouseEnter={() => setTooltipOpen(collapsed)}
      onMouseLeave={() => setTooltipOpen(false)}
      onFocus={() => setTooltipOpen(collapsed)}
      onBlur={() => setTooltipOpen(false)}
    >
      <Search aria-hidden="true" />
      <span>{collapsed ? 'Search' : 'Search pages, vehicles…'}</span>
      {!collapsed ? <kbd>{shortcut}</kbd> : null}
    </button>
    <ShellTooltip id={tooltipId} triggerRef={triggerRef} open={collapsed && tooltipOpen} label={`Search pages and fleet (${shortcut})`} />
  </>;
}

function SidebarItem({ item, path, collapsed, unreadAlerts, deviceAttention, wsConnected, onNavigate }) {
  const triggerRef = useRef(null);
  const tooltipId = `sidebar-tooltip-${item.path.replaceAll('/', '-') || 'dashboard'}`;
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const Icon = item.icon;
  const active = item.path === path;
  const badgeValue = item.path === '/alerts' ? unreadAlerts : item.path === '/devices' ? deviceAttention : 0;
  const live = item.path === '/tracking' && wsConnected;
  const displayedCount = badgeValue > 99 ? '99+' : String(badgeValue);
  const accessibleCount = item.path === '/alerts'
    ? `${displayedCount} unread`
    : `${displayedCount} need attention`;

  return <>
    <a
      ref={triggerRef}
      href={item.path}
      className={cx('nav-item', active && 'active')}
      onClick={(event) => { event.preventDefault(); onNavigate(item.path); }}
      onMouseEnter={() => setTooltipOpen(collapsed)}
      onMouseLeave={() => setTooltipOpen(false)}
      onFocus={() => setTooltipOpen(collapsed)}
      onBlur={() => setTooltipOpen(false)}
      aria-current={active ? 'page' : undefined}
      aria-describedby={collapsed && tooltipOpen ? tooltipId : undefined}
      aria-label={badgeValue > 0 ? `${item.label}, ${accessibleCount}` : undefined}
    >
      <Icon aria-hidden="true" />
      <span className="nav-item-label">{item.label}</span>
      {live ? <span className="nav-live-dot" title="Connected with fresh vehicle positions" aria-label="Live tracking connected with fresh positions" /> : null}
      {badgeValue > 0 ? (
        <span className="nav-badge" aria-hidden="true">
          {badgeValue > 99 ? '99+' : badgeValue}
        </span>
      ) : null}
    </a>
    <ShellTooltip id={tooltipId} triggerRef={triggerRef} open={collapsed && tooltipOpen} label={badgeValue > 0 ? `${item.label}, ${accessibleCount}` : item.label} />
  </>;
}

function SidebarSection({ group, path, collapsed, unreadAlerts, deviceAttention, wsConnected, onNavigate }) {
  const id = `sidebar-group-${group.key}`;
  return (
    <section className="nav-group" aria-labelledby={id}>
      <h2 className="nav-label" id={id}>{group.label}</h2>
      {group.items.map((item) => <SidebarItem
        key={item.path} item={item} path={path} collapsed={collapsed}
        unreadAlerts={unreadAlerts} deviceAttention={deviceAttention} wsConnected={wsConnected}
        onNavigate={onNavigate}
      />)}
    </section>
  );
}

function SidebarFooter({ wsState, connectionStatus, lastUpdated, user, onLogout, path, collapsed }) {
  const [, setNow] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(interval);
  }, []);

  const stateLabel = connectionStatus || (wsState === 'online' ? 'Connected' : 'Offline');
  const connected = stateLabel === 'Connected';
  const connecting = stateLabel === 'Reconnecting';
  return (
    <footer className={cx('sidebar-footer glass-surface', collapsed && 'is-rail-footer')}>
      <div className="sidebar-status-row" title={`Backend and WebSocket: ${stateLabel}`} aria-label={`Backend and WebSocket ${stateLabel}`}>
        <span className={cx('sidebar-status-indicator', connected ? 'is-online' : connecting ? 'is-pending' : 'is-offline')} aria-hidden="true" />
        <span className="sidebar-footer-label">{stateLabel}</span>
      </div>
      {lastUpdated ? <small className="sidebar-refreshed" aria-live="off">Updated {timeAgo(lastUpdated)}</small> : null}
      {user ? <UserMenu key={path} user={user} onLogout={onLogout} variant="sidebar" collapsed={collapsed} statusLabel={stateLabel} /> : null}
    </footer>
  );
}

export function Sidebar({
  path, role, collapsed, mobileOpen, isMobile, unreadAlerts, deviceAttention, wsState, connectionStatus,
  hasFreshPosition, lastUpdated, user, onLogout, onNavigate, onCloseDrawer, onSearch,
  onToggleCollapsed, sidebarRef,
}) {
  const groups = useMemo(() => navGroupsForRole(role), [role]);
  const hidden = isMobile ? !mobileOpen : false;
  const navRef = useRef(null);
  const collapseRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);
  const [collapseTooltipOpen, setCollapseTooltipOpen] = useState(false);
  const lastPathRef = useRef(path);

  // Measure the active anchor so one shared marker can slide between sections.
  // It stays inside the scrolling nav, so it follows the menu without affecting layout.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const update = () => {
      setCanScroll(nav.scrollHeight > nav.clientHeight + 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [collapsed, isMobile, mobileOpen, groups]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const firstLayout = lastPathRef.current === path;
    lastPathRef.current = path;
    if (firstLayout) nav.scrollTop = 0;
    const frame = requestAnimationFrame(() => {
      const active = nav.querySelector('a[aria-current="page"]');
      if (!active) return;
      const navRect = nav.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      // Keep the nav at its beginning on mount; later routes move only when their item is clipped.
      if (activeRect.top < navRect.top || activeRect.bottom > navRect.bottom) {
        active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [path, groups]);

  return (
    <>
      {isMobile && mobileOpen ? <button className="sidebar-scrim" type="button" onClick={onCloseDrawer} aria-label="Close navigation" /> : null}
      <aside ref={sidebarRef} id="primary-navigation" className={cx('sidebar', collapsed && !isMobile && 'is-rail', mobileOpen && isMobile && 'is-drawer-open')} aria-hidden={hidden || undefined} inert={hidden}>
        <div className="sidebar-header">
          <SidebarBrand collapsed={collapsed && !isMobile} />
          {!isMobile ? (
            <button
              ref={collapseRef}
              className="sidebar-collapse-edge"
              type="button"
              onClick={onToggleCollapsed}
              aria-label={`${collapsed ? 'Expand' : 'Collapse'} sidebar (Ctrl+B)`}
              aria-describedby={collapseTooltipOpen ? 'sidebar-collapse-tooltip' : undefined}
              aria-expanded={!collapsed}
              onMouseEnter={() => setCollapseTooltipOpen(true)}
              onMouseLeave={() => setCollapseTooltipOpen(false)}
              onFocus={() => setCollapseTooltipOpen(true)}
              onBlur={() => setCollapseTooltipOpen(false)}
            >
              {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
            </button>
          ) : null}
          {!isMobile ? <ShellTooltip id="sidebar-collapse-tooltip" triggerRef={collapseRef} open={collapseTooltipOpen} label={`${collapsed ? 'Expand' : 'Collapse'} sidebar (Ctrl+B)`} /> : null}
        </div>
        <SidebarSearchTrigger collapsed={collapsed && !isMobile} onSearch={onSearch} />
        <nav ref={navRef} className="sidebar-nav" aria-label="Main" data-scrollable={canScroll || undefined}>
          {groups.map((group) => (
            <SidebarSection
              key={group.key} group={group} path={path} collapsed={collapsed && !isMobile}
              unreadAlerts={unreadAlerts} deviceAttention={deviceAttention}
              wsConnected={connectionStatus === 'Connected' && hasFreshPosition} onNavigate={onNavigate}
            />
          ))}
        </nav>
        <SidebarFooter wsState={wsState} connectionStatus={connectionStatus} lastUpdated={lastUpdated} user={user} onLogout={onLogout} path={path} collapsed={collapsed && !isMobile} />
      </aside>
    </>
  );
}
