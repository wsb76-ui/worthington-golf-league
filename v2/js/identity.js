import { html, raw } from './format.js';
import { setIdentity, state } from './state.js';

let query = '';

export function renderIdentity() {
  return `<div class="modal-scrim" data-close-sheet>
    <div class="modal" role="dialog">
      <div class="serif t-head">This is me</div>
      <p class="t-small mt8">Stored on this phone. The live app uses the same name.</p>
      <input id="id-search" class="search mt16" placeholder="Search the roster" autocomplete="off" value="${escapeAttr(query)}">
      <div id="id-list" class="id-list">${listHtml()}</div>
      <button class="text-btn mt12" type="button" data-action="clear-id">Clear name</button>
    </div>
  </div>`;
}

function escapeAttr(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function listHtml() {
  const q = query.trim().toLowerCase();
  const names = Object.keys((state.league && state.league.players) || {})
    .filter(n => !q || n.toLowerCase().includes(q))
    .sort((a, b) => a.localeCompare(b));
  if (!names.length) return '<div class="empty">No matching player</div>';
  return names.slice(0, 12).map(n => {
    const on = n === state.identity ? ' on' : '';
    return `<button class="search-hit${on}" type="button" data-name="${escapeAttr(n)}"><span>${escapeAttr(n)}</span></button>`;
  }).join('');
}

export function bindIdentity(root) {
  const input = root.querySelector('#id-search');
  const box = root.querySelector('#id-list');
  const refill = () => {
    box.innerHTML = listHtml();
    box.querySelectorAll('[data-name]').forEach(b => b.addEventListener('click', () => {
      query = '';
      setIdentity(b.dataset.name);
    }));
  };
  if (input) input.addEventListener('input', () => { query = input.value; refill(); });
  refill();
  const clear = root.querySelector('[data-action=clear-id]');
  if (clear) clear.addEventListener('click', () => { query = ''; setIdentity(''); });
}

void html;
void raw;
