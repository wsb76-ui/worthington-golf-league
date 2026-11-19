import { html, raw } from './format.js';
import { backBar } from './ui.js';
import { commit, state } from './state.js';

let mode = 'roster';
let query = '';
let picked = '';

function players() {
  return Object.entries((state.league && state.league.players) || {})
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => a.team - b.team || a.hcp - b.hcp || a.name.localeCompare(b.name));
}

export function renderRoster() {
  return html`
    ${backBar('Roster & dues')}
    <div class="page">
      <div class="seg mt8">
        <button type="button" data-roster="roster" class="${mode === 'roster' ? 'on' : ''}">Roster</button>
        <button type="button" data-roster="dues" class="${mode === 'dues' ? 'on' : ''}">Dues</button>
        <button type="button" data-roster="banked" class="${mode === 'banked' ? 'on' : ''}">Banked</button>
      </div>
      ${mode === 'dues' ? raw(duesHtml()) : mode === 'banked' ? raw(bankedHtml()) : raw(rosterHtml())}
    </div>`;
}

function rosterHtml() {
  const q = query.trim().toLowerCase();
  const list = players().filter(p => !q || p.name.toLowerCase().includes(q));
  let team = 0;
  let html = `<input id="roster-q" class="search mt16" placeholder="Search players" value="${escapeAttr(query)}" autocomplete="off">`;
  for (const p of list) {
    if (p.team !== team) {
      team = p.team;
      html += `<div class="t-label mt16">Team ${team}</div>`;
    }
    const bank = ((state.league.banked || {})[p.name] || []).length;
    const badge = bank ? ` <span class="pill sage">🏦 ${bank}</span>` : '';
    html += `<button class="hub" type="button" data-player="${escapeAttr(p.name)}"><b>${escapeAttr(p.name)}${badge}</b><span>HCP ${p.hcp}</span></button>`;
  }
  if (!list.length) html += '<p class="empty">No matching player.</p>';
  return html;
}

function duesHtml() {
  const s = (state.league && state.league.settings) || {};
  let dues = 0, skins = 0, low = 0;
  const rows = players().map(p => {
    const d = (state.league.duesPaid || {})[p.name] || {};
    const b = (state.league.buyins || {})[p.name] || {};
    if (d.dues) dues++;
    if (b.skins) skins++;
    if (b.lownet) low++;
    const mark = (on, label, tone) => on ? `<span class="pill ${tone}">${label}</span>` : '<span class="t-small">—</span>';
    return `<div class="trow"><div class="grow"><div class="who">${escapeAttr(p.name)}</div><div class="t-small">Team ${p.team}</div></div>
      ${mark(d.dues, 'Dues', 'sage')}${mark(b.skins, 'Skins', 'gold')}${mark(b.lownet, 'Net', 'clay')}</div>`;
  }).join('');
  const anyBuy = skins || low;
  const buyLine = anyBuy
    ? `Skins ${skins}${s.skins ? ' · ' + escapeAttr(s.skins) : ''} · Low net ${low}${s.lownet ? ' · ' + escapeAttr(s.lownet) : ''}`
    : 'Skins/Low net buy-ins not tracked';
  return `<p class="t-small mt16">Dues paid ${dues}${s.dues ? ' · ' + escapeAttr(s.dues) : ''}</p>
    <p class="t-small">${buyLine}</p>
    <div class="card flush mt12"><div class="trow"><div class="grow t-label">Player</div><span class="t-label">Dues</span><span class="t-label">Skins</span><span class="t-label">Net</span></div>${rows}</div>`;
}

function bankLine(b) {
  const flag = +b.gross < 30 ? ' · incomplete?' : '';
  const side = b.side === 'front' ? 'Front' : 'Back';
  return `${escapeAttr(b.played || 'date not posted')} · ${side} 9 · gross ${b.gross} · HCP ${b.hcp}${flag}`;
}

function bankedHtml() {
  const entries = Object.entries((state.league && state.league.banked) || {}).filter(([, cards]) => cards && cards.length);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) return '<p class="empty">No banked cards.</p>';
  const rows = entries.map(([name, cards]) => `<button class="hub" type="button" data-player="${escapeAttr(name)}"><b>${escapeAttr(name)} <span class="pill sage">🏦 ${cards.length}</span></b>${cards.map(b => `<span class="bank-line">${bankLine(b)}</span>`).join('')}</button>`).join('');
  return rows + '<p class="t-small mt12">Published weeks don’t record which banked card filled a missing spot, so this list is what’s still banked.</p>';
}

function escapeAttr(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function renderPlayer() {
  const p = players().find(x => x.name === picked);
  if (!p) return '';
  const bank = (state.league.banked || {})[p.name] || [];
  const rounds = [];
  Object.keys(state.weeks || {}).map(Number).sort((a, b) => b - a).forEach(w => {
    const hit = ((state.weeks[w] && state.weeks[w].players) || []).find(e => e.name === p.name);
    if (hit) rounds.push({ w, ...hit });
  });
  const tel = p.phone ? p.phone.replace(/\D/g, '') : '';
  return `<div class="modal-scrim" data-close-sheet>
    <div class="modal" role="dialog">
      <div class="serif t-head">${escapeAttr(p.name)}</div>
      <p class="t-small mt4">Team ${p.team} · Handicap ${p.hcp}</p>
      <p class="mt12">${p.phone ? escapeAttr(p.phone) : 'No phone on file'}</p>
      ${tel ? `<a class="btn forest mt12" href="tel:${tel}">Call</a>` : ''}
      ${bank.length ? `<div class="t-label mt16">Banked cards</div>` + bank.map(b =>
        `<div class="row between mt8"><span>${bankLine(b)}</span></div>`).join('') : ''}
      ${rounds.length ? `<div class="t-label mt16">Rounds</div>` + rounds.slice(0, 12).map(r =>
        `<div class="row between mt8"><span>Week ${r.w}</span><b>Gross ${r.gross} · Net ${r.net}</b></div>`).join('') : ''}
      <button class="btn ghost mt16" type="button" data-close-sheet>Close</button>
    </div>
  </div>`;
}

export function bindRoster(root) {
  root.querySelectorAll('[data-roster]').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.roster;
    commit();
  }));
  const input = root.querySelector('#roster-q');
  if (input) input.addEventListener('input', () => {
    query = input.value;
    const page = root.querySelector('.page');
    page.innerHTML = `<div class="seg mt8">
        <button type="button" data-roster="roster" class="on">Roster</button>
        <button type="button" data-roster="dues">Dues</button>
        <button type="button" data-roster="banked">Banked</button>
      </div>` + rosterHtml();
    bindRoster(root);
    const again = root.querySelector('#roster-q');
    if (again) {
      again.focus();
      const n = again.value.length;
      again.setSelectionRange(n, n);
    }
  });
  root.querySelectorAll('[data-player]').forEach(b => b.addEventListener('click', () => {
    picked = b.querySelector('b') ? b.querySelector('b').textContent : b.dataset.player;
    commit({ sheet: 'player' });
  }));
}
