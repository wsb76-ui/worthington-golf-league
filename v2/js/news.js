import { html, raw } from './format.js';
import { backBar } from './ui.js';
import { state } from './state.js';

const TAGS = {
  info: ['League notice', 'info'],
  reminder: ['Reminder', 'reminder'],
  alert: ['Action needed', 'alert'],
  success: ['Update', '']
};

export function renderNews() {
  const anns = (state.league && state.league.announcements) || [];
  const cards = anns.map(a => {
    const tag = TAGS[a.tag] || TAGS.success;
    return html`
      <article class="ann ${tag[1]}">
        <div class="t-label">${tag[0]}</div>
        <h2 class="who mt4">${a.title || ''}</h2>
        <p class="mt8">${a.body || ''}</p>
        <div class="t-small mt8">${a.date || ''}</div>
      </article>`;
  }).join('');
  return html`
    ${backBar('League news')}
    <div class="page">
      ${raw(cards || '<p class="empty">No announcements yet.</p>')}
    </div>`;
}

export function homeNews() {
  const anns = ((state.league && state.league.announcements) || []).slice(0, 2);
  if (!anns.length) return '';
  return html`
    <div class="page block">
      <div class="t-label">League news</div>
      <div class="card flush mt8">
        ${anns.map(a => html`<button class="hub" type="button" data-go="news"><b>${a.title || ''}</b><span>${a.date || ''}</span></button>`).join('')}
      </div>
    </div>`;
}
