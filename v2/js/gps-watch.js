// The only module that talks to geolocation or the screen wake lock.
// Screens call setDesired(); they do not start watches themselves.

const listeners = new Set();
let watchId = null;
let desired = false;
let last = null;
let altEma = null;
let boostUntil = 0;
let lastEmit = 0;
let status = 'off';

function emit() {
  for (const fn of listeners) fn(snapshot());
}

function snapshot() {
  return { fix: last, altMeters: altEma, status, boosted: Date.now() < boostUntil };
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(snapshot());
  return () => listeners.delete(fn);
}

export function snapshotNow() {
  return snapshot();
}

function onFix(pos) {
  last = pos;
  const alt = pos.coords.altitude;
  const acc = pos.coords.altitudeAccuracy;
  if (alt != null && (acc == null || acc <= 20)) {
    altEma = altEma == null ? alt : 0.7 * altEma + 0.3 * alt;
  }
  status = 'live';
  const now = Date.now();
  const interval = now < boostUntil ? 0 : 5000;
  if (now - lastEmit >= interval) {
    lastEmit = now;
    emit();
  }
}

function onError(err) {
  status = err && err.code === 1 ? 'denied' : 'error';
  emit();
  stop();
}

function start() {
  if (watchId != null || !navigator.geolocation) {
    if (!navigator.geolocation) { status = 'unsupported'; emit(); }
    return;
  }
  status = 'acquiring';
  emit();
  watchId = navigator.geolocation.watchPosition(onFix, onError, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 1000
  });
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(lock => {
      lock.addEventListener('release', () => { if (watchId != null) startLock(lock); });
      startLock(lock);
    }).catch(() => {});
  }
}

let wake = null;
function startLock(lock) { wake = lock; }

function stop() {
  if (watchId != null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (wake) {
    wake.release().catch(() => {});
    wake = null;
  }
  boostUntil = 0;
  if (status === 'live' || status === 'acquiring') status = desired ? 'paused' : 'off';
  emit();
}

export function setDesired(on) {
  desired = !!on;
  if (desired && document.visibilityState === 'visible') start();
  else stop();
}

export function boost() {
  boostUntil = Date.now() + 15000;
  lastEmit = 0;
  if (last) onFix(last);
}

export function poke() {
  lastEmit = 0;
  if (last) emit();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') stop();
  else if (desired) start();
});
