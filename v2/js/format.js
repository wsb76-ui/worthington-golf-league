import { TZ } from './config.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function raw(html) {
  return { __raw: String(html ?? '') };
}

export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i >= vals.length) return;
    const v = vals[i];
    if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, '__raw')) out += v.__raw;
    else out += esc(v);
  });
  return out;
}

export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

export function zonedParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const bag = {};
  for (const p of fmt.formatToParts(now)) bag[p.type] = p.value;
  return bag;
}

export function formatISO(iso, opts) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', opts);
}

export function longDate(iso) {
  return formatISO(iso, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function monthDay(iso) {
  return formatISO(iso, { month: 'short', day: 'numeric' });
}

export function weekdayShort(iso) {
  return formatISO(iso, { weekday: 'short' });
}

export function monthKey(iso) {
  return formatISO(iso, { month: 'long' });
}

export function ordinal(n) {
  const v = +n;
  const s = ['th', 'st', 'nd', 'rd'];
  const m = v % 100;
  return v + (s[(m - 20) % 10] || s[m] || s[0]);
}

export function placeWord(n) {
  return ordinal(n);
}

export function initials(name) {
  const bits = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!bits.length) return '•';
  if (bits.length === 1) return bits[0].slice(0, 2).toUpperCase();
  return (bits[0][0] + bits[bits.length - 1][0]).toUpperCase();
}

export function lastName(name) {
  const bits = String(name || '').trim().split(/\s+/);
  return bits[bits.length - 1] || name;
}

export function shortName(name, others) {
  const first = String(name || '').split(' ')[0];
  const dupes = (others || []).filter(n => String(n).split(' ')[0] === first);
  if (dupes.length > 1) return first + ' ' + (lastName(name)[0] || '') + '.';
  return first;
}

export function toParText(n) {
  if (n == null || Number.isNaN(+n)) return '—';
  const v = +n;
  if (v === 0) return 'E';
  return (v > 0 ? '+' : '−') + Math.abs(v);
}

export function money(n) {
  if (n == null || n === '') return '';
  const v = parseFloat(String(n).replace(/[^0-9.]/g, ''));
  if (!v) return '';
  return '$' + (v % 1 === 0 ? v.toLocaleString('en-US') : v.toFixed(2));
}

export function comma(n) {
  return (+n).toLocaleString('en-US');
}

export function roundName(week) {
  const w = +week;
  if (w === 18) return 'Semifinals';
  if (w === 19) return 'Finals';
  return '';
}

export function weekTitle(week) {
  const r = roundName(week);
  return 'Week ' + (+week) + (r ? ' · ' + r : '');
}

const AVATAR_TONES = [
  ['#E3E8D9', '#2E5739'],
  ['#F2E8CC', '#8A6A1F'],
  ['#F3E1D4', '#B5542B'],
  ['#E1E6EA', '#4B5E6B']
];

export function avatarTone(i) {
  return AVATAR_TONES[i % AVATAR_TONES.length];
}
