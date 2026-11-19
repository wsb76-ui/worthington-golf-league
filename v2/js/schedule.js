import { COURSE, FIRST_TEE } from './config.js';
import { sideForWeek, sideLabel } from './course.js';
import { html, monthKey, raw, weekdayShort } from './format.js';
import { calendarOf, isLeagueNight, leagueContext } from './home.js';
import { postScript } from './api.js';
import { commit, state } from './state.js';
import { backBar } from './ui.js';
import { todayISO } from './format.js';

export function renderSchedule() {
  const ctx = leagueContext(state.league);
  const events = buildEvents(ctx);
  const skipped = skippedMondays(ctx.cal);
  const months = [];
  let current = '';
  for (const ev of events) {
    const mo = monthKey(ev.date) || 'Season';
    if (mo !== current) {
      current = mo;
      const notes = skipped.filter(d => monthKey(d) === mo).map(d => 'No league ' + shortMonth(d));
      months.push({ month: mo, notes, rows: [] });
    }
    months[months.length - 1].rows.push(ev);
  }
  const blocks = months.map(m => html`
    <div class="row between mt20">
      <span class="t-label">${m.month}</span>
      ${m.notes.length ? raw(`<span class="t-small">${m.notes.join(' · ')}</span>`) : ''}
    </div>
    <div class="card flush mt8">${raw(m.rows.map(rowHtml).join(''))}</div>`).join('');
  return html`
    ${backBar('Schedule')}
    <div class="page">
      <p class="t-small mt4">Mondays at ${COURSE.replace(' Golf Course', ' GC')} · first group ${FIRST_TEE}</p>
      <div class="seg mt12">
        <button type="button" data-cal="list" class="${calView === 'list' ? 'on' : ''}">List</button>
        <button type="button" data-cal="grid" class="${calView === 'grid' ? 'on' : ''}">Month</button>
      </div>
      ${calView === 'grid' ? raw(monthGrid(ctx)) : raw(blocks)}
      <div class="sheet-pad"></div>
    </div>`;
}

