import { SCORE_EMAIL } from './config.js';
import { HOLES, holesFor, parsFor, scoreRange, sideLabel, sideRange } from './course.js';
import { esc, html, raw, shortName, toParText } from './format.js';
import { calendarOf, isLeagueNight } from './home.js';
import { bindLive, renderBestStrip } from './live.js';
import { commit, go, readFavs, saveFav, saveSession, state } from './state.js';
import { postScript } from './api.js';
import { svg } from './ui.js';
import { attachStrip, gpsStripHtml, noteHole } from './gps.js';
import { todayISO } from './format.js';

let addOpen = false;
let addQuery = '';

function sess() { return state.session; }

function roster() {
  return (state.league && state.league.players) || {};
}

function persist() { saveSession(); }

export function renderScore() {
  if (state.submitNote) return renderSubmitted();
  if (!sess().players.length || state.scoreMode === 'setup') return renderSetup();
  if (state.scoreMode === 'review') return renderReview();
  return renderHole();
}

export function bindScore(root) {
  bindLive(root);
  root.querySelectorAll('[data-action=home]').forEach(b => b.addEventListener('click', () => go('home')));
  root.querySelectorAll('[data-action=review]').forEach(b => b.addEventListener('click', openReview));
  root.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => nav(+b.dataset.nav)));
  root.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => pick(+b.dataset.pi, +b.dataset.score)));
  root.querySelectorAll('[data-side]').forEach(b => b.addEventListener('click', () => setSide(b.dataset.side)));
  root.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removePlayer(+b.dataset.remove)));
  const start = root.querySelector('[data-action=start-round]');
  if (start) start.addEventListener('click', startRound);
  const fav = root.querySelector('[data-action=save-fav]');
  if (fav) fav.addEventListener('click', () => {
    const name = window.prompt('Name this group');
    if (name && name.trim()) saveFav(name.trim());
    commit();
  });
  const clear = root.querySelector('[data-action=clear]');
  if (clear) clear.addEventListener('click', () => {
    sess().players = [];
    sess().scores = {};
    sess().hole = 0;
    sess().started = false;
    sess().completedSegments = [];
    persist();
    commit({ scoreMode: 'setup' });
  });
  root.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', () => loadFav(+b.dataset.fav)));
  const search = root.querySelector('#setup-search');
  if (search) search.addEventListener('input', () => {
    const box = root.querySelector('#setup-results');
    if (box) box.innerHTML = searchResults(search.value);
    bindAdds(root);
  });
  const addBtn = root.querySelector('[data-action=add-toggle]');
  if (addBtn) addBtn.addEventListener('click', () => {
    addOpen = !addOpen;
    addQuery = '';
    commit();
  });
  const addSearch = root.querySelector('#add-search');
  if (addSearch) {
    addSearch.addEventListener('input', () => {
      addQuery = addSearch.value;
      const box = root.querySelector('#add-results');
      if (box) {
        box.innerHTML = searchResults(addQuery);
        bindAdds(root);
      }
    });
    addSearch.focus();
  }
  const back = root.querySelector('[data-action=back-hole]');
  if (back) back.addEventListener('click', () => commit({ scoreMode: 'hole' }));
  const submit = root.querySelector('[data-action=submit]');
  if (submit) submit.addEventListener('click', () => submitCard(root));
  const nine = root.querySelector('[data-action=second-nine]');
  if (nine) nine.addEventListener('click', addSecondNine);
  root.querySelectorAll('[data-purpose]').forEach(b => b.addEventListener('click', () => {
    const p = sess().players[+b.dataset.pi];
    if (!p) return;
    p.purpose = b.dataset.purpose;
    if (p.purpose !== 'league_night') p.targetDate = null;
    persist();
    commit();
  }));
  const gpsBtn = root.querySelector('[data-action=gps]');
  if (gpsBtn) gpsBtn.addEventListener('click', () => go('gps'));
  if (state.scoreMode === 'hole') attachStrip(root);
  const done = root.querySelector('[data-action=done]');
  if (done) done.addEventListener('click', () => {
    state.submitNote = '';
    commit({ scoreMode: 'setup' });
    go('home');
  });
  bindAdds(root);
}

