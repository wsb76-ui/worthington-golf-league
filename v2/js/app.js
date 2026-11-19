import { fetchLive, loadLeagueJson, loadVerifiedWeeks, mergeWeeks } from './api.js';
import { setAsOf } from './format.js';
import { bindHome, isLeagueNight, refreshWeather, renderHome } from './home.js';
import { bindIdentity, renderIdentity } from './identity.js';
import { bindLive, renderLiveSheet } from './live.js';
import { previewLive } from './live-preview.js';
import { bindResults, renderGroup, renderResults } from './results.js';
import { bindSchedule, bindSignup, renderDay, renderOuting, renderSchedule } from './schedule.js';
import { bindCardType, bindSaveFav, bindScore, renderCardType, renderSaveFav, renderScore } from './scorecard.js';
import { bindStandings, renderStandings } from './standings.js';
import { renderNews } from './news.js';
import { bindRoster, renderPlayer, renderRoster } from './roster.js';
import { renderMy } from './my.js';
import { bindSettings, enablePush, renderSettings } from './settings.js';
import { bindGps, renderElev, renderGps } from './gps.js';
import { setDesired } from './gps-watch.js';
import { commit, go, initialScreen, state, subscribe } from './state.js';

const params = new URLSearchParams(location.search);
state.previewLive = params.get('preview') === 'live';
setAsOf(params.get('asof'));
state.screen = initialScreen();
if (state.session.started && state.session.players.length) state.scoreMode = 'hole';
if (!location.hash) history.replaceState(null, '', '#/' + state.screen);

function safe(label, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(label, err);
    return '<div class="page sheet-page"><h1 class="serif t-display">This screen hit a snag</h1><p class="t-small mt8">Pull to refresh. The rest of the app is still there.</p></div>';
  }
}

function draw() {
  const screen = document.getElementById('screen');
  const overlay = document.getElementById('overlay');
  if (!screen) return;
  const y = screen.scrollTop;
  screen.classList.toggle('is-gps', state.screen === 'gps');
  if (state.status === 'loading') {
    screen.innerHTML = '<div class="splash"><img src="./assets/crest.png" alt=""><div class="serif">Worthington Golf League</div></div>';
  } else if (state.status === 'error') {
    screen.innerHTML = '<div class="page sheet-page"><h1 class="serif t-display">Can\'t reach the league</h1><p class="t-small mt8"></p><button class="btn forest mt16" id="retry" type="button">Try again</button></div>';
    screen.querySelector('.t-small').textContent = state.syncLabel || 'Offline';
    screen.querySelector('#retry').addEventListener('click', boot);
  } else if (state.screen === 'home') {
    screen.innerHTML = safe('home', renderHome);
    bindHome(screen);
  } else if (state.screen === 'score') {
    screen.innerHTML = safe('score', renderScore);
    bindScore(screen);
  } else if (state.screen === 'gps') {
    screen.innerHTML = safe('gps', renderGps);
    bindGps(screen);
  } else if (state.screen === 'standings') {
    screen.innerHTML = safe('standings', renderStandings);
    bindStandings(screen);
  } else if (state.screen === 'results') {
    screen.innerHTML = safe('results', renderResults);
    bindResults(screen);
  } else if (state.screen === 'schedule') {
    screen.innerHTML = safe('schedule', renderSchedule);
    bindSchedule(screen);
  } else if (state.screen === 'news') {
    screen.innerHTML = safe('news', renderNews);
  } else if (state.screen === 'roster') {
    screen.innerHTML = safe('roster', renderRoster);
    bindRoster(screen);
  } else if (state.screen === 'my') {
    screen.innerHTML = safe('my', renderMy);
  } else if (state.screen === 'settings') {
    screen.innerHTML = safe('settings', renderSettings);
    bindSettings(screen);
  }
  bindGo(screen);
  overlay.innerHTML = safe('sheet', renderOverlay);
  bindOverlay(overlay);
  const watching = state.screen === 'gps' || (state.screen === 'score' && state.scoreMode === 'hole');
  setDesired(watching);
  if (state.status === 'ready' && state.screen !== 'home' && state.screen !== 'gps') screen.scrollTop = y;
}

function bindGo(root) {
  root.querySelectorAll('[data-go]').forEach(b => {
    if (b.dataset.boundGo) return;
    b.dataset.boundGo = '1';
    b.addEventListener('click', () => {
      if (b.dataset.go === 'results') state.resultsWeek = null;
      go(b.dataset.go);
    });
  });
}

function renderOverlay() {
  if (!state.sheet) return '';
  if (state.sheet === 'live') return renderLiveSheet();
  if (state.sheet === 'identity') return renderIdentity();
  if (state.sheet === 'cardtype') return renderCardType();
  if (state.sheet === 'signup' || state.sheet === 'outing') return renderOuting();
  if (state.sheet === 'day') return renderDay();
  if (state.sheet === 'player') return renderPlayer();
  if (state.sheet === 'elev') return renderElev();
  if (state.sheet === 'group') return renderGroup();
  if (state.sheet === 'savefav') return renderSaveFav();
  if (state.sheet === 'welcome') return renderWelcome();
  if (state.sheet === 'alerts') return renderAlerts();
  return '';
}

