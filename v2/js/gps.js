import { HOLES } from './course.js';
import { GREENS, haversineYards, playsLike, yardages } from './greens.js';
import { boost, poke, setDesired, snapshotNow, subscribe } from './gps-watch.js';
import { commit, go } from './state.js';
import { html, raw } from './format.js';

const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

let hole = 10;
let unsub = null;
let view = { zoom: 17, lat: null, lng: null, follow: true, spot: null };

export function noteHole(n) {
  if (!n) return;
  hole = n;
  poke();
}

export function activeHole() { return hole; }

function project(lat, lng, z) {
  const n = 2 ** z;
  const x = (lng + 180) / 360 * n;
  const s = Math.sin(lat * Math.PI / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  return { x, y };
}

function unproject(x, y, z) {
  const n = 2 ** z;
  const lng = x / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  return { lat, lng };
}

function paintStrip(root) {
  const el = root.querySelector('[data-gps-strip]');
  if (!el || !el.isConnected) return;
  const snap = snapshotNow();
  const g = GREENS[hole];
  const fix = snap.fix;
  const box = el.querySelector('[data-yards]');
  if (!fix || !g) {
    box.textContent = snap.status === 'denied' ? 'Location is off' : 'Acquiring GPS…';
    return;
  }
  const y = yardages(g, fix.coords.latitude, fix.coords.longitude);
  const play = playsLike(g, snap.altMeters, y.center);
  const extra = play && Math.abs(play.deltaFt) >= 5
    ? ` · plays ${play.plays}`
    : '';
  box.textContent = `Front ${y.front} · Center ${y.center} · Back ${y.back}${extra}`;
}

export function attachStrip(root) {
  if (unsub) unsub();
  paintStrip(root);
  unsub = subscribe(() => paintStrip(root));
}

export function gpsStripHtml() {
  return `<button class="gps-strip" type="button" data-gps-strip data-action="gps">
    <span class="t-label">Yardages</span>
    <span data-yards>Acquiring GPS…</span>
    <span class="text-btn">Map</span>
  </button>`;
}

function markerStyle(lat, lng, mapLat, mapLng, z, w, h) {
  const c = project(mapLat, mapLng, z);
  const p = project(lat, lng, z);
  const x = w / 2 + (p.x - c.x) * 256;
  const y = h / 2 + (p.y - c.y) * 256;
  return `left:${x}px;top:${y}px`;
}

function drawMap(mapEl) {
  const w = mapEl.clientWidth || 360;
  const h = mapEl.clientHeight || 280;
  const z = view.zoom;
  const g = GREENS[hole];
  const snap = snapshotNow();
  const fix = snap.fix;
  if (view.lat == null) {
    const seed = fix ? [fix.coords.latitude, fix.coords.longitude] : (g ? g.c : [40.882, -79.810]);
    view.lat = seed[0];
    view.lng = seed[1];
  }
  if (view.follow && fix) {
    view.lat = fix.coords.latitude;
    view.lng = fix.coords.longitude;
  }
  const center = project(view.lat, view.lng, z);
  const tiles = [];
  const spanX = Math.ceil(w / 256) + 2;
  const spanY = Math.ceil(h / 256) + 2;
  const cx = Math.floor(center.x);
  const cy = Math.floor(center.y);
  for (let dx = -spanX; dx <= spanX; dx++) {
    for (let dy = -spanY; dy <= spanY; dy++) {
      const tx = cx + dx;
      const ty = cy + dy;
      const left = w / 2 + (tx - center.x) * 256;
      const top = h / 2 + (ty - center.y) * 256;
      if (left > w || top > h || left < -256 || top < -256) continue;
      const src = TILE.replace('{z}', z).replace('{y}', ty).replace('{x}', tx);
      tiles.push(`<img class="tile" alt="" src="${src}" style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px" draggable="false">`);
    }
  }
  let pins = '';
  if (g) {
    pins += `<div class="pin green" style="${markerStyle(g.c[0], g.c[1], view.lat, view.lng, z, w, h)}">G</div>`;
  }
  if (fix) {
    pins += `<div class="pin you" style="${markerStyle(fix.coords.latitude, fix.coords.longitude, view.lat, view.lng, z, w, h)}"></div>`;
  }
  if (view.spot) {
    pins += `<div class="pin spot" style="${markerStyle(view.spot.lat, view.spot.lng, view.lat, view.lng, z, w, h)}"></div>`;
  }
  mapEl.innerHTML = tiles.join('') + pins + '<div class="map-attr">Imagery © Esri</div>';
}

function spotLine() {
  if (!view.spot) return 'Tap the photo to measure a spot.';
  const g = GREENS[hole];
  const snap = snapshotNow();
  const toGreen = g ? haversineYards(view.spot.lat, view.spot.lng, g.c[0], g.c[1]) : null;
  const fix = snap.fix;
  const fromYou = fix ? haversineYards(fix.coords.latitude, fix.coords.longitude, view.spot.lat, view.spot.lng) : null;
  const parts = [];
  if (fromYou != null) parts.push(fromYou + ' from you');
  if (toGreen != null) parts.push(toGreen + ' to the center');
  return parts.join(' · ') || 'Spot marked';
}

function yardLine() {
  const g = GREENS[hole];
  const snap = snapshotNow();
  const info = HOLES[hole] || {};
  const fix = snap.fix;
  if (!fix) {
    const why = snap.status === 'denied' ? 'Location is blocked. Allow it in Settings.' : 'Acquiring GPS…';
    return { front: '—', center: '—', back: '—', note: why, play: '' };
  }
  const y = yardages(g, fix.coords.latitude, fix.coords.longitude);
  const play = playsLike(g, snap.altMeters, y.center);
  let note = '±' + Math.round(fix.coords.accuracy) + ' m';
  if (fix.coords.accuracy > 15) note += ' · move to open sky';
  if (snap.boosted) note += ' · live';
  let playText = '';
  if (play && Math.abs(play.deltaFt) >= 5) {
    playText = (play.deltaFt > 0 ? '▲ ' : '▼ ') + Math.abs(play.deltaFt) + ' ft · plays ' + play.plays;
  } else if (play) playText = 'About level';
  return { ...y, note, play: playText, info };
}

export function renderGps() {
  const info = HOLES[hole] || { par: 4, yds: 0 };
  const y = yardLine();
  return html`
    <div class="gps-screen">
      <div class="backbar light">
        <button type="button" class="back" data-go="home">‹ Home</button>
        <div class="hole-switch">
          <button type="button" data-hole="-1" aria-label="Previous hole">‹</button>
          <div><div class="who">Hole ${hole}</div><div class="t-small">Par ${info.par} · ${info.yds} yds</div></div>
          <button type="button" data-hole="1" aria-label="Next hole">›</button>
        </div>
      </div>
      <div class="gps-map-wrap">
        <div class="gps-map" data-map></div>
        <div class="zoom">
          <button type="button" data-zoom="1" aria-label="Zoom in">+</button>
          <button type="button" data-zoom="-1" aria-label="Zoom out">−</button>
        </div>
      </div>
      <div class="gps-panel">
        <div class="gps-nums">
          <div><span class="t-label">Front</span><b class="num">${y.front}</b></div>
          <div class="ctr"><span class="t-label">Center</span><b class="num">${y.center}</b></div>
          <div><span class="t-label">Back</span><b class="num">${y.back}</b></div>
        </div>
        <div class="row between mt8">
          <span class="t-small" data-note>${y.note}</span>
          <button type="button" class="text-btn" data-action="boost">Live</button>
          <button type="button" class="text-btn" data-action="follow">Recenter</button>
        </div>
        ${y.play ? raw(`<div class="t-small mt4">${y.play}</div>`) : ''}
        <div class="t-small mt8" data-spot>${spotLine()}</div>
        <button type="button" class="text-btn mt8" data-action="elev">Green slope</button>
      </div>
    </div>`;
}

export function renderElev() {
  const g = GREENS[hole];
  const snap = snapshotNow();
  const y = yardLine();
  const you = snap.altMeters != null ? Math.round(snap.altMeters * 3.28084) : null;
  return `<div class="modal-scrim" data-close-sheet>
    <div class="modal" role="dialog">
      <div class="serif t-head">Hole ${hole} green</div>
      <p class="t-small mt8">${g && g.e ? 'Surveyed green ' + g.e + ' ft' : 'No elevation for this hole.'}${you != null ? ' · you ' + you + ' ft' : ''}</p>
      <p class="mt12">${y.play || 'Waiting for a steady altitude.'}</p>
      <p class="t-small mt8">Front ${y.front} · Center ${y.center} · Back ${y.back}. One yard of carry for every three feet of rise or drop, same as the live card.</p>
      <button class="btn forest mt16" type="button" data-close-sheet>Close</button>
    </div>
  </div>`;
}

export function bindGps(root) {
  const mapEl = root.querySelector('[data-map]');
  const redraw = () => { if (mapEl && mapEl.isConnected) drawMap(mapEl); refreshReadout(root); };
  if (unsub) unsub();
  unsub = subscribe(redraw);
  redraw();
  root.querySelectorAll('[data-hole]').forEach(b => b.addEventListener('click', () => {
    hole = Math.max(1, Math.min(18, hole + Number(b.dataset.hole)));
    view.follow = false;
    const g = GREENS[hole];
    if (g) { view.lat = g.c[0]; view.lng = g.c[1]; }
    view.spot = null;
    go('gps');
  }));
  root.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => {
    view.zoom = Math.max(15, Math.min(19, view.zoom + Number(b.dataset.zoom)));
    if (mapEl) drawMap(mapEl);
  }));
  const boostBtn = root.querySelector('[data-action=boost]');
  if (boostBtn) boostBtn.addEventListener('click', () => boost());
  const followBtn = root.querySelector('[data-action=follow]');
  if (followBtn) followBtn.addEventListener('click', () => {
    view.follow = true;
    view.spot = null;
    poke();
  });
  const elev = root.querySelector('[data-action=elev]');
  if (elev) elev.addEventListener('click', () => commit({ sheet: 'elev' }));
  if (!mapEl) return;
  let drag = null;
  mapEl.addEventListener('pointerdown', ev => {
    drag = { x: ev.clientX, y: ev.clientY, lat: view.lat, lng: view.lng, moved: false };
    mapEl.setPointerCapture(ev.pointerId);
  });
  mapEl.addEventListener('pointermove', ev => {
    if (!drag) return;
    const dx = ev.clientX - drag.x;
    const dy = ev.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    view.follow = false;
    const c = project(drag.lat, drag.lng, view.zoom);
    const next = unproject(c.x - dx / 256, c.y - dy / 256, view.zoom);
    view.lat = next.lat;
    view.lng = next.lng;
    drawMap(mapEl);
  });
  mapEl.addEventListener('pointerup', ev => {
    if (!drag) return;
    if (!drag.moved && view.lat != null) {
      const rect = mapEl.getBoundingClientRect();
      const c = project(view.lat, view.lng, view.zoom);
      const dx = ev.clientX - rect.left - rect.width / 2;
      const dy = ev.clientY - rect.top - rect.height / 2;
      view.spot = unproject(c.x + dx / 256, c.y + dy / 256, view.zoom);
      view.follow = false;
    }
    drag = null;
    redraw();
  });
}

function refreshReadout(root) {
  const y = yardLine();
  const nums = root.querySelectorAll('.gps-nums b');
  if (nums.length === 3) {
    nums[0].textContent = y.front;
    nums[1].textContent = y.center;
    nums[2].textContent = y.back;
  }
  const note = root.querySelector('[data-note]');
  if (note) note.textContent = y.note;
  const spot = root.querySelector('[data-spot]');
  if (spot) spot.textContent = spotLine();
}

void raw;
void html;