function bindAdds(root) {
  root.querySelectorAll('[data-add-name]').forEach(b => {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', () => addPlayer(b.dataset.addName));
  });
}

function searchResults(q) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return '';
  const taken = new Set(sess().players.map(p => p.name));
  const hits = Object.entries(roster())
    .filter(([name]) => !taken.has(name) && name.toLowerCase().includes(query))
    .slice(0, 8);
  if (!hits.length) return '<div class="empty">No matching player</div>';
  return hits.map(([name, info]) => html`
    <button class="search-hit" type="button" data-add-name="${name}">
      <span>${name}</span><span class="t-small">T${info.team} · HCP ${info.hcp}</span>
    </button>`).join('');
}

function addPlayer(name) {
  const info = roster()[name];
  if (!info || sess().players.some(p => p.name === name)) return;
  const n = holesFor(sess().side).length;
  sess().players.push({
    name,
    team: info.team,
    hcp: +info.hcp || 0,
    purpose: sess().cardType || 'league_night',
    targetDate: sess().targetDate || null
  });
  sess().scores[name] = Array(n).fill(null);
  addQuery = '';
  addOpen = false;
  persist();
  commit();
}

function removePlayer(i) {
  const p = sess().players[i];
  if (!p) return;
  sess().players.splice(i, 1);
  delete sess().scores[p.name];
  persist();
  commit();
}

function setSide(side) {
  if (sess().started && hasAnyScore()) return;
  sess().side = side;
  const n = holesFor(side).length;
  for (const p of sess().players) {
    const prev = sess().scores[p.name] || [];
    const next = Array(n).fill(null);
    for (let i = 0; i < Math.min(prev.length, n); i++) next[i] = prev[i];
    sess().scores[p.name] = next;
  }
  sess().hole = 0;
  persist();
  commit();
}

function hasAnyScore() {
  return sess().players.some(p => (sess().scores[p.name] || []).some(v => v != null));
}

function startRound() {
  if (!sess().players.length) {
    const err = document.getElementById('setup-err');
    if (err) err.hidden = false;
    return;
  }
  sess().started = true;
  sess().hole = 0;
  state.scoreMode = 'hole';
  persist();
  commit();
}

function loadFav(i) {
  const fav = readFavs()[i];
  if (!fav) return;
  sess().side = fav.side || 'back';
  sess().players = [];
  sess().scores = {};
  sess().started = false;
  sess().hole = 0;
  for (const name of fav.players || []) addPlayer(name);
  addOpen = false;
  persist();
  commit({ scoreMode: 'setup' });
}

function pick(pi, score) {
  const p = sess().players[pi];
  if (!p) return;
  const hi = sess().hole;
  const row = sess().scores[p.name];
  row[hi] = row[hi] === score ? null : score;
  persist();
  commit();
}

function nav(dir) {
  const holes = holesFor(sess().side);
  const next = sess().hole + dir;
  if (next < 0) return;
  if (next >= holes.length) { openReview(); return; }
  sess().hole = next;
  persist();
  commit();
}

function openReview() {
  state.cardTypeStep = 1;
  commit({ sheet: 'cardtype' });
}

function thru(name) {
  const holes = holesFor(sess().side);
  const pars = parsFor(sess().side);
  const scores = sess().scores[name] || [];
  let gross = 0;
  let par = 0;
  let last = null;
  let n = 0;
  scores.forEach((s, i) => {
    if (s == null) return;
    gross += s;
    par += pars[i];
    last = holes[i];
    n++;
  });
  return { n, last, toPar: n ? gross - par : null, gross };
}

