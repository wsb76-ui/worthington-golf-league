/**
 * Worthington Golf League — live board for the v2 scorecard.
 *
 * This is NOT deployed from the git repo. Paste it into the existing Apps
 * Script project that already serves the live app, then add the two hooks
 * in DEPLOY.md. It does not change the current doPost score write or the
 * JSON the live site reads.
 *
 * A new sheet named WGL_Live holds one row per hole on each submitted card.
 * doGet?action=live reads only that sheet. Older clients never call it.
 */

var WGL_PARS_ = {
  1:4,2:4,3:3,4:4,5:4,6:4,7:5,8:4,9:3,
  10:5,11:4,12:4,13:4,14:4,15:3,16:4,17:3,18:4
};

function wglLiveSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('WGL_Live');
  if (!sh) {
    sh = ss.insertSheet('WGL_Live');
    sh.appendRow(['timestamp','cardId','date','week','name','team','hcp','hole','score','par','purpose','side']);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Call at the end of the existing doPost, after a score card has been
 * accepted. Ignores outing sign-ups and settings updates (no segments).
 */
function wglMirrorLive_(payload) {
  if (!payload || !payload.segments) return;
  var sh = wglLiveSheet_();
  var stamp = new Date();
  var cardId = Utilities.getUuid();
  var date = wglIsoDate_(payload.date) || Utilities.formatDate(stamp, 'America/New_York', 'yyyy-MM-dd');
  var rows = [];
  payload.segments.forEach(function (seg) {
    (seg.entries || []).forEach(function (entry) {
      var purpose = entry.purpose || payload.cardType || 'league_night';
      if (purpose !== 'league_night') return;
      var scores = entry.scores || {};
      Object.keys(scores).forEach(function (hole) {
        var score = scores[hole];
        if (score === null || score === '' || score === undefined) return;
        var h = Number(hole);
        rows.push([
          stamp, cardId, date, payload.week || '',
          entry.name || '', entry.team || '', entry.hcp || '',
          h, Number(score), WGL_PARS_[h] || '', purpose, seg.side || entry.side || ''
        ]);
      });
    });
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function wglIsoDate_(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  var d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, 'America/New_York', 'yyyy-MM-dd');
}

/**
 * doGet hook:
 *   if (e && e.parameter && e.parameter.action === 'live') {
 *     return ContentService.createTextOutput(JSON.stringify(wglLiveBoard_()))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   }
 */
function wglLiveBoard_() {
  var today = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
  var sh = wglLiveSheet_();
  var values = sh.getDataRange().getValues();
  var header = values.shift() || [];
  var col = {};
  header.forEach(function (name, i) { col[String(name)] = i; });
  var latest = {};
  values.forEach(function (row) {
    var date = wglCellDate_(row[col.date]);
    if (date !== today) return;
    var name = String(row[col.name] || '');
    if (!name) return;
    var stamp = row[col.timestamp] instanceof Date ? row[col.timestamp].getTime() : 0;
    var prev = latest[name];
    if (!prev || stamp >= prev.stamp) {
      if (!prev || row[col.cardId] !== prev.cardId) {
        latest[name] = { stamp: stamp, cardId: row[col.cardId], holes: {}, team: row[col.team], hcp: Number(row[col.hcp]) || 0, week: row[col.week] };
      }
    }
    if (latest[name].cardId === row[col.cardId]) {
      latest[name].holes[Number(row[col.hole])] = Number(row[col.score]);
      latest[name].team = row[col.team];
      latest[name].hcp = Number(row[col.hcp]) || 0;
      latest[name].week = row[col.week];
      latest[name].stamp = Math.max(latest[name].stamp, stamp);
    }
  });

  var holes = {};
  var board = [];
  var events = [];
  var birdies = 0;
  var eagles = 0;
  var teamSum = {};
  var week = '';
  Object.keys(latest).forEach(function (name) {
    var card = latest[name];
    week = week || card.week;
    var gross = 0;
    var parSum = 0;
    var thru = 0;
    var thruHole = 0;
    Object.keys(card.holes).forEach(function (holeKey) {
      var hole = Number(holeKey);
      var score = card.holes[hole];
      var par = WGL_PARS_[hole] || 0;
      gross += score;
      parSum += par;
      thru++;
      if (hole > thruHole) thruHole = hole;
      if (!holes[hole]) holes[hole] = { best: null, count: 0, groups: {}, players: 0 };
      holes[hole].players++;
      holes[hole].groups[card.cardId] = true;
      if (holes[hole].best === null || score < holes[hole].best) {
        holes[hole].best = score;
        holes[hole].count = 1;
      } else if (score === holes[hole].best) holes[hole].count++;
      var kind = '';
      if (par && score <= par - 2) kind = 'eagle';
      else if (par && score === par - 1) kind = 'birdie';
      if (kind) {
        if (kind === 'eagle') eagles++; else birdies++;
        events.push({
          name: name, team: Number(card.team) || card.team, hole: hole, score: score, par: par, kind: kind,
          at: Utilities.formatDate(new Date(card.stamp || Date.now()), 'America/New_York', 'h:mm')
        });
      }
    });
    var received = Math.round((Number(card.hcp) || 0) * thru / 9);
    var toPar = gross - parSum - received;
    board.push({ name: name, team: Number(card.team) || card.team, thru: thru, thruHole: thruHole, toPar: toPar });
    var t = String(card.team);
    if (!teamSum[t]) teamSum[t] = 0;
    teamSum[t] += toPar;
  });

  Object.keys(holes).forEach(function (hole) {
    holes[hole].groups = Object.keys(holes[hole].groups).length;
  });
  board.sort(function (a, b) { return a.toPar - b.toPar || b.thru - a.thru; });
  events.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  var bestTeam = '';
  var bestSum = null;
  Object.keys(teamSum).forEach(function (team) {
    if (bestSum === null || teamSum[team] < bestSum) { bestSum = teamSum[team]; bestTeam = Number(team) || team; }
  });
  return {
    ok: true,
    live: true,
    week: week,
    updated: new Date().toISOString(),
    playersPosting: board.length,
    birdies: birdies,
    eagles: eagles,
    bestTeam: bestTeam,
    holes: holes,
    board: board.slice(0, 20),
    events: events.slice(0, 12)
  };
}

function wglCellDate_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'America/New_York', 'yyyy-MM-dd');
  return wglIsoDate_(value);
}
