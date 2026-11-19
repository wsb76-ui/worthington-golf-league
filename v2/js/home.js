import { COURSE, FIRST_TEE, LEAGUE_NAME, PLAYOFF_FIRST, TZ } from './config.js';
import { nineTitle, sideForWeek, sideRange } from './course.js';
import { html, lastName, longDate, placeWord, raw, todayISO } from './format.js';
import { avatar, svg, windArrow } from './ui.js';
import { commit, go, saveSession, state } from './state.js';
import { playoffBracket, seasonChampion, teamStandings } from './scoring.js';
import { homeNews } from './news.js';

export function calendarOf(league) {
  return ((league && league.calendar) || [])
    .filter(c => c && c.date)
    .slice()
    .sort((a, b) => a.date < b.date ? -1 : 1);
}

export function leagueContext(league) {
  const today = todayISO();
  const cal = calendarOf(league);
  const todayEv = cal.find(c => c.date === today) || null;
  const upcoming = cal.find(c => c.date >= today) || null;
  const last = [...cal].reverse().find(c => c.date < today) || null;
  const regLeft = cal.filter(c => c.date >= today && +c.week < PLAYOFF_FIRST).length;
  const seasonOver = !!(cal.length && today > cal[cal.length - 1].date);
  const focus = todayEv || upcoming || last;
  return { today, cal, todayEv, upcoming, last, regLeft, seasonOver, focus, leagueNight: !!todayEv };
}

export function isLeagueNight(league) {
  return leagueContext(league).leagueNight;
}

export function playedWeeks(weeks, league) {
  const today = todayISO();
  const cal = calendarOf(league);
  const out = {};
  for (const [k, v] of Object.entries(weeks || {})) {
    const hit = cal.find(c => +c.week === +k);
    if (hit && hit.date > today) continue;
    out[k] = v;
  }
  return out;
}

export function weekForDate(league, iso) {
  if (!iso) return null;
  const hit = calendarOf(league).find(c => c.date === iso);
  return hit ? +hit.week : null;
}

// The Monday the card is for, then today's league night, then settings.week.
export function cardWeek(league, targetDate) {
  const chosen = weekForDate(league, targetDate);
  if (chosen) return chosen;
  const tonight = weekForDate(league, todayISO());
  if (tonight) return tonight;
  const fallback = league && league.settings && league.settings.week;
  return fallback || '?';
}

function teeLine(settings) {
  if (settings && settings.teeTime) return 'Tee time ' + settings.teeTime;
  if (settings && settings.firstTee) return 'First group ' + settings.firstTee;
  return 'First group ' + FIRST_TEE;
}

function story(ctx) {
  const settings = (state.league && state.league.settings) || {};
  if (!ctx.focus) {
    return {
      eyebrow: LEAGUE_NAME,
      title: 'Monday nights',
      sub: COURSE
    };
  }
  const week = ctx.focus.week;
  const side = sideForWeek(week);
  const when = longDate(ctx.focus.date);
  const eyebrow = 'Week ' + week + ' · ' + when;
  if (ctx.todayEv) {
    const playoff = +week === 18 ? 'Semifinals tonight' : +week === 19 ? 'Championship tonight' : null;
    return {
      eyebrow,
      title: playoff || (nineTitle(side) + ' tonight'),
      sub: COURSE + ' · ' + teeLine(settings)
    };
  }
  if (ctx.upcoming && ctx.upcoming.date > ctx.today) {
    const days = Math.round((new Date(ctx.upcoming.date + 'T12:00:00') - new Date(ctx.today + 'T12:00:00')) / 86400000);
    return {
      eyebrow: 'Week ' + ctx.upcoming.week + ' · ' + longDate(ctx.upcoming.date),
      title: days === 1 ? 'Tomorrow' : days + ' days',
      sub: 'Next league night · ' + COURSE
    };
  }
  if (ctx.seasonOver) {
    const last = ctx.cal[ctx.cal.length - 1];
    const nextYear = last && +ctx.today.slice(0, 4) > +last.date.slice(0, 4);
    if (nextYear) {
      return {
        eyebrow: last.date.slice(0, 4) + ' season ended',
        title: 'Next season',
        sub: 'Next league date posts with the new calendar'
      };
    }
    const lastReg = [...ctx.cal].reverse().find(c => +c.week < PLAYOFF_FIRST);
    return {
      eyebrow: lastReg ? ('Through week ' + lastReg.week) : 'Season complete',
      title: 'Season complete',
      sub: COURSE + ' · Butler, PA'
    };
  }
  return {
    eyebrow,
    title: nineTitle(side) + ' Monday',
    sub: COURSE + ' · ' + teeLine(settings)
  };
}