function shortMonth(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function rowHtml(ev) {
  const day = new Date(ev.date + 'T12:00:00');
  const past = ev.date < todayISO();
  const tonight = ev.date === todayISO();
  const cls = ['ev', past && !allPast() ? 'past' : '', tonight ? 'next' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}">
    <div class="date"><div class="d num">${day.getDate()}</div><div class="m">${weekdayShort(ev.date)}</div></div>
    <div class="grow">
      <div class="who">${esc(ev.title)}</div>
      <div class="t-small">${esc(ev.sub)}</div>
    </div>
    ${ev.pill ? `<span class="pill ${ev.pillClass}">${esc(ev.pill)}</span>` : (past && ev.posted ? '<span class="t-small">✓</span>' : '')}
  </div>`;
}

function allPast() {
  const cal = calendarOf(state.league);
  const today = todayISO();
  return cal.length && cal[cal.length - 1].date < today;
}

function buildEvents(ctx) {
  const weeks = state.weeks || {};
  const rows = ctx.cal.map(c => {
    const week = +c.week;
    const side = sideLabel(sideForWeek(week));
    const posted = !!((weeks[week] && weeks[week].players) || []).length;
    let title = 'Week ' + week;
    let sub = side;
    let pill = '';
    let pillClass = 'sage';
    if (week === 18) { title = 'Semifinals'; sub = 'Seeds 1 v 4 · 2 v 3'; pill = 'Playoffs'; }
    else if (week === 19) { title = 'Championship'; sub = 'Final + 3rd place'; pill = 'Finals'; pillClass = 'gold'; }
    else if (week === 17) sub = side + ' · Last regular week';
    else if (week >= 20) {
      title = 'Week ' + week;
      sub = side + ' · after the championship, not in the team race' + (posted ? '' : ' · no scores posted');
    }
    else if (posted && c.date < todayISO()) sub = side + ' · Results posted';
    if (c.date === todayISO() && isLeagueNight(state.league)) {
      title += ' · Tonight';
      pill = 'Tonight';
      pillClass = 'clay';
    } else if (c.date > todayISO() && ctx.upcoming && ctx.upcoming.date === c.date && !pill) {
      pill = 'Next';
      pillClass = 'clay';
    }
    return { date: c.date, title, sub, pill, pillClass, kind: 'league', posted };
  });
  for (const outing of outings(state.league)) rows.push(outing);
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return rows;
}

function outings(league) {
  const year = ((calendarOf(league)[0] || {}).date || '2026-01-01').slice(0, 4);
  const list = [];
  const add = (o, which, title) => {
    if (!o || !o.date) return;
    const date = looseDate(o.date, year);
    if (!date) return;
    const future = date >= todayISO();
    list.push({
      date,
      title: title,
      sub: prettyTee(o.tee) || 'Hiland',
      pill: future ? 'Sign up' : '',
      pillClass: 'gold',
      kind: 'outing',
      which
    });
  };
  add(league.outing, 'mid', 'Mid-season outing');
  add(league.outing2, 'end', 'Season outing');
  return list;
}

function prettyTee(tee) {
  if (!tee) return '';
  if (/^8am$/i.test(tee.trim())) return '8:00 AM shotgun';
  return tee;
}

function looseDate(value, year) {
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s + ' ' + year);
  if (Number.isNaN(d.getTime())) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function skippedMondays(cal) {
  const out = [];
  for (let i = 0; i < cal.length - 1; i++) {
    const cursor = new Date(cal[i].date + 'T12:00:00');
    const end = new Date(cal[i + 1].date + 'T12:00:00');
    cursor.setDate(cursor.getDate() + 1);
    while (cursor < end) {
      if (cursor.getDay() === 1) {
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        out.push(cursor.getFullYear() + '-' + m + '-' + d);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return out;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

let signupWhich = 'end';
let calView = 'list';
let gridCursor = '';

function monthGrid(ctx) {
  const events = buildEvents(ctx);
  if (!gridCursor) gridCursor = (ctx.today || '2026-05-01').slice(0, 7);
  const [ys, ms] = gridCursor.split('-').map(Number);
  const first = new Date(ys, ms - 1, 1);
  const startPad = first.getDay();
  const days = new Date(ys, ms, 0).getDate();
  let cells = '';
  for (let i = 0; i < startPad; i++) cells += '<div class="cal-cell mute"></div>';
  for (let d = 1; d <= days; d++) {
    const iso = ys + '-' + String(ms).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const hit = events.some(e => e.date === iso);
    cells += `<button type="button" class="cal-cell${hit ? ' hit' : ''}${iso === todayISO() ? ' today' : ''}" data-day="${iso}">${d}</button>`;
  }
  const label = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return `<div class="row between mt16"><button type="button" class="text-btn" data-month="-1">‹</button><span class="who">${label}</span><button type="button" class="text-btn" data-month="1">›</button></div>
    <div class="cal-grid mt8"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>${cells}</div>`;
}

export function renderDay() {
  const ctx = leagueContext(state.league);
  const events = buildEvents(ctx).filter(e => e.date === dayOpen);
  const body = events.map(e => `<div class="trow"><div class="grow"><div class="who">${esc(e.title)}</div><div class="t-small">${esc(e.sub)}</div></div></div>`).join('');
  return `<div class="modal-scrim" data-close-sheet><div class="modal" role="dialog">
    <div class="serif t-head">${esc(dayOpen)}</div>
    <div class="card flush mt12">${body || '<div class="empty">No league that day.</div>'}</div>
    ${events.some(e => e.kind === 'outing') ? '<button class="btn forest mt12" type="button" data-open-outing="' + (events.find(e => e.kind === 'outing').which) + '">Outing details</button>' : ''}
    <button class="btn ghost mt12" type="button" data-close-sheet>Close</button>
  </div></div>`;
}

export function renderOuting() {
  const which = signupWhich;
  const o = which === 'mid' ? (state.league.outing || {}) : (state.league.outing2 || {});
  const label = which === 'mid' ? 'Mid-season outing' : 'Season outing';
  const signups = o.signups || [];
  const teams = o.teams || [];
  const onList = signups.some(s => s.name === state.identity);
  const past = looseDate(o.date || '', ((calendarOf(state.league)[0] || {}).date || '2026').slice(0, 4)) < todayISO();
  const detail = [
    o.date && 'Date · ' + o.date,
    o.tee && 'Tee · ' + prettyTee(o.tee),
    o.course && 'Course · ' + o.course,
    o.holes && 'Format · ' + o.holes,
    o.format && o.format,
    o.dinner && 'Dinner · ' + o.dinner,
    o.cost && 'Cost · ' + o.cost
  ].filter(Boolean).map(line => `<p class="mt8">${esc(line)}</p>`).join('');
  const people = signups.map(s => `<div class="trow"><div class="who">${esc(s.name)}</div></div>`).join('');
  const teamRows = teams.map(t => `<div class="trow"><b>${esc(t.num)}</b><div class="grow">${(t.players || []).map(p => `<div>${esc(p)}</div>`).join('')}</div></div>`).join('');
  return `<div class="modal-scrim" data-close-sheet><div class="modal" role="dialog">
    <div class="serif t-head">${esc(label)}</div>
    ${detail || '<p class="t-small mt8">Details coming soon.</p>'}
    ${people ? `<div class="t-label mt16">Signed up · ${signups.length}</div><div class="card flush mt8">${people}</div>` : '<p class="t-small mt12">No sign-ups posted.</p>'}
    ${teamRows ? `<div class="t-label mt16">Teams</div><div class="card flush mt8">${teamRows}</div>` : ''}
    ${past ? '' : '<button class="btn forest mt16" type="button" data-action="send-signup">Sign up</button>'}
    ${onList ? '<button class="btn ghost mt8" type="button" data-action="remove-signup">Remove me</button>' : ''}
    <p id="signup-status" class="status-line" hidden></p>
    <button class="btn ghost mt12" type="button" data-close-sheet>Close</button>
  </div></div>`;
}

let dayOpen = '';

export function renderSignup() {
  const which = signupWhich;
  const o = which === 'mid' ? (state.league.outing || {}) : (state.league.outing2 || {});
  return `<div class="modal-scrim" data-close-sheet>
    <div class="modal" role="dialog">
      <div class="serif t-head">Sign up</div>
      <p class="t-small mt8">${esc(o.date || '')} ${esc(o.course || '')}</p>
      <input id="signup-name" class="search mt16" placeholder="Your name" value="${esc(state.identity || '')}">
      <input id="signup-notes" class="search mt8" placeholder="Notes, optional">
      <button class="btn forest mt16" type="button" data-action="send-signup">Send sign-up</button>
      <p id="signup-status" class="status-line" hidden></p>
    </div>
  </div>`;
}

export function bindSchedule(root) {
  root.querySelectorAll('[data-cal]').forEach(b => b.addEventListener('click', () => {
    calView = b.dataset.cal;
    commit();
  }));
  root.querySelectorAll('[data-month]').forEach(b => b.addEventListener('click', () => {
    const [y, m] = (gridCursor || todayISO().slice(0, 7)).split('-').map(Number);
    const d = new Date(y, m - 1 + Number(b.dataset.month), 1);
    gridCursor = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    commit();
  }));
  root.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => {
    dayOpen = b.dataset.day;
    commit({ sheet: 'day' });
  }));
  root.querySelectorAll('.ev').forEach((row, i) => {
    const events = buildEvents(leagueContext(state.league));
    const ev = events[i];
    if (!ev) return;
    row.addEventListener('click', () => {
      if (ev.kind === 'outing') {
        signupWhich = ev.which;
        commit({ sheet: 'outing' });
      } else {
        dayOpen = ev.date;
        commit({ sheet: 'day' });
      }
    });
  });
}

export function bindSignup(root) {
  const btn = root.querySelector('[data-action=send-signup]');
  if (btn) btn.addEventListener('click', async () => {
    const nameEl = root.querySelector('#signup-name');
    const notesEl = root.querySelector('#signup-notes');
    const name = (nameEl ? nameEl.value : state.identity || '').trim();
    const notes = notesEl ? notesEl.value.trim() : '';
    const status = root.querySelector('#signup-status');
    if (!name) { if (status) { status.hidden = false; status.textContent = 'Set your name in Settings first.'; } return; }
    const which = signupWhich;
    const o = which === 'mid' ? (state.league.outing || {}) : (state.league.outing2 || {});
    const label = which === 'mid' ? 'Mid-Season' : 'End-of-Season';
    btn.disabled = true;
    status.hidden = false;
    status.textContent = 'Sending…';
    try {
      await postScript({
        type: 'outing_signup',
        outing: which === 'mid' ? 'mid' : 'end',
        outingLabel: label,
        outingDate: o.date || '',
        name,
        notes,
        submitted: new Date().toISOString()
      });
      status.textContent = "You're signed up. The list updates after the next publish.";
    } catch {
      const subject = encodeURIComponent('WGL ' + label + ' Outing Sign-Up: ' + name);
      const body = encodeURIComponent('Name: ' + name + '\n' + (notes ? 'Notes: ' + notes + '\n' : ''));
      window.location.href = 'mailto:wglscore@gmail.com?subject=' + subject + '&body=' + body;
    }
  });
  const remove = root.querySelector('[data-action=remove-signup]');
  if (remove) remove.addEventListener('click', async () => {
    const name = state.identity;
    const status = root.querySelector('#signup-status');
    if (!name) { if (status) { status.hidden = false; status.textContent = 'Set your name first.'; } return; }
    const which = signupWhich;
    const o = which === 'mid' ? (state.league.outing || {}) : (state.league.outing2 || {});
    const label = which === 'mid' ? 'Mid-Season' : 'End-of-Season';
    if (status) { status.hidden = false; status.textContent = 'Sending…'; }
    try {
      await postScript({
        type: 'outing_remove',
        outing: which === 'mid' ? 'mid' : 'end',
        outingLabel: label,
        outingDate: o.date || '',
        name,
        submitted: new Date().toISOString()
      });
      if (status) status.textContent = 'Removal requested.';
    } catch {
      window.location.href = 'mailto:wglscore@gmail.com?subject=' + encodeURIComponent('WGL ' + label + ' Outing REMOVAL: ' + name);
    }
  });
  root.querySelectorAll('[data-open-outing]').forEach(b => b.addEventListener('click', () => {
    signupWhich = b.dataset.openOuting;
    commit({ sheet: 'outing' });
  }));
}

void html;
