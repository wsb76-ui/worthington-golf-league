import { html, initials, money, raw, toParText } from './format.js';
import { calendarOf } from './home.js';
import { weekBoard } from './scoring.js';
import { avatarTone } from './format.js';
import { commit, state } from './state.js';
import { sideForWeek, sideLabel } from './course.js';
import { roundName, weekTitle } from './format.js';

export function latestWeek(weeks) {
  const nums = Object.keys(weeks || {}).map(Number)
    .filter(w => ((weeks[w] && weeks[w].players) || []).length)
    .sort((a, b) => b - a);
  return nums.length ? nums[0] : null;
}

function weekDateLabel(week) {
  const data = state.weeks[week] || {};
  if (data.date) return data.date.replace(/, \d{4}$/, '');
  const cal = calendarOf(state.league).find(c => +c.week === +week);
  if (!cal) return '';
  return new Date(cal.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function renderResults() {
  const week = latestWeek(state.weeks);
  if (!week) {
    return html`<div class="page sheet-page"><h1 class="serif t-display">Results</h1><p class="t-small mt8">No scores posted yet.</p></div>`;
  }
  const data = state.weeks[week];
  const board = weekBoard(data, (state.league && state.league.players) || {});
  const winner = board[0];
  const roster = (state.league && state.league.players) || {};
  const me = roster[state.identity];
  const mine = me ? board.find(t => t.team === +me.team) : null;
  const back = mine && winner ? mine.total - winner.total : null;
  const yourLine = mine
    ? ('Your team: ' + mine.rank + placeSuffix(mine.rank) + (back ? ', ' + back + ' strokes back' : ''))
    : '';
  const cap = winnerCaption(winner, roster);
  const pay = ((state.league && state.league.weeklyPayouts) || {})[week] || {};
  const skins = pay.skins || [];
  const low = pay.lowNet || null;
  const pot = skins.reduce((s, sk) => s + (parseFloat(sk.amount) || 0), 0) + (low && parseFloat(low.amount) || 0);
  const round = roundName(week);
  const side = sideLabel(sideForWeek(week));
  const title = round ? (round + ' · ' + side) : ('Week ' + week + ' · ' + side);
  return html`
    <div class="page sheet-page">
      <h1 class="serif t-display">Results</h1>
      <div class="row gap8 mt8 wrap">
        <span class="week-line">${title}</span>
        <span class="t-small">· ${weekDateLabel(week)}</span>
        <span class="pill sage push">Latest</span>
      </div>
      <div class="card win pad mt16">
        <div class="row between">
          <div>
            <div class="t-label on-dark">Low team</div>
            <div class="serif t-title mt4">Team ${winner.team}${cap ? ' · ' + cap : ''}</div>
            ${yourLine ? raw(`<div class="on-dark sub">${yourLine}</div>`) : ''}
            ${winner.missing ? raw(`<div class="on-dark sub">Includes +${winner.missing * 50} for missing cards</div>`) : ''}
          </div>
          <div class="right">
            <div class="serif win-num num">${winner.total}</div>
            <div class="on-dark sub">net</div>
          </div>
        </div>
      </div>
      ${skins.length ? raw(skinsBlock(skins, pot)) : raw(`<p class="t-small mt16">Skins aren't posted for this week.</p>`)}
      ${low && low.player ? raw(lowBlock(low, roster)) : ''}
      ${me ? raw(yourNight(me, data, board)) : raw(`<button class="text-btn mt16" type="button" data-action="identity">Set your name to see your card</button>`)}
      <button class="row between link-row" type="button" data-action="teams">
        <span>All team scores</span><span class="chev">${state.resultsOpen ? '▾' : '›'}</span>
      </button>
      ${state.resultsOpen ? raw(allTeams(board)) : ''}
    </div>`;
}

function placeSuffix(n) {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

function winnerCaption(team, roster) {
  for (const [name, info] of Object.entries(roster)) {
    if (+info.team === team.team && info.captain) return lastName(name);
  }
  return '';
}

function lastName(name) {
  const bits = String(name).trim().split(/\s+/);
  return bits[bits.length - 1] || name;
}

function skinsBlock(skins, pot) {
  const rows = skins.map(sk => `<div class="skin">
      <div class="hole num">${sk.hole}</div>
      <div class="grow"><div class="who">${esc(sk.player)}</div><div class="t-small">${esc(sk.note || ('Hole ' + sk.hole))}</div></div>
      <div class="num who">${money(sk.amount)}</div>
    </div>`).join('');
  return `<div class="row between mt20"><span class="t-label">Skins · ${skins.length} ${skins.length === 1 ? 'hole' : 'holes'}</span>${pot ? `<span class="t-small">${money(pot)} pot</span>` : ''}</div>
    <div class="card flush mt8">${rows}</div>`;
}

function lowBlock(low, roster) {
  const player = (state.weeks && findPlayer(low.player)) || {};
  const [bg, fg] = avatarTone(1);
  return `<div class="t-label mt20">Low net</div>
    <div class="card mt8 person">
      <div class="avatar" style="background:${bg};color:${fg}">${initials(low.player)}</div>
      <div class="grow"><div class="who">${esc(low.player)}</div><div class="t-small">${player.gross != null ? 'Gross ' + player.gross + ' · HCP ' + player.hcp : ''}</div></div>
      <div class="right"><div class="serif t-title num">${player.net != null ? player.net : ''}</div><div class="t-small">${money(low.amount) || 'net'}</div></div>
    </div>`;
}

function findPlayer(name) {
  const week = latestWeek(state.weeks);
  const data = state.weeks[week];
  return ((data && data.players) || []).find(p => p.name === name) || null;
}

function yourNight(me, data, board) {
  const card = (data.players || []).find(p => p.name === state.identity);
  if (!card) {
    return `<div class="t-label mt20">Your night</div><p class="t-small mt8">You don't have a score in this week.</p>`;
  }
  const team = board.find(t => t.counting.has(state.identity));
  const counted = team ? 'counted for Team ' + team.team : 'not in the counting four';
  const [bg, fg] = avatarTone(0);
  return `<div class="t-label mt20">Your night</div>
    <div class="card mt8 person">
      <div class="avatar" style="background:${bg};color:${fg}">${initials(state.identity)}</div>
      <div class="grow"><div class="who">${esc(state.identity)}</div><div class="t-small">Gross ${card.gross} · ${counted}</div></div>
      <div class="right"><div class="serif t-title num">${card.net}</div><div class="t-small">net</div></div>
    </div>`;
}

function allTeams(board) {
  return board.map(t => {
    const players = t.rows.filter(r => !r.dns).map(p => {
      const counts = t.counting.has(p.name);
      return `<div class="player-line ${counts ? '' : 'dim'}"><span>${esc(p.name)}</span><span class="num">${p.net}</span></div>`;
    }).join('');
    const pen = t.missing ? ` · +${t.missing * 50} missing` : '';
    return `<div class="card flush mt8">
      <div class="team-hd"><span>Team ${t.team}</span><span class="num">${t.total} net${pen}</span></div>
      ${players || '<div class="empty">No cards</div>'}
    </div>`;
  }).join('');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export function bindResults(root) {
  const btn = root.querySelector('[data-action=teams]');
  if (btn) btn.addEventListener('click', () => commit({ resultsOpen: !state.resultsOpen }));
  const id = root.querySelector('[data-action=identity]');
  if (id) id.addEventListener('click', () => commit({ sheet: 'identity' }));
}