function renderHole() {
  const holes = holesFor(sess().side);
  const pars = parsFor(sess().side);
  const hi = Math.min(sess().hole, holes.length - 1);
  sess().hole = hi;
  const hole = holes[hi];
  noteHole(hole);
  const par = pars[hi];
  const info = HOLES[hole];
  const range = scoreRange(par);
  const night = isLeagueNight(state.league) || state.previewLive;
  const showLive = night && state.live && state.scoreMode === 'hole';
  const names = sess().players.map(p => p.name);
  const cards = sess().players.map((p, pi) => {
    const val = (sess().scores[p.name] || [])[hi];
    const t = thru(p.name);
    const rel = t.toPar;
    const btns = range.map(s => {
      const under = s < par;
      const isPar = s === par;
      const sel = val === s;
      const cls = ['b', under ? 'u' : '', isPar ? 'par' : '', sel ? 'sel' : ''].filter(Boolean).join(' ');
      return html`<button class="${raw(cls)}" type="button" data-pick data-pi="${pi}" data-score="${s}">${s}${isPar ? raw('<small>PAR</small>') : ''}</button>`;
    }).join('');
    return html`
      <div class="pcard ${val != null ? 'done-p' : ''}">
        <div class="pline">
          <div><span class="who">${shortName(p.name, names)}</span><span class="t-small hcp">HCP ${p.hcp}</span></div>
          <div>${t.n
            ? raw(`<span class="vs num ${rel < 0 ? 'neg' : ''}">${toParText(rel)}</span><span class="t-small thru">thru ${t.last}</span>`)
            : raw('<span class="vs num faint">—</span>')}</div>
        </div>
        <div class="btns">${raw(btns)}</div>
      </div>`;
  }).join('');
  const prog = holes.map((_, i) => `<div class="${i < hi ? 'done' : i === hi ? 'cur' : ''}"></div>`).join('');
  const last = hi === holes.length - 1;
  const prevHole = hi > 0 ? holes[hi - 1] : null;
  const nextHole = hi < holes.length - 1 ? holes[hi + 1] : null;
  return html`
    <div class="score-top ${showLive ? 'compact' : ''}">
      <div class="hdr row between">
        <button class="back" type="button" data-action="home">‹ Home</button>
        <span class="pill sage">${sideLabel(sess().side)}</span>
        <button class="text-btn" type="button" data-action="review">Review</button>
      </div>
      <div class="holeinfo">
        <div>
          <div class="t-label">Hole ${hole}</div>
          <div class="serif t-display">Par ${par}</div>
        </div>
        <div class="right">
          <div class="t-head num">${info.yds} yds</div>
          <div class="t-small">Stroke index ${info.si}</div>
        </div>
      </div>
      <div class="prog">${raw(prog)}</div>
      ${raw(gpsStripHtml())}
      ${showLive ? raw(renderBestStrip(hole)) : ''}
      <div class="add-row">
        <button class="text-btn" type="button" data-action="add-toggle">${addOpen ? 'Close' : '+ Player'}</button>
      </div>
      ${addOpen ? raw(`<div class="add-panel"><input id="add-search" class="search" placeholder="Search player name" autocomplete="off" value="${esc(addQuery)}"><div id="add-results">${searchResults(addQuery)}</div></div>`) : ''}
      <div class="cards">${raw(cards)}</div>
      <div class="row gap8 nav">
        <button class="btn ghost" type="button" data-nav="-1" ${prevHole ? '' : 'disabled'}>‹ Hole ${prevHole || hole}</button>
        <button class="btn forest" type="button" data-nav="1">${last ? 'Review' : ('Hole ' + nextHole + ' ›')}</button>
      </div>
    </div>`;
}

