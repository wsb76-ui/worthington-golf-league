import { html, raw } from './format.js';
import { backBar } from './ui.js';
import { roundName } from './format.js';
import { state } from './state.js';

export function renderMy() {
  const me = state.identity;
  const info = me && state.league && state.league.players[me];
  if (!me || !info) {
    return html`
      ${backBar('My stats')}
      <div class="page">
        <div class="card pad mt8">
          <div class="serif t-title">Make it yours</div>
          <p class="t-small mt8">Pick your name and this becomes your season: scores, trend, winnings, and banked cards. Stored only on this phone.</p>
          <button class="btn forest mt16" type="button" data-go="settings">Choose my name</button>
        </div>
      </div>`;
  }
  const rounds = [];
  Object.keys(state.weeks || {}).map(Number).sort((a, b) => a - b).forEach(wk => {
    const hit = ((state.weeks[wk] && state.weeks[wk].players) || []).find(e => e.name === me);
    if (hit) rounds.push({ wk, gross: +hit.gross, net: +hit.net, hcp: +hit.hcp });
  });
  const nets = rounds.map(r => r.net);
  const avg = nets.length ? (nets.reduce((a, b) => a + b, 0) / nets.length) : null;
  const best = nets.length ? Math.min(...nets) : null;
  const wins = [];
  for (const [wk, val] of Object.entries((state.league && state.league.weeklyPayouts) || {})) {
    for (const s of val.skins || []) if (s.player === me) wins.push({ wk, label: 'Skin · hole ' + s.hole, amount: s.amount });
    if (val.lowNet && val.lowNet.player === me) wins.push({ wk, label: 'Low net', amount: val.lowNet.amount });
  }
  const bank = (state.league.banked || {})[me] || [];
  return html`
    ${backBar('My stats')}
    <div class="page">
      <div class="card pad">
        <div class="serif t-title">${me}</div>
        <p class="t-small mt4">Team ${info.team}</p>
        <div class="stat-row mt12">
          <div><b>${info.hcp}</b><span>Handicap</span></div>
          <div><b>${rounds.length}</b><span>Rounds</span></div>
          <div><b>${best == null ? '—' : best}</b><span>Best net</span></div>
          <div><b>${avg == null ? '—' : avg.toFixed(1)}</b><span>Avg net</span></div>
        </div>
      </div>
      ${rounds.length ? raw(roundList(rounds)) : raw('<p class="empty">No published rounds yet.</p>')}
      ${wins.length ? raw(winList(wins)) : ''}
      ${bank.length ? raw(bankList(bank)) : ''}
    </div>`;
}

function roundList(rounds) {
  return `<div class="card flush mt16">${rounds.slice().reverse().map(r => {
    const name = roundName(r.wk);
    return `<div class="trow"><div class="grow"><div class="who">Week ${r.wk}${name ? ' · ' + name : ''}</div><div class="t-small">Gross ${r.gross} · HCP ${r.hcp}</div></div><b class="num">${r.net}</b></div>`;
  }).join('')}</div>`;
}

function winList(wins) {
  return `<div class="t-label mt20">Winnings</div><div class="card flush mt8">${wins.map(w =>
    `<div class="trow"><div class="grow"><div class="who">${escapeText(w.label)}</div><div class="t-small">Week ${w.wk}</div></div><b>${w.amount ? '$' + String(w.amount).replace(/^\$/, '') : '—'}</b></div>`
  ).join('')}</div>`;
}

function bankList(bank) {
  return `<div class="t-label mt20">Banked cards</div><div class="card flush mt8">${bank.map(b =>
    `<div class="trow"><div class="grow"><div class="who">${b.side === 'front' ? 'Front' : 'Back'} 9</div><div class="t-small">Played ${escapeText(b.played || '')} · HCP ${b.hcp}</div></div><b>Gross ${b.gross}</b></div>`
  ).join('')}</div>`;
}

function escapeText(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
