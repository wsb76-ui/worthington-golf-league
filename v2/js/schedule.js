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
      ${raw(blocks)}
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
  root.querySelectorAll('.ev').forEach((row, i) => {
    const events = buildEvents(leagueContext(state.league));
    const ev = events[i];
    if (!ev || ev.kind !== 'outing' || !ev.pill) return;
    row.addEventListener('click', () => {
      signupWhich = ev.which;
      commit({ sheet: 'signup' });
    });
  });
}

export function bindSignup(root) {
  const btn = root.querySelector('[data-action=send-signup]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const name = root.querySelector('#signup-name').value.trim();
    const notes = root.querySelector('#signup-notes').value.trim();
    const status = root.querySelector('#signup-status');
    if (!name) { root.querySelector('#signup-name').focus(); return; }
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
}

void html;
