/*
 * Top-bar "Install app" control. Uses the captured `beforeinstallprompt` event
 * on Chromium browsers and shows Add-to-Home-Screen steps on iOS Safari.
 * Hidden when the app already runs installed (standalone) or install is not offered.
 */
import { useRef, useState, useSyncExternalStore } from 'react';
import { Download, Share } from 'lucide-react';
import { ShellPopover, ShellTooltip } from './ShellPopover';
import { canPromptInstall, isIosSafari, isStandalone, promptInstall, subscribeInstallPrompt } from '../../utils/installPrompt';

export function InstallAppButton() {
  const available = useSyncExternalStore(subscribeInstallPrompt, canPromptInstall, () => false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const triggerRef = useRef(null);
  const ios = isIosSafari();

  if (isStandalone() || (!available && !ios)) return null;

  const handleClick = () => {
    setTooltipOpen(false);
    if (available) promptInstall();
    else setIosHintOpen((open) => !open);
  };

  return <>
    <button
      ref={triggerRef}
      type="button"
      className="btn btn-sm install-app-btn"
      onClick={handleClick}
      onMouseEnter={() => setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
      onFocus={() => setTooltipOpen(true)}
      onBlur={() => setTooltipOpen(false)}
      aria-label="Install NavIC app"
      aria-describedby={tooltipOpen && !iosHintOpen ? 'install-app-tooltip' : undefined}
      aria-expanded={ios && !available ? iosHintOpen : undefined}
    >
      <Download size={16} aria-hidden="true" />
      <span className="install-app-label">Install</span>
    </button>
    <ShellTooltip id="install-app-tooltip" triggerRef={triggerRef} open={tooltipOpen && !iosHintOpen} label="Install CBTMS NavIC as an app" placement="bottom-end" />
    {ios && !available ? (
      <ShellPopover id="install-app-ios-hint" triggerRef={triggerRef} open={iosHintOpen} onClose={() => setIosHintOpen(false)} placement="bottom-end" role="dialog" className="install-ios-hint" label="Install on iPhone or iPad">
        <p>To install NavIC, tap <Share size={14} aria-label="Share" /> <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</p>
      </ShellPopover>
    ) : null}
  </>;
}