function bindOverlay(root) {
  if (!state.sheet) return;
  root.querySelectorAll('[data-close-sheet]').forEach(el => {
    el.addEventListener('click', ev => {
      if (ev.target === el) commit({ sheet: null });
    });
  });
  if (state.sheet === 'identity') bindIdentity(root);
  if (state.sheet === 'cardtype') bindCardType(root);
  if (state.sheet === 'signup' || state.sheet === 'outing' || state.sheet === 'day') bindSignup(root);
  if (state.sheet === 'savefav') bindSaveFav(root);
  if (state.sheet === 'welcome') bindWelcome(root);
  if (state.sheet === 'alerts') bindAlerts(root);
  if (state.sheet === 'live') bindLive(root);
}

subscribe(draw);

async function boot() {
  try {
    const [verified, loaded] = await Promise.all([loadVerifiedWeeks(), loadLeagueJson()]);
    commit({
      league: loaded.json,
      weeks: mergeWeeks(verified, loaded.json),
      verified,
      status: 'ready',
      syncLabel: loaded.source === 'cache' ? 'Offline copy' : ('Updated ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }))
    });
  } catch (err) {
    commit({ status: 'error', syncLabel: err.message || 'Offline' });
  }
  refreshWeather();
  refreshLive();
  maybeWelcome();
}

let liveStamp = '';
async function refreshLive() {
  const night = !!(state.league && isLeagueNight(state.league));
  if (!night && !state.previewLive) {
    if (state.live) commit({ live: null, liveStatus: 'off' });
    return;
  }
  const remote = await fetchLive();
  if (remote) {
    const stamp = JSON.stringify(remote);
    if (stamp !== liveStamp) {
      liveStamp = stamp;
      commit({ live: remote, liveStatus: 'ok' });
    }
    return;
  }
  const published = state.league && state.league.live;
  if (published && published.live === true) {
    commit({ live: published, liveStatus: 'published' });
    return;
  }
  if (state.previewLive && (!state.live || !state.live.sample)) {
    commit({ live: previewLive(), liveStatus: 'sample' });
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshLive();
});
setInterval(() => {
  if (document.visibilityState === 'visible') refreshLive();
}, 45000);

window.addEventListener('hashchange', () => {
  const screen = initialScreen();
  commit({ screen, sheet: null });
});

function renderAlerts() {
  return `<div class="modal-scrim"><div class="modal" role="dialog">
    <div class="serif t-head">League alerts</div>
    <p class="t-small mt8">Get a nudge on league night. These stay inside this v2 install until it replaces the main app.</p>
    <button class="btn forest mt16" type="button" data-action="alerts-on">Turn on notifications</button>
    <button class="text-btn mt8" type="button" data-action="alerts-skip">Not now</button>
    <p id="push-note" class="t-small mt8"></p>
  </div></div>`;
}

function bindAlerts(root) {
  const on = root.querySelector('[data-action=alerts-on]');
  const skip = root.querySelector('[data-action=alerts-skip]');
  if (on) on.addEventListener('click', () => enablePush(root));
  if (skip) skip.addEventListener('click', () => commit({ sheet: null }));
}

function maybeWelcome() {
  let done = false;
  try { done = localStorage.getItem('wgl_welcome_done') === '1'; } catch { /* ignore */ }
  if (!done && !state.identity && state.status === 'ready') commit({ sheet: 'welcome' });
}

export function renderWelcome() {
  const names = Object.keys((state.league && state.league.players) || {}).sort((a, b) => a.localeCompare(b));
  const opts = '<option value="">Pick your name</option>' + names.map(n => `<option value="${n.replace(/"/g, '&quot;')}">${n.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</option>`).join('');
  return `<div class="modal-scrim"><div class="modal" role="dialog">
    <div class="serif t-head">Welcome to WGL</div>
    <p class="t-small mt8">Pick your name once. It stays on this phone and unlocks your stats.</p>
    <select id="welcome-name" class="search mt16">${opts}</select>
    <button class="btn forest mt16" type="button" data-action="welcome-save">That's me</button>
    <button class="text-btn mt8" type="button" data-action="welcome-skip">Skip for now</button>
  </div></div>`;
}

export function bindWelcome(root) {
  const save = root.querySelector('[data-action=welcome-save]');
  const skip = root.querySelector('[data-action=welcome-skip]');
  if (save) save.addEventListener('click', () => {
    const name = root.querySelector('#welcome-name').value;
    if (!name) return;
    try {
      localStorage.setItem('wgl_identity', name);
      localStorage.setItem('wgl_welcome_done', '1');
    } catch { /* ignore */ }
    commit({ identity: name, sheet: 'alerts' });
  });
  if (skip) skip.addEventListener('click', () => {
    try { localStorage.setItem('wgl_welcome_done', '1'); } catch { /* ignore */ }
    commit({ sheet: 'alerts' });
  });
}

const screenEl = document.getElementById('screen');
let pullY = 0;
if (screenEl) {
  screenEl.addEventListener('touchstart', e => {
    if (screenEl.scrollTop <= 0) pullY = e.touches[0].clientY;
  }, { passive: true });
  screenEl.addEventListener('touchend', e => {
    if (pullY && e.changedTouches[0].clientY - pullY > 70 && screenEl.scrollTop <= 0) boot();
    pullY = 0;
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) nw.postMessage({ type: 'SKIP_WAITING' });
      });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

draw();
boot();
