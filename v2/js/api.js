import { DATA_URL, FALLBACK_DATA_URL, SCRIPT_URL, VERIFIED_WEEKS_URL } from './config.js';
import { cacheLeague, readLeagueCache } from './state.js';

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function loadVerifiedWeeks() {
  try {
    return await fetchJson(VERIFIED_WEEKS_URL);
  } catch {
    return {};
  }
}

export async function loadLeagueJson() {
  const stamp = Date.now();
  try {
    const json = await fetchJson(DATA_URL + '?t=' + stamp);
    cacheLeague(json);
    return { json, source: 'live' };
  } catch { /* raw github blocked or offline */ }
  try {
    const json = await fetchJson(FALLBACK_DATA_URL + '?t=' + stamp);
    cacheLeague(json);
    return { json, source: 'repo' };
  } catch { /* local file missing */ }
  const cached = readLeagueCache();
  if (cached) return { json: cached, source: 'cache' };
  throw new Error('League data is unavailable offline.');
}

// verified-weeks.json is the 2026 paper card file. The 2026 engine export
// disagrees with those cards, so for a 2026 calendar the paper file fills a
// week unless that published week is marked "authoritative": true (a
// commissioner correction). Any other season ignores the file and uses
// whatever wgl-data.json publishes, including a week the engine adds later.
export function mergeWeeks(verified, published) {
  const weeks = {};
  const pub = (published && published.weeks) || {};
  for (const [k, v] of Object.entries(pub)) weeks[+k] = v;
  const year = seasonYear(published);
  if (year !== 2026) return weeks;
  for (const [k, v] of Object.entries(verified || {})) {
    const publishedWeek = pub[k] || pub[String(+k)];
    if (publishedWeek && publishedWeek.authoritative === true) continue;
    weeks[+k] = v;
  }
  return weeks;
}

function seasonYear(published) {
  const explicit = published && published.settings && published.settings.season;
  if (explicit) return +explicit;
  const dates = ((published && published.calendar) || []).map(c => c && c.date).filter(Boolean).sort();
  return dates.length ? +dates[0].slice(0, 4) : null;
}

export async function postScript(payload) {
  const form = new URLSearchParams();
  form.append('data', JSON.stringify(payload));
  const resp = await fetch(SCRIPT_URL, { method: 'POST', body: form });
  let out = null;
  try { out = await resp.json(); } catch { /* non-json still counts as delivered if HTTP ok */ }
  if (out && out.ok === false) throw new Error(out.error || 'Server rejected the card');
  return out;
}

export async function fetchLive() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(SCRIPT_URL + '?action=live', { cache: 'no-store', signal: ctrl.signal });
    const text = await res.text();
    const data = JSON.parse(text);
    if (!data || data.ok === false || data.live !== true) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
