import { useCallback, useEffect, useState } from 'react';

const SIDEBAR_STORAGE_KEY = 'cbtms-sidebar-collapsed';

function readSavedCollapse() {
  try {
    const value = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return value === null ? null : value === 'true';
  } catch {
    return null;
  }
}

/**
 * Owns the sidebar's responsive, persisted state. Saved rail preference only
 * applies at desktop widths; small screens always start with the drawer closed.
 */
export function useSidebarState() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = readSavedCollapse();
    return saved ?? window.matchMedia('(min-width: 768px) and (max-width: 1279px)').matches;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const setCollapsed = useCallback((value) => {
    setIsCollapsed((previous) => {
      const next = typeof value === 'function' ? value(previous) : value;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // The sidebar remains usable when browser storage is disabled.
      }
      return next;
    });
  }, []);
  const openMobile = useCallback(() => setIsMobileOpen(true), []);
  const closeMobile = useCallback(() => setIsMobileOpen(false), []);
  const toggleMobile = useCallback(() => setIsMobileOpen((open) => !open), []);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)');
    const compact = window.matchMedia('(max-width: 1279px)');
    const update = () => {
      setIsMobile(mobile.matches);
      if (mobile.matches) setIsMobileOpen(false);
      else {
        const saved = readSavedCollapse();
        if (saved === null) setIsCollapsed(compact.matches);
      }
    };
    mobile.addEventListener?.('change', update);
    compact.addEventListener?.('change', update);
    return () => {
      mobile.removeEventListener?.('change', update);
      compact.removeEventListener?.('change', update);
    };
  }, []);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        if (!isMobile) setCollapsed((collapsed) => !collapsed);
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [isMobile, setCollapsed]);

  return {
    isMobile,
    isCollapsed,
    isMobileOpen,
    setCollapsed,
    openMobile,
    closeMobile,
    toggleMobile,
  };
}
