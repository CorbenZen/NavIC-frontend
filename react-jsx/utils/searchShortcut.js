/**
 * Return the platform label shown beside search controls.
 * Using the browser platform keeps Fedora and Windows from inheriting the
 * Command key glyph just because the app runs in Chromium.
 */
export function searchShortcutLabel() {
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  return /mac/i.test(platform) ? '⌘K' : 'Ctrl K';
}
