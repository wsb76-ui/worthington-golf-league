import { HOLES } from './course.js';
import { html, initials, money, raw, toParText } from './format.js';
import { scrim } from './ui.js';
import { commit, state } from './state.js';

export function holeStat(live, hole) {
  if (!live || !live.holes) return null;
  return live.holes[String(hole)] || live.holes[hole] || null;
}

export function renderBestStrip(hole) {
  const live = state.live;
  if (!live) return '';
  const stat = holeStat(live, hole);
  const count = stat && stat.count ? stat.count : 0;
  const groups = stat && stat.groups ? stat.groups : 0;
  const best = stat && stat.best != null ? stat.best : null;
  const label = best == null
    ? 'No scores on #' + hole + ' yet'
    : html`Best on #${hole} tonight: <b>${best}</b> · ${count} player${count === 1 ? '' : 's'}`;
  const side = groups ? (groups + ' group' + (groups === 1 ? '' : 's') + ' in') : '';
  return `<button class="best" type="button" data-action="live-sheet">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B5542B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4M6 4l11 4-11 4"/></svg>
    <span>${label && label.__raw ? label.__raw : label}</span>
    <span class="best-meta">${side}</span>
  </button>`;
}

function scoreColor(n) {
  if (n == null) return '';
  return n < 0 ? 'neg' : '';
}

export function renderLiveSheet() {
  const live = state.live || {};
  const board = live.board || [];
  const events = live.events || [];
  const posting = live.playersPosting != null ? live.playersPosting : board.length;
  const expected = live.playersExpected;
  const when = live.updatedLabel || clockLabel(live.updated);
  const week = live.week || (state.league && state.league.settings && state.league.settings.week) || '';
  const rows = board.map((p, i) => html`
    <div class="lr ${p.name === state.identity ? 'me' : ''}">
      <div class="rk num">${i + 1}</div>
      <div class="grow">
        <div class="who">${p.name}</div>
        <div class="t-small">Team ${p.team} · thru ${p.thruHole || p.thru}</div>
      </div>
      <div class="num score-lg ${scoreColor(p.toPar)}">${toParText(p.toPar)}</div>
    </div>`).join('');
  const feed = events.map(ev => html`
    <div class="ev2">
      <div class="ring num ${ev.kind === 'eagle' ? 'e' : ''}">${ev.hole}</div>
      <div class="grow">
        <div class="who sm">${ev.name}</div>
        <div class="t-small">${kindLine(ev)}</div>
      </div>
      <div class="t-small num">${ev.at || ''}</div>
    </div>`).join('');
  return scrim(html`
    <div class="grab" data-close-sheet></div>
    <div class="page row between">
      <div>
        <div class="row gap8"><span class="dot"></span><span class="t-label clay">Live · Week ${week}</span>
          ${live.sample ? raw('<span class="pill gold">Sample</span>') : ''}</div>
        <div class="serif t-title mt4">Live leaderboard</div>
      </div>
      <div class="t-small right">Updated ${when}<br>${posting}${expected ? ' of ' + expected : ''} players posting</div>
    </div>
    <div class="page row gap8 wrap mt12">
      <span class="pill gold">Birdies ${live.birdies || 0}</span>
      <span class="pill clay">Eagles ${live.eagles || 0}</span>
      ${live.bestTeam ? raw(`<span class="pill sage">Best team so far: T${Number(live.bestTeam)}</span>`) : ''}
    </div>
    <div class="row between page mt16">
      <span class="t-label">Low net · to par</span>
      <span class="t-small">holes played so far</span>
    </div>
    <div class="card inset">
      ${raw(rows || '<div class="empty">No cards posted yet tonight.</div>')}
    </div>
    <div class="page mt16"><span class="t-label">Birdies &amp; eagles · latest first</span></div>
    <div class="card inset">
      ${raw(feed || '<div class="empty">None yet.</div>')}
    </div>
    <div class="sheet-pad"></div>`);
}

function kindLine(ev) {
  const par = ev.par || (HOLES[ev.hole] && HOLES[ev.hole].par);
  const word = ev.kind === 'eagle' ? 'Eagle' : 'Birdie';
  const extra = ev.kind === 'eagle' && par ? ' · par ' + par : '';
  return word + ' ' + ev.score + ' on #' + ev.hole + extra;
}

function clockLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
}

export function bindLive(root) {
  root.querySelectorAll('[data-action=live-sheet]').forEach(btn => {
    btn.addEventListener('click', () => commit({ sheet: 'live' }));
  });
}

void initials;
void money;
