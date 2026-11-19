# Live scores for v2

The live site and v2 both post scorecards to the same Apps Script:

`https://script.google.com/macros/s/AKfycbx4vADa-QnAHP7QeHz6mN7lxA1Q24Ny7Z0GiDzFFg7nMqY35Uh54kS2C61JUYU87pj23g/exec`

That project is not in this repo, so this folder is the change to paste in. It adds a new sheet and a new read. It does not change how existing posts are stored, and the current app never calls `action=live`.

## What v2 asks for

On a league night (a date in `calendar` inside `wgl-data.json`, America/New_York), the scorecard polls:

`GET <script url>?action=live`

A useful response looks like:

```json
{
  "ok": true,
  "live": true,
  "week": 14,
  "updated": "2026-08-10T22:42:00.000Z",
  "playersPosting": 18,
  "playersExpected": 44,
  "birdies": 6,
  "eagles": 1,
  "bestTeam": 7,
  "holes": { "13": { "best": 3, "count": 2, "groups": 5 } },
  "board": [{ "name": "Ed Bargerstock", "team": 7, "thru": 7, "thruHole": 16, "toPar": -4 }],
  "events": [{ "name": "Duck Julius", "team": 3, "hole": 13, "score": 3, "par": 4, "kind": "birdie", "at": "6:41" }]
}
```

`best` is the lowest gross score posted on that hole tonight. `toPar` is gross minus par for the holes posted, minus a share of the player's handicap (`round(hcp × holes posted / 9)`). Birdies and eagles are gross versus par.

If the response is missing, not JSON, or `live` is not `true`, v2 hides the strip. Practice and bank cards are not mirrored.

The same shape can also be published later as a `live` object on `wgl-data.json`. The current site ignores unknown fields. v2 prefers the script, then that object.

## Paste into the existing project

1. Open the Apps Script project behind the URL above. Add `Live.gs` from this folder.
2. In `doGet`, before the current return, add:

```javascript
if (e && e.parameter && e.parameter.action === 'live') {
  return ContentService
    .createTextOutput(JSON.stringify(wglLiveBoard_()))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. In `doPost`, after a score card has been accepted and you already have the parsed `payload`, add:

```javascript
try { wglMirrorLive_(payload); } catch (err) {}
```

The `try` keeps a live-sheet problem from failing the card the current app just submitted. Deploy a new version of the same web app (execute as you, anyone can access) so the `/exec` URL does not change.

The first mirror creates a sheet named `WGL_Live`. One row per scored hole: timestamp, card id, date, week, name, team, handicap, hole, score, par, purpose, side. Re-posting a player keeps their newest card.

## How to test on league night

League night means the phone's Eastern date matches a `date` in `wgl-data.json` → `calendar`. Any other day the strip stays off, including after the season.

1. Deploy the two hooks above.
2. On that Monday, open `/v2/`, start a card, enter a hole, and submit at least one league-night card (not bank or practice).
3. Open the scorecard again. Within about 45 seconds the clay strip should read `Best on #N tonight`. Tap it. That tap is the only way to the leaderboard sheet.
4. A second phone, or a second card, should move the best score, the group count, and the board without a reload.
5. On Tuesday the strip is gone even if Monday's rows are still on `WGL_Live`.

Before the script is deployed, any day, open `/v2/?preview=live#/score` to see a labeled sample strip and sheet. The sample is not posted scores. Home never gets a live card.

## Week data v2 trusts

Season standings and week results for weeks 1–17 come from `v2/data/verified-weeks.json`, copied from the paper-verified weeks baked into the live page. The live page ignores `wgl-data.json` for those week numbers because the published file does not match the cards. v2 does the same: the JSON file may only add a week number the bundle does not already have (18, 19, and anything newer). Players, the calendar, payouts, and settings still come from `wgl-data.json`.
