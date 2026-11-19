import { PENALTY_PER_CARD, PLAYOFF_FIRST, PREV_THROUGH, PREV_TOTALS, TEAM_COUNT } from './config.js';

function teamNets(players) {
  return (players || [])
    .map(p => +p.net)
    .filter(n => !Number.isNaN(n))
    .sort((a, b) => a - b);
}

// Four lowest nets. Each missing card is +50, same rule as the live app.
export function teamWeekScore(players) {
  const nets = teamNets(players);
  const counting = nets.slice(0, 4);
  const missing = Math.max(0, 4 - nets.length);
  const score = counting.reduce((s, n) => s + n, 0) + PENALTY_PER_CARD * missing;
  return { score, missing, penalty: missing > 0, count: nets.length };
}

export function indexWeeks(weeks) {
  const byTeam = {};
  for (let t = 1; t <= TEAM_COUNT; t++) byTeam[t] = {};
  for (const [wkStr, wk] of Object.entries(weeks || {})) {
    const wkN = +wkStr;
    const buckets = {};
    for (const p of wk.players || []) (buckets[p.team] ||= []).push(p);
    for (let t = 1; t <= TEAM_COUNT; t++) byTeam[t][wkN] = teamWeekScore(buckets[t] || []);
  }
  return byTeam;
}

export function teamStandings(weeks) {
  const byTeam = indexWeeks(weeks);
  const reg = Object.keys(weeks || {}).map(Number).filter(w => w < PLAYOFF_FIRST);
  const lastReg = reg.length ? Math.max(...reg) : PREV_THROUGH;
  const rows = [];
  for (let t = 1; t <= TEAM_COUNT; t++) {
    let prev = PREV_TOTALS[t] || 0;
    let sum = 0;
    for (const [w, cell] of Object.entries(byTeam[t])) {
      if (+w >= PLAYOFF_FIRST) continue;
      sum += cell.score;
      if (+w <= PREV_THROUGH) prev -= cell.score;
    }
    rows.push({
      team: t,
      season: prev + sum,
      last: byTeam[t][lastReg] || null
    });
  }
  rows.sort((a, b) => a.season - b.season || a.team - b.team);
  rows.forEach((r, i) => { r.rank = i + 1; });
  const leader = rows[0] ? rows[0].season : 0;
  rows.forEach(r => { r.gap = r.season - leader; });
  return { rows, lastReg, byTeam };
}

export function lowHandicapName(roster, team) {
  let best = null;
  for (const [name, info] of Object.entries(roster || {})) {
    if (+info.team !== +team) continue;
    if (info.captain) return name;
    if (!best || +info.hcp < +best.hcp) best = { name, hcp: +info.hcp };
  }
  return best ? best.name : '';
}

export function captainLabel(roster, team) {
  for (const [name, info] of Object.entries(roster || {})) {
    if (+info.team === +team && info.captain) return name;
  }
  return '';
}

// Week results group players the way the live results tab does: a scored
// player is filed under their current roster team. Season standings above
// use the team stored on that week's card instead.
export function weekBoard(weekData, roster) {
  const scored = {};
  for (const p of (weekData && weekData.players) || []) scored[p.name] = p;
  const teams = [];
  for (let t = 1; t <= TEAM_COUNT; t++) {
    const rows = [];
    const seen = new Set();
    for (const [name, info] of Object.entries(roster || {})) {
      if (+info.team !== t) continue;
      seen.add(name);
      const s = scored[name];
      if (s) rows.push({ name, team: t, hcp: s.hcp, gross: +s.gross, net: +s.net, dns: false });
      else rows.push({ name, team: t, hcp: info.hcp, dns: true });
    }
    for (const p of (weekData && weekData.players) || []) {
      if (seen.has(p.name)) continue;
      if (+p.team !== t) continue;
      rows.push({ name: p.name, team: t, hcp: p.hcp, gross: +p.gross, net: +p.net, dns: false });
    }
    const played = rows.filter(r => !r.dns).sort((a, b) => a.net - b.net);
    const counting = new Set(played.slice(0, 4).map(p => p.name));
    const missing = Math.max(0, 4 - played.length);
    const total = played.slice(0, 4).reduce((s, p) => s + p.net, 0) + PENALTY_PER_CARD * missing;
    rows.sort((a, b) => (+a.hcp || 99) - (+b.hcp || 99) || a.name.localeCompare(b.name));
    teams.push({ team: t, rows, counting, missing, total, played: played.length });
  }
  teams.sort((a, b) => a.total - b.total || a.team - b.team);
  teams.forEach((t, i) => { t.rank = i + 1; });
  return teams;
}

export function playerBoard(weeks, roster) {
  const rounds = {};
  const weekNums = Object.keys(weeks || {}).map(Number).filter(w => w < PLAYOFF_FIRST).sort((a, b) => a - b);
  for (const w of weekNums) {
    for (const p of weeks[w].players || []) {
      (rounds[p.name] ||= []).push({ week: w, net: +p.net, gross: +p.gross, hcp: +p.hcp });
    }
  }
  const rows = [];
  for (const [name, info] of Object.entries(roster || {})) {
    const list = rounds[name] || [];
    if (!list.length) continue;
    const avg = list.reduce((s, r) => s + r.net, 0) / list.length;
    const firstHcp = list[0].hcp;
    const current = +info.hcp;
    rows.push({
      name,
      team: +info.team,
      hcp: current,
      delta: current - firstHcp,
      avg,
      rounds: list,
      series: list.map(r => r.hcp)
    });
  }
  rows.sort((a, b) => a.avg - b.avg || a.name.localeCompare(b.name));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

function rankOf(rows, team) {
  return (rows.find(r => r.team === team) || {}).rank || null;
}

// Semis are 1v4 and 2v3 in week 18. Week 19 is the final and the 3rd-place match.
// A tie goes to the higher regular-season seed.
export function playoffBracket(standings, weeks) {
  const rows = standings.rows;
  if (rows.length < 4) return null;
  const seeds = rows.slice(0, 4).map(r => r.team);
  const score = (week, team) => {
    const wk = weeks && weeks[week];
    if (!wk) return null;
    const players = (wk.players || []).filter(p => +p.team === +team);
    if (!players.length && !Object.prototype.hasOwnProperty.call(weeks, week)) return null;
    return teamWeekScore(players);
  };
  const match = (a, b, week) => {
    const sa = score(week, a);
    const sb = score(week, b);
    if (!sa || !sb) return { a, b, sa, sb, winner: null, tie: false };
    let winner;
    let tie = false;
    if (sa.score === sb.score) {
      tie = true;
      winner = (rankOf(rows, a) < rankOf(rows, b)) ? a : b;
    } else winner = sa.score < sb.score ? a : b;
    return { a, b, sa, sb, winner, loser: winner === a ? b : a, tie };
  };
  const semis = [match(seeds[0], seeds[3], 18), match(seeds[1], seeds[2], 18)];
  const final = (semis[0].winner && semis[1].winner)
    ? match(semis[0].winner, semis[1].winner, 19) : null;
  const third = (semis[0].loser && semis[1].loser)
    ? match(semis[0].loser, semis[1].loser, 19) : null;
  const any = semis.some(m => m.sa || m.sb) || (weeks && (weeks[18] || weeks[19]));
  if (!any) return null;
  return { semis, final, third, seeds };
}
