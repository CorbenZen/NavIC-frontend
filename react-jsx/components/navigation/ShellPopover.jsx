/*
 * Shared portal surface for shell menus and compact navigation tooltips.
 * Triggers stay in the sidebar/topbar; content is positioned against their
 * measured rectangles and painted under document.body to escape glass clips.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

let activeMenuId = null;
let activeTooltipId = null;

/**
 * Measure and clamp a fixed popover against its trigger and the viewport.
 * Capturing document scroll catches nested scrollers without adding listeners
 * to every ancestor that may move the trigger.
 */
export function usePopoverPosition(triggerRef, panelRef, { open, placement = 'bottom-end', offset = 8 }) {
  const [style, setStyle] = useState({ left: -10000, top: -10000, visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const anchor = trigger.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      const viewportWidth = Math.min(document.documentElement.clientWidth || window.innerWidth, window.visualViewport?.width || window.innerWidth);
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const edge = 8;
      const maxHeight = Math.max(120, viewportHeight - edge * 2);
      const narrow = viewportWidth < 640;
      let left = anchor.right - box.width;
      let top = anchor.bottom + offset;
      let width;

      if (narrow) {
        width = Math.max(0, viewportWidth - 24);
        left = 12;
        if (top + box.height > viewportHeight - edge) top = anchor.top - box.height - offset;
      } else if (placement === 'right-end') {
        const sidebarEdge = trigger.closest('#primary-navigation')?.getBoundingClientRect().right;
        left = Math.max(anchor.right, sidebarEdge ?? anchor.right) + offset;
        top = anchor.bottom - box.height;
        if (left + box.width > viewportWidth - edge) left = (sidebarEdge ?? anchor.left) - box.width - offset;
      } else if (placement === 'top-start') {
        left = anchor.left;
        top = anchor.top - box.height - offset;
        if (top < edge) top = anchor.bottom + offset;
      } else if (placement === 'right') {
        left = anchor.right + offset;
        top = anchor.top + anchor.height / 2 - box.height / 2;
        if (left + box.width > viewportWidth - edge) left = anchor.left - box.width - offset;
      } else if (top + box.height > viewportHeight - edge && anchor.top - box.height - offset >= edge) {
        top = anchor.top - box.height - offset;
      }

      left = Math.min(Math.max(edge, left), viewportWidth - edge - (width ?? box.width));
      top = Math.min(Math.max(edge, top), viewportHeight - edge - Math.min(box.height, maxHeight));
      setStyle({ left, top, width, maxHeight, visibility: 'visible' });
    };

    update();
    let frameId = 0;
    const frame = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(update);
    };
    window.addEventListener('resize', frame, { passive: true });
    document.addEventListener('scroll', frame, { capture: true, passive: true });
    window.visualViewport?.addEventListener('resize', frame, { passive: true });
    window.visualViewport?.addEventListener('scroll', frame, { passive: true });
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', frame);
      document.removeEventListener('scroll', frame, true);
      window.visualViewport?.removeEventListener('resize', frame);
      window.visualViewport?.removeEventListener('scroll', frame);
    };
  }, [triggerRef, panelRef, open, placement, offset]);

  return style;
}

/**
 * Portal a menu or tooltip above shell surfaces. A portal avoids the fixed-
 * positioning containing block created by backdrop-filter on glass elements.
 */
export function ShellPopover({
  id, triggerRef, open, onClose, placement, offset, className = '', role = 'menu',
  label, kind = 'menu', autoFocusFirst = false, children,
}) {
  const panelRef = useRef(null);
  const style = usePopoverPosition(triggerRef, panelRef, { open, placement, offset });

  useEffect(() => {
    if (!open || !autoFocusFirst || role !== 'menu') return undefined;
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector('[role="menuitem"]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, autoFocusFirst, role]);

  useEffect(() => {
    if (!open) return undefined;
    if (kind === 'menu') {
      activeMenuId = id;
      document.dispatchEvent(new CustomEvent('cbtms:menu-open', { detail: id }));
    } else if (kind === 'tooltip') {
      activeTooltipId = id;
      document.dispatchEvent(new CustomEvent('cbtms:tooltip-open', { detail: id }));
    }
    const closeOther = (event) => {
      if (event.detail !== id && kind === 'menu') onClose?.(false);
      if (kind === 'tooltip') onClose?.(false);
    };
    const outside = (event) => {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) onClose?.(false);
    };
    const escape = (event) => {
      if (event.key === 'Escape' && kind === 'menu') {
        event.preventDefault();
        onClose?.(true);
      } else if (event.key === 'Tab' && triggerRef.current?.contains(document.activeElement)) {
        onClose?.(false);
      }
    };
    document.addEventListener('cbtms:menu-open', closeOther);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('cbtms:menu-open', closeOther);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      if (kind === 'menu' && activeMenuId === id) {
        activeMenuId = null;
        document.dispatchEvent(new CustomEvent('cbtms:menu-close', { detail: id }));
      }
      if (kind === 'tooltip' && activeTooltipId === id) {
        activeTooltipId = null;
        document.dispatchEvent(new CustomEvent('cbtms:tooltip-close', { detail: id }));
      }
    };
  }, [id, kind, onClose, open, triggerRef]);

  if (!open || typeof document === 'undefined') return null;

  const handleKeyDown = (event) => {
    if (role !== 'menu') return;
    if (event.key === 'Tab') {
      onClose?.(false);
      return;
    }
    const items = [...(panelRef.current?.querySelectorAll('[role="menuitem"]') || [])];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    let next = null;
    if (event.key === 'ArrowDown') next = (current + 1 + items.length) % items.length;
    if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next !== null) {
      event.preventDefault();
      items[next].focus();
    }
  };

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      className={`shell-popover ${className}`}
      role={role}
      aria-label={label}
      data-placement={placement}
      style={style}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Compact labels use the same measured glass surface as shell menus. */
export function ShellTooltip({ id, triggerRef, open, label, placement = 'right' }) {
  const closeTooltip = useCallback(() => {}, []);
  const [menuOpen, setMenuOpen] = useState(activeMenuId !== null);
  const [activeTooltip, setActiveTooltip] = useState(activeTooltipId);
  useEffect(() => {
    const opened = () => setMenuOpen(true);
    const closed = () => setMenuOpen(false);
    const tooltipOpened = (event) => setActiveTooltip(event.detail);
    const tooltipClosed = () => setActiveTooltip(null);
    document.addEventListener('cbtms:menu-open', opened);
    document.addEventListener('cbtms:menu-close', closed);
    document.addEventListener('cbtms:tooltip-open', tooltipOpened);
    document.addEventListener('cbtms:tooltip-close', tooltipClosed);
    return () => {
      document.removeEventListener('cbtms:menu-open', opened);
      document.removeEventListener('cbtms:menu-close', closed);
      document.removeEventListener('cbtms:tooltip-open', tooltipOpened);
      document.removeEventListener('cbtms:tooltip-close', tooltipClosed);
    };
  }, []);
  // activeMenuId is module state so a tooltip cannot appear during menu focus.
  const visible = open && !menuOpen && activeMenuId === null
    && (activeTooltip === null || activeTooltip === id)
    && (activeTooltipId === null || activeTooltipId === id);
  return <ShellPopover id={id} triggerRef={triggerRef} open={visible} onClose={closeTooltip} placement={placement} offset={9} className="shell-tooltip" role="tooltip" kind="tooltip">{label}</ShellPopover>;
}
