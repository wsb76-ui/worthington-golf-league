import { html, initials, money, raw } from './format.js';
import { calendarOf, playedWeeks } from './home.js';
import { seasonChampion, teamStandings, weekBoard } from './scoring.js';
import { avatarTone } from './format.js';
import { commit, state } from './state.js';
import { backBar } from './ui.js';
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
  const weeks = playedWeeks(state.weeks, state.league);
  const week = state.resultsWeek || latestWeek(weeks);
  if (!week || !weeks[week]) {
    return html`${backBar('Results')}<div class="page"><p class="t-small mt8">No scores posted yet.</p></div>`;
  }
  const data = weeks[week];
  const board = weekBoard(data, (state.league && state.league.players) || {});
  const champs = +week === 19 ? seasonChampion(teamStandings(weeks), weeks) : null;
  const winner = (champs && board.find(t => t.team === champs.team)) || board[0];
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
  const lowLabel = +week === 19 ? 'Champions' : 'Low team';
  const nums = Object.keys(weeks).map(Number).filter(w => (weeks[w].players || []).length).sort((a, b) => b - a);
  const picker = `<select id="week-pick" class="search" style="margin-top:12px">${nums.map(w => `<option value="${w}"${w === +week ? ' selected' : ''}>${esc(weekTitle(w))}</option>`).join('')}</select>`;
  return html`
    ${backBar('Results')}
    <div class="page">
      <p class="t-small">${state.syncLabel || ''} · pull to refresh</p>
      ${raw(picker)}
      <div class="row gap8 mt8 wrap">
        <span class="week-line">${title}</span>
        <span class="t-small">· ${weekDateLabel(week)}</span>
        ${+week === nums[0] ? raw('<span class="pill sage push">Latest</span>') : ''}
      </div>
      <div class="card win pad mt16">
        <div class="row between">
          <div>
            <div class="t-label on-dark">${lowLabel}</div>
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
      ${state.resultsOpen ? raw(allTeams(board, week)) : ''}
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
  const weeks = playedWeeks(state.weeks, state.league);
  const week = state.resultsWeek || latestWeek(weeks);
  const data = weeks[week];
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

function allTeams(board, week) {
  return board.map(t => {
    const players = t.rows.filter(r => !r.dns).map(p => {
      const counts = t.counting.has(p.name);
      const grp = p.grp != null ? ` data-grp="${p.grp}"` : '';
      return `<button class="player-line ${counts ? '' : 'dim'}" type="button" data-open-card data-week="${week}" data-team="${t.team}"${grp} data-name="${esc(p.name)}"><span>${esc(p.name)}</span><span class="num">${p.net}</span></button>`;
    }).join('');
    const pen = t.missing ? ` · includes +${t.missing * 50}` : '';
    return `<div class="card flush mt8">
      <button class="team-hd" type="button" data-open-card data-week="${week}" data-team="${t.team}"><span>Team ${t.team}</span><span class="num">${t.total} net${pen}</span></button>
      ${players || '<div class="empty">No cards</div>'}
    </div>`;
  }).join('');
}

export function renderGroup() {
  const focus = state.cardFocus;
  if (!focus) return '';
  const data = (playedWeeks(state.weeks, state.league)[focus.week] || {});
  let rows = (data.players || []).filter(p => focus.grp != null ? p.grp === focus.grp : +p.team === +focus.team);
  rows = rows.slice().sort((a, b) => a.net - b.net);
  const holes = rows.some(p => p.scores || p.holes);
  const body = rows.map(p => {
    const mine = p.name === focus.name ? ' me' : '';
    const detail = holes ? holeLine(p) : `Gross ${p.gross} · HCP ${p.hcp}`;
    return `<div class="trow${mine}"><div class="grow"><div class="who">${esc(p.name)}</div><div class="t-small">Team ${p.team} · ${detail}</div></div><b class="num">${p.net}</b></div>`;
  }).join('');
  const title = focus.grp != null ? `Group ${focus.grp}` : `Team ${focus.team}`;
  return `<div class="modal-scrim" data-close-sheet><div class="modal" role="dialog">
    <div class="serif t-head">${esc(weekTitle(focus.week))} · ${title}</div>
    <p class="t-small mt4">${holes ? 'Hole by hole' : 'Gross and net. Per-hole strokes are not in the published week file.'}</p>
    <div class="card flush mt12">${body || '<div class="empty">No cards</div>'}</div>
    <button class="btn ghost mt16" type="button" data-close-sheet>Close</button>
  </div></div>`;
}

function holeLine(p) {
  const scores = p.scores || p.holes || {};
  return Object.keys(scores).map(h => h + ':' + scores[h]).join(' ');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export function bindResults(root) {
  const btn = root.querySelector('[data-action=teams]');
  if (btn) btn.addEventListener('click', () => commit({ resultsOpen: !state.resultsOpen }));
  const id = root.querySelector('[data-action=identity]');
  if (id) id.addEventListener('click', () => commit({ sheet: 'identity' }));
  const pick = root.querySelector('#week-pick');
  if (pick) pick.addEventListener('change', () => {
    state.resultsWeek = +pick.value;
    const next = '#/results/' + pick.value;
    if (location.hash !== next) location.hash = next;
    else commit();
  });
  root.querySelectorAll('[data-open-card]').forEach(b => b.addEventListener('click', () => {
    state.cardFocus = {
      week: +b.dataset.week,
      team: b.dataset.team != null ? +b.dataset.team : null,
      grp: b.dataset.grp != null && b.dataset.grp !== '' ? +b.dataset.grp : null,
      name: b.dataset.name || ''
    };
    commit({ sheet: 'group' });
  }));
}

