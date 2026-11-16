/* Theme control backed by the shared preference store and shell popover layer. */
import { useCallback, useId, useRef, useState } from 'react';
import { Check, Sun, Moon, Monitor } from 'lucide-react';
import { cx } from '../common/cx';
import { useTheme } from '../../context/ThemeContext';
import { ShellPopover, ShellTooltip } from './ShellPopover';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeSelector() {
  const [open, setOpen] = useState(false);
  const [focusFirst, setFocusFirst] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const triggerRef = useRef(null);
  const menuId = `theme-menu-${useId().replaceAll(':', '')}`;
  const closeMenu = useCallback((restore) => {
    setOpen(false);
    if (restore) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const handleChange = (value) => {
    setTheme(value);
    setOpen(false);
  };

  const currentTheme = THEMES.find(t => t.value === theme);
  const CurrentIcon = currentTheme?.icon || Sun;

  return (
    <div className="theme-selector">
      <button
        ref={triggerRef}
        type="button"
        className={cx('icon-btn theme-trigger', open && 'open')}
        onClick={(event) => { setFocusFirst(event.detail === 0); setOpen((value) => !value); }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label="Theme selector"
        aria-describedby={tooltipOpen && !open ? 'theme-control-tooltip' : undefined}
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
        onFocus={() => setTooltipOpen(true)}
        onBlur={() => setTooltipOpen(false)}
      >
        {theme === 'system' ? resolvedTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} /> : <CurrentIcon size={18} />}
      </button>
      <ShellTooltip id="theme-control-tooltip" triggerRef={triggerRef} open={tooltipOpen && !open} label={`Current theme: ${currentTheme?.label || theme}${theme === 'system' ? ` (system: ${resolvedTheme})` : ''}`} placement="bottom-end" />
      <ShellPopover id={menuId} triggerRef={triggerRef} open={open} onClose={closeMenu} autoFocusFirst={focusFirst} placement="bottom-end" className="theme-dropdown" label="Select theme">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-label={theme === value ? `${label}, current theme` : label}
            className={cx('theme-option', theme === value && 'selected')}
            onClick={() => handleChange(value)}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
            {theme === value && <Check className="checkmark" aria-hidden="true" />}
          </button>
        ))}
      </ShellPopover>
    </div>
  );
}