function renderSetup() {
  const favs = readFavs();
  const players = sess().players.map((p, i) => html`
    <div class="chip">
      <div><div class="who">${p.name}</div><div class="t-small">Team ${p.team} · HCP ${p.hcp}</div></div>
      <button class="icon-btn" type="button" data-remove="${i}" aria-label="Remove">×</button>
    </div>`).join('');
  return html`
    <div class="page sheet-page">
      <div class="hdr row between">
        <button class="back" type="button" data-action="home">‹ Home</button>
        <span class="serif t-title">Your group</span>
        <span></span>
      </div>
      <p class="t-small mt8">Same one-tap card as Monday night. Names stay in the order you add them. Mixed teams are fine.</p>
      ${favs.length ? raw(`<div class="favs">${favs.map((f, i) => `<button class="fav" type="button" data-fav="${i}"><b>${esc(f.name)}</b><span>${esc(sideLabel(f.side))} · ${(f.players || []).length} players</span></button>`).join('')}</div>`) : ''}
      <div class="card pad mt16">
        <input id="setup-search" class="search" placeholder="Search player name" autocomplete="off">
        <div id="setup-results"></div>
        <div class="chips">${players ? raw(players) : raw('<div class="empty">No players added yet</div>')}</div>
      </div>
      <div class="seg mt16">
        ${raw(['front', 'back', '18'].map(side => `<button type="button" class="${sess().side === side ? 'on' : ''}" data-side="${esc(side)}">${side === '18' ? '18 holes' : esc(sideLabel(side))}</button>`).join(''))}
      </div>
      <p class="t-small mt8">${sideRange(sess().side)}</p>
      <p id="setup-err" class="err" hidden>Add at least one player to start.</p>
      <button class="btn forest mt16" type="button" data-action="start-round">Start scoring</button>
      <div class="row gap8 mt12">
        <button class="btn ghost" type="button" data-action="save-fav">Save group</button>
        ${sess().players.length ? raw('<button class="btn ghost" type="button" data-action="clear">Clear</button>') : ''}
      </div>
    </div>`;
}

function segmentBlock(side, scoreMap, editable) {
  const pars = parsFor(side);
  const holes = holesFor(side);
  return sess().players.map(p => {
    const scores = scoreMap[p.name] || Array(pars.length).fill(null);
    const filled = scores.every(v => v != null);
    const gross = scores.reduce((a, b) => a + (b || 0), 0);
    const net = gross - (+p.hcp || 0);
    const dots = scores.map((s, i) => `<span class="hd ${dotClass(s, pars[i])}">${s == null ? '·' : s}</span>`).join('');
    const tag = (p.purpose && p.purpose !== 'league_night') ? (' · ' + purposeLabel(p.purpose)) : '';
    return html`
      <div class="rev">
        <div class="row between">
          <span class="who">${p.name}<span class="t-small">${tag}</span></span>
          <span class="num ${filled ? '' : 'warn'}">${filled ? (gross + ' gross · ' + net + ' net') : 'Incomplete'}</span>
        </div>
        <div class="dots">${raw(dots)}</div>
        ${editable ? raw(`<div class="purpose-row">
          ${['league_night', 'bank_card', 'practice'].map(type => `<button type="button" class="mini ${p.purpose === type ? 'on' : ''}" data-purpose="${type}" data-pi="${sess().players.indexOf(p)}">${purposeLabel(type)}</button>`).join('')}
        </div>`) : ''}
      </div>`;
  }).join('') + html`<div class="t-small pad-note">${sideLabel(side)} · holes ${holes[0]}–${holes[holes.length - 1]}</div>`;
}

function dotClass(score, par) {
  if (score == null) return 'miss';
  const d = score - par;
  if (d <= -2) return 'eagle';
  if (d === -1) return 'bird';
  if (d === 0) return 'par';
  if (d === 1) return 'bog';
  return 'dbl';
}

function purposeLabel(type) {
  if (type === 'bank_card') return 'Bank';
  if (type === 'practice') return 'Practice';
  return 'League';
}

function renderReview() {
  const blocks = sess().completedSegments.map(seg => segmentBlock(seg.side, seg.scores, false)).join('')
    + segmentBlock(sess().side, sess().scores, true);
  const other = sess().side === 'back' ? 'Front' : 'Back';
  const canAdd = sess().side !== '18' && sess().completedSegments.length < 1;
  const wk = (state.league && state.league.settings && state.league.settings.week) || '';
  return html`
    <div class="page sheet-page">
      <div class="hdr row between">
        <button class="text-btn" type="button" data-action="back-hole">Edit</button>
        <span class="serif t-title">Review</span>
        <button class="back" type="button" data-action="home">‹ Home</button>
      </div>
      <p class="t-small mt8">Week ${wk} · ${sideLabel(sess().side)} · ${sess().players.length} player${sess().players.length === 1 ? '' : 's'}</p>
      <div class="card mt16">${raw(blocks)}</div>
      ${canAdd ? raw(`<button class="btn ghost mt12" type="button" data-action="second-nine">Play the ${other} 9 too</button>`) : ''}
      <button class="btn forest mt16" type="button" data-action="submit" id="submit-btn">Submit card to the league</button>
      <p id="submit-status" class="status-line" hidden></p>
      <p class="t-small mt8">The commissioner sees the card before it is official. If the network fails, your mail app opens with the same scores.</p>
    </div>`;
}

