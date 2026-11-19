import { PLAYOFF_FIRST } from './config.js';
import { html, lastName, placeWord, raw, toParText } from './format.js';
import { captainLabel, playoffBracket, playerBoard, teamStandings } from './scoring.js';
import { commit, state } from './state.js';

export function renderStandings() {
  const table = teamStandings(state.weeks);
  const sub = 'Through week ' + table.lastReg + ' · lower total wins';
  const teams = state.standingsView !== 'players';
  return html`
    <div class="page sheet-page">
      <h1 class="serif t-display">Standings</h1>
      <p class="t-small mt4">${sub}</p>
      <div class="seg mt16">
        <button type="button" data-view="teams" class="${teams ? 'on' : ''}">Teams</button>
        <button type="button" data-view="players" class="${teams ? '' : 'on'}">Players</button>
      </div>
      ${teams ? raw(teamList(table)) : raw(playerList())}
    </div>`;
}

function teamList(table) {
  const roster = (state.league && state.league.players) || {};
  const me = roster[state.identity];
  const myTeam = me ? +me.team : 0;
  const rows = table.rows.map((r, i) => {
    const cap = captainLabel(roster, r.team);
    const cut = i === 4 ? '<div class="cutline">Playoff line</div>' : '';
    return `${i === 4 ? cut : ''}<div class="trow ${r.team === myTeam ? 'me' : ''}">
      <div class="rk num">${r.rank}</div>
      <div class="grow">
        <div class="who">Team ${r.team}${r.team === myTeam ? ' <span class="pill sage you">You</span>' : ''}</div>
        ${cap ? `<div class="t-small">Capt. ${escName(lastName(cap))}</div>` : ''}
      </div>
      <div class="right">
        <div class="num total">${r.season.toLocaleString('en-US')}</div>
        <div class="t-small num">${r.gap ? '+' + r.gap.toLocaleString('en-US') : '—'}</div>
      </div>
    </div>`;
  }).join('');
  const bracket = playoffBracket(table, state.weeks);
  return `<div class="card flush mt16">${rows}</div>
    <p class="foot">4 lowest nets count each week · +50 per missing card</p>
    ${bracket ? bracketHtml(bracket, table) : ''}`;
}

function escName(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function matchLine(m, weekLabel) {
  if (!m) return '';
  const side = (team, cell, win) => {
    const sc = cell ? cell.score + (cell.penalty ? '!' : '') : '—';
    return `<span class="${win ? 'win-name' : ''}">Team ${team}${cell ? ' ' + sc : ''}</span>`;
  };
  const result = m.winner
    ? `Team ${m.winner}${m.tie ? ' · higher seed' : ''}`
    : 'TBD';
  return `<div class="mini-match"><div>${side(m.a, m.sa, m.winner === m.a)} <span class="vs-dim">vs</span> ${side(m.b, m.sb, m.winner === m.b)}</div><div class="t-small">${weekLabel} · ${result}</div></div>`;
}

function bracketHtml(bracket) {
  return `<div class="card pad mt16">
    <div class="t-label">Playoffs</div>
    <p class="t-small mt4">Lower score wins · a tie goes to the higher seed</p>
    ${matchLine(bracket.semis[0], 'Semifinal')}
    ${matchLine(bracket.semis[1], 'Semifinal')}
    ${matchLine(bracket.final, 'Championship')}
    ${matchLine(bracket.third, '3rd place')}
  </div>`;
}

function spark(series) {
  if (!series || series.length < 2) return '';
  const W = 96;
  const H = 44;
  const pad = 4;
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const span = (hi - lo) || 1;
  const pts = series.map((v, i) => {
    const x = pad + i * (W - pad * 2) / (series.length - 1);
    const y = pad + ((v - lo) / span) * (H - pad * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  });
  const last = pts[pts.length - 1].split(',');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="96" height="44" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="#8DA586" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="#2E5739"/></svg>`;
}

function deltaMark(delta) {
  if (!delta) return '';
  const down = delta < 0;
  return `<span class="delta ${down ? 'good' : 'bad'}">${down ? '↓' : '↑'}${Math.abs(delta)}</span>`;
}

function playerList() {
  const rows = playerBoard(state.weeks, (state.league && state.league.players) || {});
  const me = rows.find(r => r.name === state.identity);
  const mine = me ? `<div class="card pad hcp-card mt16">
      <div>
        <div class="t-label">Your handicap</div>
        <div class="row gap8 baseline mt4">
          <span class="serif hcp-num">${me.hcp}</span>
          ${me.delta ? `<span class="pill ${me.delta < 0 ? 'sage' : 'clay'}">${me.delta < 0 ? '↓' : '↑'} ${Math.abs(me.delta)} this season</span>` : ''}
        </div>
      </div>
      ${spark(me.series)}
    </div>` : `<button class="card pad hcp-card mt16 id-prompt" type="button" data-action="identity">
      <div><div class="t-label">Your handicap</div><div class="who mt4">Set your name</div></div>
    </button>`;
  const body = rows.map(r => `<div class="trow ${r.name === state.identity ? 'me' : ''}">
      <div class="rk num">${r.rank}</div>
      <div class="grow"><div class="who">${escName(r.name)}</div><div class="t-small">Team ${r.team}</div></div>
      <div class="hcp-col num">${r.hcp} ${deltaMark(r.delta)}</div>
      <div class="avg num">${r.avg.toFixed(1)}</div>
    </div>`).join('');
  return `${mine}
    <div class="row between head-row"><span class="t-label">Low net average</span><span class="row"><span class="t-label hcp-col">HCP</span><span class="t-label avg">Avg</span></span></div>
    <div class="card flush">${body || '<div class="empty">No rounds posted yet.</div>'}</div>`;
}

export function bindStandings(root) {
  root.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
    commit({ standingsView: b.dataset.view });
  }));
  const id = root.querySelector('[data-action=identity]');
  if (id) id.addEventListener('click', () => commit({ sheet: 'identity' }));
}

void placeWord;
void toParText;
void PLAYOFF_FIRST;
