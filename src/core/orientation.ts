const OVERLAY_ID = 'orientationOverlay';
const BODY_LOCK_CLASS = 'orientation-lock-active';
const LANDSCAPE_QUERY = '(orientation: landscape)';
const TARGET_ORIENTATION = 'landscape';

let overlay: HTMLDivElement | null = null;
let lastKnownPortrait = false;

function ignorePromiseRejection(result: unknown) {
  if (result && typeof (result as PromiseLike<unknown>).catch === 'function') {
    (result as PromiseLike<unknown>).catch(() => {});
  }
}

function tryLock(call: () => unknown) {
  try {
    const result = call();
    ignorePromiseRejection(result);
  } catch (err) {
    if (import.meta.env.DEV) {
      // Surface orientation lock issues during development for easier diagnosis.
      console.debug('Orientation lock attempt skipped:', err);
    }
  }
}

function isLandscape(): boolean {
  if (window.matchMedia && window.matchMedia(LANDSCAPE_QUERY).matches) {
    return true;
  }
  return window.innerWidth >= window.innerHeight;
}

function ensureOverlay(): HTMLDivElement | null {
  if (overlay) return overlay;
  const existing = document.getElementById(OVERLAY_ID);
  if (existing instanceof HTMLDivElement) {
    overlay = existing;
  } else {
    const element = document.createElement('div');
    element.id = OVERLAY_ID;
    element.innerHTML = '<p class="orientation-message">Rotate your device to landscape to play.</p>';
    document.body.appendChild(element);
    overlay = element;
  }
  return overlay;
}

function updateOverlayState() {
  const element = ensureOverlay();
  const portrait = !isLandscape();
  if (element) {
    element.style.display = portrait ? 'flex' : 'none';
  }
  if (portrait !== lastKnownPortrait) {
    document.body.classList.toggle(BODY_LOCK_CLASS, portrait);
    lastKnownPortrait = portrait;
  }
}

type OrientationLegacyLock = (orientation: string) => Promise<void> | boolean;

type ScreenWithOrientation = Screen & {
  orientation?: ScreenOrientation & { lock?: (orientation: OrientationLockType | string) => Promise<void> };
  lockOrientation?: OrientationLegacyLock;
  mozLockOrientation?: OrientationLegacyLock;
  msLockOrientation?: OrientationLegacyLock;
};

function attemptLock() {
  const screenWithLock = window.screen as ScreenWithOrientation;
  const screenOrientation = screenWithLock.orientation;
  if (screenOrientation && typeof screenOrientation.lock === 'function') {
    tryLock(() => screenOrientation.lock(TARGET_ORIENTATION as OrientationLockType));
    return;
  }

  const legacyLock =
    screenWithLock.lockOrientation || screenWithLock.mozLockOrientation || screenWithLock.msLockOrientation;
  if (typeof legacyLock === 'function') {
    tryLock(() => legacyLock.call(screenWithLock, TARGET_ORIENTATION));
  }
}

export function initOrientationHandling() {
  ensureOverlay();
  updateOverlayState();
  window.addEventListener('resize', updateOverlayState, { passive: true });
  window.addEventListener('orientationchange', () => {
    updateOverlayState();
    attemptLock();
  });
  attemptLock();
}

export function requestLandscapeLock() {
  try {
    attemptLock();
  } catch (err) {
    if (import.meta.env.DEV) {
      console.debug('Orientation lock request failed:', err);
    }
  }
}
