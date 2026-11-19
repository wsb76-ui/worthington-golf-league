import { html, initials, avatarTone } from './format.js';

export const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  results: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.6 4M16 6h3.5a3 3 0 0 1-3.6 4M12 13v4M8.5 20.5h7M10 17h4l.5 3.5h-5z"/>',
  score: '<path d="M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h3"/>',
  standings: '<path d="M5 20V12M12 20V5M19 20v-5"/>',
  schedule: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chev: '<path d="M1 1l6 6-6 6"/>',
  flag: '<path d="M6 21V4M6 4l11 4-11 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  drop: '<path d="M12 3.5s6 6.6 6 10.5a6 6 0 0 1-12 0c0-3.9 6-10.5 6-10.5z"/>',
  card: '<path d="M6 3h9l3 3v15H6zM9 9h6M9 13h6"/>'
};

export function svg(name, size = 24) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

export function avatar(name, i = 0, size = 36) {
  const [bg, fg] = avatarTone(i);
  return html`<div class="avatar" style="width:${size}px;height:${size}px;background:${bg};color:${fg}">${initials(name)}</div>`;
}

export function windArrow(degrees) {
  const rot = Math.round(degrees || 0);
  return `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="11" fill="none" stroke="rgba(244,239,226,.35)"/><g transform="rotate(${rot} 13 13)"><path d="M13 4.2l3.2 9.2H9.8z" fill="#E08A5E"/></g></svg>`;
}

export function tabsHtml(screen) {
  const item = (id, label, icon) => {
    const on = screen === id ? ' on' : '';
    if (id === 'score') {
      return `<button class="tab score${on}" data-screen="score" type="button"><span class="fab">${svg('score', 26)}</span>Score</button>`;
    }
    return `<button class="tab${on}" data-screen="${id}" type="button">${svg(icon, 26)}${label}</button>`;
  };
  return [
    item('home', 'Home', 'home'),
    item('results', 'Results', 'results'),
    item('score', 'Score', 'score'),
    item('standings', 'Standings', 'standings'),
    item('schedule', 'Schedule', 'schedule')
  ].join('');
}

export function bindTabs(root, go) {
  root.querySelectorAll('[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => go(btn.dataset.screen));
  });
}

export function scrim(inner) {
  return `<div class="scrim" data-close-sheet></div><div class="sheet" role="dialog">${inner}</div>`;
}
