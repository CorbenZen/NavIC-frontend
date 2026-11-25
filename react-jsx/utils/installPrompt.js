/*
 * PWA install prompt store. Chromium browsers fire `beforeinstallprompt` once,
 * often before React mounts, so this module captures it at import time (it is
 * imported from main.jsx) and lets components subscribe to availability.
 * Safari/iOS never fires the event; `isIosSafari` lets the UI show manual
 * "Add to Home Screen" guidance there instead.
 */
let deferredPrompt = null;
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIos && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Suppress the browser mini-infobar; the app shows its own Install button.
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function canPromptInstall() {
  return deferredPrompt !== null;
}

export function subscribeInstallPrompt(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shows the native install dialog. Resolves to 'accepted', 'dismissed' or 'unavailable'. */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  const promptEvent = deferredPrompt;
  // A prompt event can only be used once.
  deferredPrompt = null;
  notify();
  promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  return outcome;
}