function renderSubmitted() {
  return html`
    <div class="page sheet-page">
      <h1 class="serif t-display">Card received</h1>
      <p class="mt12">${state.submitNote}</p>
      <button class="btn forest mt16" type="button" data-action="done">Done</button>
    </div>`;
}

function addSecondNine() {
  const purposes = {};
  for (const p of sess().players) {
    purposes[p.name] = { purpose: p.purpose || 'league_night', targetDate: p.targetDate || null };
  }
  sess().completedSegments.push({
    side: sess().side,
    scores: JSON.parse(JSON.stringify(sess().scores)),
    purposes
  });
  const next = sess().side === 'back' ? 'front' : 'back';
  sess().side = next;
  sess().hole = 0;
  const n = holesFor(next).length;
  for (const p of sess().players) sess().scores[p.name] = Array(n).fill(null);
  persist();
  state.cardTypeStep = 1;
  state.pendingNine = true;
  commit({ sheet: 'cardtype', scoreMode: 'hole' });
}

export function leagueDateChoices() {
  const cal = calendarOf(state.league);
  const today = todayISO();
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date());
  const isMonday = wd === 'Mon';
  if (cal.length) {
    let idx = cal.findIndex(e => e.date >= today);
    if (idx < 0) idx = cal.length;
    const start = isMonday ? idx : Math.max(0, idx - 1);
    const out = [];
    for (let i = start; i < cal.length && out.length < 3; i++) out.push(cal[i]);
    if (!out.length && cal.length) out.push(cal[cal.length - 1]);
    if (out.length) return out.map(c => ({
      date: c.date,
      label: new Date(c.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        + (c.week ? ' · Week ' + c.week : '')
    }));
  }
  return [];
}

export function renderCardType() {
  const step = state.cardTypeStep || 1;
  const dates = leagueDateChoices();
  const body = step === 1 ? html`
      <button class="choice" type="button" data-type="league_night">League night</button>
      <button class="choice" type="button" data-type="bank_card">Bank for later</button>
      <button class="choice" type="button" data-type="practice">Practice only</button>`
    : raw(dates.map(d => `<button class="choice ${sess().targetDate === d.date ? 'on' : ''}" type="button" data-date="${esc(d.date)}">${esc(d.label)}</button>`).join('')
      + (sess().targetDate ? '<button class="btn forest mt16" type="button" data-action="confirm-date">Continue</button>' : ''));
  return html`
    <div class="modal-scrim" data-close-sheet>
      <div class="modal" role="dialog">
        <div class="row between">
          ${step === 2 ? raw('<button class="text-btn" type="button" data-action="type-back">Back</button>') : raw('<span></span>')}
          <div class="serif t-head">${step === 1 ? 'What kind of card?' : 'Which Monday?'}</div>
          <span></span>
        </div>
        <div class="choices mt16">${raw(body && body.__raw ? body.__raw : body)}</div>
      </div>
    </div>`;
}

export function bindCardType(root) {
  root.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => {
    const type = b.dataset.type;
    if (type === 'league_night') {
      state.cardTypeStep = 2;
      commit();
      return;
    }
    applyType(type, null);
  }));
  root.querySelectorAll('[data-date]').forEach(b => b.addEventListener('click', () => {
    sess().targetDate = b.dataset.date;
    sess().cardType = 'league_night';
    commit();
  }));
  const back = root.querySelector('[data-action=type-back]');
  if (back) back.addEventListener('click', () => { state.cardTypeStep = 1; commit(); });
  const ok = root.querySelector('[data-action=confirm-date]');
  if (ok) ok.addEventListener('click', () => applyType('league_night', sess().targetDate));
  root.querySelectorAll('[data-close-sheet]').forEach(b => {
    if (b.classList.contains('modal-scrim')) {
      b.addEventListener('click', ev => {
        if (ev.target === b) commit({ sheet: null });
      });
    }
  });
}