function raceCopy(rows, identity, roster) {
  const me = roster[identity];
  const mine = me ? rows.find(r => r.team === +me.team) : null;
  const leader = rows[0];
  const ctx = leagueContext(state.league);
  let label = 'Team race';
  if (ctx.regLeft > 0) label += ' · ' + ctx.regLeft + ' week' + (ctx.regLeft === 1 ? '' : 's') + ' left';
  else if (ctx.seasonOver) label += ' · Final';
  else label += ' · Playoffs';
  if (!leader) return { label, title: 'Standings', total: '—', detail: '' };
  if (!mine) {
    const second = rows[1];
    const ahead = second ? (second.season - leader.season) : 0;
    return {
      label,
      team: leader.team,
      place: '1st',
      total: leader.season,
      detail: ahead ? (ahead + ' ahead of Team ' + second.team) : 'Tied at the top'
    };
  }
  const aheadOf = rows.find(r => r.rank === mine.rank + 1);
  let detail = 'Tied for the lead';
  if (mine.rank > 1 && mine.gap === 0) detail = 'Tied with Team ' + leader.team;
  else if (mine.rank > 1) detail = mine.gap + ' behind Team ' + leader.team;
  else if (aheadOf) detail = (aheadOf.season - mine.season) + ' ahead of Team ' + aheadOf.team;
  return {
    label,
    team: mine.team,
      place: placeWord(mine.rank),
    total: mine.season,
    detail
  };
}

export function renderHome() {
  const league = state.league || {};
  const roster = league.players || {};
  const ctx = leagueContext(league);
  const s = story(ctx);
  const weeks = playedWeeks(state.weeks, league);
  const standings = teamStandings(weeks);
  const race = raceCopy(standings.rows, state.identity, roster);
  const playoffNight = ctx.todayEv && (+ctx.todayEv.week === 18 || +ctx.todayEv.week === 19);
  const champs = seasonChampion(standings, weeks);
  const group = state.session.players || [];
  const side = group.length ? state.session.side : (ctx.focus ? sideForWeek(ctx.focus.week) : 'back');
  const names = group.map(p => lastName(p.name)).join(' · ');
  const wx = state.weather;

  return html`
    <section class="hero">
      <div class="brand">
        <img src="./assets/crest.png" alt="" width="30" height="30">
        <div class="serif brand-name">${LEAGUE_NAME}</div>
        <button class="gear" type="button" data-go="settings" aria-label="Settings">⚙</button>
        <button class="avatar avatar-btn" type="button" data-action="identity" aria-label="Choose your name">${state.identity ? initials(state.identity) : '•'}</button>
      </div>
      <div class="page hero-copy">
        <div class="eyebrow">${s.eyebrow}</div>
        <h1 class="serif t-display">${s.title}</h1>
        <p class="hero-sub">${s.sub}</p>
        <p class="t-small mt8" style="color:#C9D3BF">${state.syncLabel || ''} · pull to refresh</p>
      </div>
      ${wx ? raw(`<div class="wx">
        <div>${svg('sun', 26)}<div><div class="v">${wx.temp}°</div><div class="k">${escKeep(wx.sky)}</div></div></div>
        <div>${windArrow(wx.windDeg)}<div><div class="v">${wx.wind} mph</div><div class="k">From ${escKeep(wx.windFrom)}</div></div></div>
        <div>${svg('drop', 26)}<div><div class="v">${wx.rain}%</div><div class="k">Rain</div></div></div>
      </div>`) : raw('<div class="wx wx-empty"></div>')}
    </section>
    <div class="lift card pad">
      <div class="t-label">Your group</div>
      <div class="t-head mt4">${names || 'Add the players on your card'}</div>
      <div class="row between mt12">
        <div class="stack">
          ${group.length
            ? raw(group.slice(0, 4).map((p, i) => avatar(p.name, i)).join(''))
            : raw('<div class="avatar">+</div>')}
        </div>
        <span class="t-small">${sideRange(side)}</span>
      </div>
      <button class="btn primary mt16" type="button" data-action="start">${raw(svg('card', 20))} ${group.length && state.session.started ? 'Resume scorecard' : 'Start scorecard'}</button>
    </div>
    ${raw(champs ? championCard(champs, (ctx.cal[0] && ctx.cal[0].date.slice(0, 4)) || ctx.today.slice(0, 4)) : '')}
    ${raw(playoffNight ? matchupCard(standings, weeks, +ctx.todayEv.week, roster) : '')}
    ${playoffNight ? '' : raw(`<div class="page block">
      <div class="card race">
        <div>
          <div class="t-label">${race.label}</div>
          <div class="mt4 race-title">Team ${race.team || '—'} <span class="serif place">${race.place || ''}</span></div>
        </div>
        <div class="race-num">
          <div class="serif t-head num">${race.total === '—' ? '—' : Number(race.total).toLocaleString('en-US')}</div>
          <div class="t-small">${race.detail || ''}</div>
        </div>
      </div>
    </div>`)}
    ${raw(outingCard(league, ctx))}
    <div class="page block">
      <div class="t-label">Browse</div>
      <div class="card flush mt8">
        <button class="hub" type="button" data-go="gps"><b>Yardages</b><span>Map and distances</span></button>
        <button class="hub" type="button" data-go="results"><b>Results</b><span>Latest week</span></button>
        <button class="hub" type="button" data-go="standings"><b>Standings</b><span>Teams and players</span></button>
        <button class="hub" type="button" data-go="news"><b>League news</b><span>Announcements</span></button>
        <button class="hub" type="button" data-go="roster"><b>Roster & dues</b><span>Players and payments</span></button>
        <button class="hub" type="button" data-go="schedule"><b>Schedule</b><span>Mondays and the outing</span></button>
        <button class="hub" type="button" data-go="my"><b>My stats</b><span>Rounds and banked cards</span></button>
      </div>
    </div>
    ${raw(homeNews())}`;
}

