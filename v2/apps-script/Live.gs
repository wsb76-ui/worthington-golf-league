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
 *
 * Pars are the Hiland white-tee card already used by the live app
 * (SC_FRONT_PARS / SC_BACK_PARS and HOLE_INFO in index.html) and copied in
 * v2/js/course.js. wgl-data.json does not publish hole pars, so this table
 * is that same card, not a second course.
 *   Front 4,4,3,4,4,4,5,4,3
 *   Back  5,4,4,4,4,3,4,3,4
 */
var WGL_PARS_ = {
  1:4,2:4,3:3,4:4,5:4,6:4,7:5,8:4,9:3,
  10:5,11:4,12:4,13:4,14:4,15:3,16:4,17:3,18:4
};

var WGL_DATA_URL_ = 'https://raw.githubusercontent.com/wsb76-ui/worthington-golf-league/main/wgl-data.json';
var WGL_LIVE_KEEP_MS_ = 2 * 24 * 60 * 60 * 1000;
var WGL_LIVE_READ_ROWS_ = 3000;
var WGL_LOCK_MS_ = 10000;

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
 * A lock miss or a sheet error returns quietly so the card the live app
 * already accepted is not failed by the mirror.
 */
function wglMirrorLive_(payload) {
  if (!payload || !payload.segments) return;
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
  if (!rows.length) return;

  var lock = LockService.getScriptLock();
  var held = false;
  try {
    lock.waitLock(WGL_LOCK_MS_);
    held = true;
    var sh = wglLiveSheet_();
    wglTrimLive_(sh);
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
  } catch (err) {
    // Timeout or sheet trouble. The caller's try/catch is the second net.
  } finally {
    if (held) {
      try { lock.releaseLock(); } catch (ignore) {}
    }
  }
}

// Drop rows older than two days. Callers must already hold the script lock.
// Appends keep old rows at the top, so one delete covers the stale prefix.
function wglTrimLive_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var cutoff = Date.now() - WGL_LIVE_KEEP_MS_;
  var stamps = sh.getRange(2, 1, last - 1, 1).getValues();
  var deleteThrough = 1;
  for (var i = 0; i < stamps.length; i++) {
    var cell = stamps[i][0];
    var ms = cell instanceof Date ? cell.getTime() : 0;
    if (ms && ms >= cutoff) break;
    deleteThrough = i + 2;
  }
  var count = deleteThrough - 1;
  if (count > 0) sh.deleteRows(2, count);
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
  var width = Math.max(sh.getLastColumn(), 12);
  var header = sh.getRange(1, 1, 1, width).getValues()[0];
  var col = {};
  header.forEach(function (name, i) { col[String(name)] = i; });
  var last = sh.getLastRow();
  var values = [];
  if (last >= 2) {
    var start = Math.max(2, last - WGL_LIVE_READ_ROWS_ + 1);
    values = sh.getRange(start, 1, last - start + 1, width).getValues();
  }
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
    var when = card.stamp || Date.now();
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
          name: name,
          team: Number(card.team) || card.team,
          hole: hole,
          score: score,
          par: par,
          kind: kind,
          ms: when,
          at: Utilities.formatDate(new Date(when), 'America/New_York', 'h:mm a')
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
  events.sort(function (a, b) { return b.ms - a.ms; });
  events.forEach(function (ev) { delete ev.ms; });
  var bestTeam = '';
  var bestSum = null;
  Object.keys(teamSum).forEach(function (team) {
    if (bestSum === null || teamSum[team] < bestSum) { bestSum = teamSum[team]; bestTeam = Number(team) || team; }
  });
  var out = {
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
  var expected = wglPlayersExpected_();
  if (expected) out.playersExpected = expected;
  return out;
}

// Roster size from the published JSON. Cached so a poll does not fetch
// GitHub every time. Missing or failed reads omit the field; v2 then shows
// the posting count alone.
function wglPlayersExpected_() {
  try {
    var cache = CacheService.getScriptCache();
    var hit = cache.get('wgl_roster_n');
    if (hit) return Number(hit) || null;
    var res = UrlFetchApp.fetch(WGL_DATA_URL_, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    var data = JSON.parse(res.getContentText());
    var n = data && data.players ? Object.keys(data.players).length : 0;
    if (!n) return null;
    cache.put('wgl_roster_n', String(n), 21600);
    return n;
  } catch (err) {
    return null;
  }
}

function wglCellDate_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'America/New_York', 'yyyy-MM-dd');
  return wglIsoDate_(value);
}