function applyType(type, date) {
  sess().cardType = type;
  sess().targetDate = type === 'league_night' ? date : null;
  for (const p of sess().players) {
    if (state.pendingNine) {
      p.purpose = type;
      p.targetDate = sess().targetDate;
    } else if (!p.purpose || p.purpose === sess().cardType || true) {
      p.purpose = type;
      p.targetDate = sess().targetDate;
    }
  }
  state.pendingNine = false;
  persist();
  commit({ sheet: null, scoreMode: 'review' });
}

function buildSegment(side, scoreMap, purposes) {
  const holes = holesFor(side);
  return {
    side,
    entries: sess().players.map(p => {
      const s = scoreMap[p.name] || Array(holes.length).fill(null);
      const gross = s.reduce((a, b) => a + (b || 0), 0);
      const scores = {};
      holes.forEach((h, i) => { scores[h] = s[i] == null ? null : s[i]; });
      const pp = purposes && purposes[p.name]
        ? purposes[p.name]
        : { purpose: p.purpose || 'league_night', targetDate: p.targetDate || null };
      return {
        name: p.name,
        team: p.team,
        hcp: p.hcp,
        purpose: pp.purpose || 'league_night',
        targetDate: pp.targetDate || null,
        targetWeek: null,
        side,
        gross,
        net: gross - p.hcp,
        scores
      };
    })
  };
}

function payload() {
  const wk = state.league && state.league.settings && state.league.settings.week ? state.league.settings.week : '?';
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const segments = [
    ...sess().completedSegments.map(seg => buildSegment(seg.side, seg.scores, seg.purposes)),
    buildSegment(sess().side, sess().scores, null)
  ];
  return {
    week: wk,
    date: today,
    cardType: sess().cardType || 'league_night',
    segments
  };
}

function emailBody(data) {
  let body = `WGL Card — Week ${data.week}\nDate: ${data.date}\n\n`;
  for (const seg of data.segments) {
    const sideLbl = seg.side === 'back' ? 'BACK 9 (Holes 10–18)' : seg.side === '18' ? '18 HOLES' : 'FRONT 9 (Holes 1–9)';
    body += `=== ${sideLbl} ===\n`;
    for (const e of seg.entries) {
      const holes = Object.keys(e.scores);
      const hstr = holes.map(h => `H${h}:${e.scores[h] ?? '?'}`).join('  ');
      body += `${e.name}  HCP ${e.hcp}${e.purpose !== 'league_night' ? ' [' + e.purpose + ']' : ''}\n${hstr}\nGross:${e.gross}  Net:${e.net}\n\n`;
    }
  }
  return body;
}

async function submitCard(root) {
  const btn = root.querySelector('#submit-btn');
  const status = root.querySelector('#submit-status');
  if (btn) btn.disabled = true;
  if (status) {
    status.hidden = false;
    status.textContent = 'Sending…';
  }
  const data = payload();
  try {
    const out = await postScript(data);
    const rows = out && out.rows;
    const dupes = out && out.dupes;
    state.submitNote = out && out.ok
      ? ('Card received — ' + (rows || 0) + ' score' + (rows === 1 ? '' : 's') + ' recorded.'
        + (dupes ? ' ' + dupes + ' flagged for the commissioner as a possible duplicate.' : ''))
      : 'Card submitted.';
    sess().players = [];
    sess().scores = {};
    sess().hole = 0;
    sess().started = false;
    sess().completedSegments = [];
    persist();
    commit({ scoreMode: 'review', sheet: null });
  } catch (err) {
    if (status) status.textContent = 'Network problem — opening email backup…';
    if (btn) btn.disabled = false;
    const sub = encodeURIComponent('WGL Card Wk' + data.week + ' – ' + data.date);
    setTimeout(() => {
      window.location.href = `mailto:${SCORE_EMAIL}?subject=${sub}&body=${encodeURIComponent(emailBody(data))}`;
    }, 600);
  }
}
