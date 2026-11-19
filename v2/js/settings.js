import { html } from './format.js';
import { backBar } from './ui.js';
import { commit, setIdentity, state } from './state.js';

const PREF_KEY = { mode: 'wgl-mode', color: 'wgl-color', font: 'wgl-font', size: 'wgl-size' };

function read(key, fallback) {
  try { return localStorage.getItem(PREF_KEY[key]) || fallback; } catch { return fallback; }
}

const pref = {
  mode: read('mode', 'light'),
  color: read('color', 'forest'),
  font: read('font', 'classic'),
  size: read('size', 'md')
};

function apply() {
  document.body.dataset.mode = pref.mode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : pref.mode;
  document.body.dataset.color = pref.color;
  document.body.dataset.font = pref.font;
  document.body.dataset.size = pref.size;
}

apply();
const mq = window.matchMedia('(prefers-color-scheme: dark)');
if (mq.addEventListener) mq.addEventListener('change', () => { if (pref.mode === 'auto') apply(); });

function set(key, value) {
  pref[key] = value;
  try { localStorage.setItem(PREF_KEY[key], value); } catch { /* private mode */ }
  apply();
}

export function renderSettings() {
  const seg = (key, options) => `<div class="seg mt8">${options.map(([id, label]) =>
    `<button type="button" data-pref="${key}" data-value="${id}" class="${pref[key] === id ? 'on' : ''}">${label}</button>`
  ).join('')}</div>`;
  const names = Object.keys((state.league && state.league.players) || {}).sort((a, b) => a.localeCompare(b));
  const opts = ['<option value="">Not set</option>'].concat(names.map(n =>
    `<option value="${escapeAttr(n)}"${n === state.identity ? ' selected' : ''}>${escapeAttr(n)}</option>`
  )).join('');
  return html`
    ${backBar('Settings')}
    <div class="page">
      <div class="t-label">This is me</div>
      <select id="me-select" class="search mt8">${rawOpts(opts)}</select>
      <p class="t-small mt8">Same name the live app stores on this phone.</p>
      <div class="t-label mt20">Mode</div>
      ${rawOpts(seg('mode', [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']]))}
      <div class="t-label mt20">Color</div>
      ${rawOpts(seg('color', [['forest', 'Forest'], ['gold', 'Gold'], ['slate', 'Slate'], ['earth', 'Earth']]))}
      <div class="t-label mt20">Font</div>
      ${rawOpts(seg('font', [['classic', 'Classic'], ['rounded', 'Rounded'], ['serif', 'Serif']]))}
      <div class="t-label mt20">Text size</div>
      ${rawOpts(seg('size', [['md', 'Normal'], ['lg', 'Large'], ['xl', 'Larger']]))}
      <div class="t-label mt20">Notifications</div>
      <button class="btn ghost mt8" type="button" data-action="push">Enable notifications</button>
      <p class="t-small mt8" id="push-note">League alerts stay inside this v2 install. They do not replace the main app.</p>
      <div class="t-label mt20">Commissioner</div>
      <a class="hub" href="../wgl-admin.html">Open admin</a>
    </div>`;
}

function rawOpts(html) { return { __raw: html }; }
function escapeAttr(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function bindSettings(root) {
  root.querySelectorAll('[data-pref]').forEach(b => b.addEventListener('click', () => {
    set(b.dataset.pref, b.dataset.value);
    commit();
  }));
  const sel = root.querySelector('#me-select');
  if (sel) sel.addEventListener('change', () => setIdentity(sel.value));
  const push = root.querySelector('[data-action=push]');
  if (push) push.addEventListener('click', () => enablePush(root));
}

async function enablePush(root) {
  const note = root.querySelector('#push-note');
  const scope = new URL('./', window.location.href).pathname;
  try {
    if (!window.OneSignal) {
      await loadScript('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js');
    }
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      if (!window.__wgl2Onesignal) {
        await OneSignal.init({
          appId: '2d45ee7e-57a8-450f-bbcd-42a872d6ac59',
          serviceWorkerParam: { scope },
          serviceWorkerPath: scope + 'OneSignalSDKWorker.js'
        });
        window.__wgl2Onesignal = true;
      }
      await OneSignal.Notifications.requestPermission();
      if (note) note.textContent = 'Notifications are on for this install.';
    });
  } catch {
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      if (note) note.textContent = result === 'granted' ? 'Notifications are on.' : 'Notifications were not allowed.';
    } else if (note) note.textContent = 'This browser cannot show notifications.';
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
