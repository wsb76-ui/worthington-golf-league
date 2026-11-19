const listeners = new Set();

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* private mode */ }
}

function readIdentity() {
  return storageGet('wgl_identity') || '';
}

function blankSession() {
  return {
    players: [],
    scores: {},
    hole: 0,
    side: 'back',
    cardType: 'league_night',
    targetDate: null,
    started: false,
    completedSegments: []
  };
}

function readSession() {
  try {
    const raw = storageGet('wgl2_session');
    if (!raw) return blankSession();
    const s = JSON.parse(raw);
    return { ...blankSession(), ...s, players: s.players || [], scores: s.scores || {} };
  } catch {
    return blankSession();
  }
}

export const state = {
  league: null,
  weeks: {},
  verified: {},
  status: 'loading',
  screen: 'home',
  standingsView: 'teams',
  resultsOpen: false,
  identity: readIdentity(),
  session: readSession(),
  scoreMode: 'setup',
  live: null,
  liveStatus: 'idle',
  previewLive: false,
  sheet: null,
  cardTypeStep: 1,
  weather: null,
  syncLabel: ''
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let scheduled = false;
export function commit(patch) {
  if (patch) Object.assign(state, patch);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    for (const fn of listeners) fn(state);
  });
}

export function saveSession() {
  storageSet('wgl2_session', JSON.stringify(state.session));
}

export function setIdentity(name) {
  const value = name || '';
  storageSet('wgl_identity', value || null);
  commit({ identity: value, sheet: null });
}

export function resetSession() {
  state.session = blankSession();
  saveSession();
  commit({ scoreMode: 'setup' });
}

export function readFavs() {
  try { return JSON.parse(storageGet('wgl2_favs') || '[]'); } catch { return []; }
}

export function saveFav(name) {
  const favs = readFavs().filter(f => f.name !== name);
  favs.unshift({
    name,
    side: state.session.side,
    players: state.session.players.map(p => p.name)
  });
  storageSet('wgl2_favs', JSON.stringify(favs.slice(0, 5)));
}

export function cacheLeague(json) {
  storageSet('wgl2_league_cache', JSON.stringify(json));
}

export function readLeagueCache() {
  try { return JSON.parse(storageGet('wgl2_league_cache') || 'null'); } catch { return null; }
}

export function initialScreen() {
  const m = (location.hash || '').match(/^#\/(home|score|standings|results|schedule)$/);
  return m ? m[1] : 'home';
}

export function go(screen) {
  const next = '#/' + screen;
  if (location.hash !== next) location.hash = next;
  commit({ screen, sheet: state.sheet === 'live' && screen !== 'score' ? null : state.sheet });
}