function championCard(champs, year) {
  return `<div class="page block"><div class="card pad"><div class="serif t-title">${year} Champions · Team ${champs.team}</div><p class="t-small mt4">Regular-season winner · Team ${champs.regular}</p></div></div>`;
}

function matchupCard(standings, weeks, week, roster) {
  const bracket = playoffBracket(standings, weeks);
  if (!bracket) return '';
  const me = roster[state.identity];
  const mine = me ? +me.team : 0;
  const rows = week === 18 ? bracket.semis : [bracket.final, bracket.third].filter(Boolean);
  const labels = week === 18 ? ['Semifinal', 'Semifinal'] : ['Championship', '3rd place'];
  const body = rows.map((m, i) => {
    if (!m) return '';
    const you = m.a === mine || m.b === mine;
    return `<div class="trow ${you ? 'me' : ''}"><div class="grow"><div class="who">Team ${m.a} vs Team ${m.b}</div><div class="t-small">${labels[i] || ''}</div></div>${you ? '<span class="pill sage">You</span>' : ''}</div>`;
  }).join('');
  return `<div class="page block"><div class="t-label">Tonight</div><div class="card flush mt8">${body}</div></div>`;
}

function outingCard(league, ctx) {
  const o = outingOn(league, ctx.today);
  if (!o) return '';
  const gps = o.gps && Object.keys(o.gps).length;
  return html`
    <div class="page block">
      <div class="card pad">
        <div class="t-label">Outing today</div>
        <div class="t-head mt4">${o.name || 'League outing'}</div>
        <p class="t-small mt4">${o.course || ''} ${o.tee ? '· ' + o.tee : ''}</p>
        <button class="btn forest mt12" type="button" data-go="score">Outing scorecard</button>
        ${gps ? raw('<button class="btn ghost mt8" type="button" data-go="gps">GPS yardages</button>') : ''}
      </div>
    </div>`;
}

function outingOn(league, today) {
  const year = today.slice(0, 4);
  for (const o of [league.outing, league.outing2]) {
    if (!o || !o.date) continue;
    const rawDate = String(o.date).trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : isoFromLoose(rawDate, year);
    if (parsed === today) return o;
  }
  return null;
}

function isoFromLoose(value, year) {
  const d = new Date(value + ' ' + year);
  if (Number.isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function initials(name) {
  const bits = String(name).trim().split(/\s+/);
  if (bits.length < 2) return (bits[0] || '•').slice(0, 2).toUpperCase();
  return (bits[0][0] + bits[bits.length - 1][0]).toUpperCase();
}

function escKeep(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export function bindHome(root) {
  const start = root.querySelector('[data-action=start]');
  if (start) start.addEventListener('click', () => {
    if (state.session.players.length) {
      state.session.started = true;
      state.scoreMode = 'hole';
      saveSession();
    } else {
      state.scoreMode = 'setup';
    }
    go('score');
  });
  const id = root.querySelector('[data-action=identity]');
  if (id) id.addEventListener('click', () => { commitIdentity(); });
}

function commitIdentity() {
  commit({ sheet: 'identity' });
}

export function refreshWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=40.88&longitude=-79.81'
    + '&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability'
    + '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=' + encodeURIComponent(TZ);
  fetch(url).then(r => r.json()).then(d => {
    const c = d.current;
    if (!c) return;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    commit({
      weather: {
        temp: Math.round(c.temperature_2m),
        sky: skyLabel(c.weather_code),
        wind: Math.round(c.wind_speed_10m),
        windFrom: dirs[Math.round(c.wind_direction_10m / 45) % 8],
        windDeg: c.wind_direction_10m,
        rain: c.precipitation_probability
      }
    });
  }).catch(() => {});
}

function skyLabel(code) {
  if (code === 0 || code === 1) return 'Sunny';
  if (code <= 3) return 'Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  return 'Storms';
}

