// Static sample used only with ?preview=live, so the sheet can be reviewed
// on a day that is not league night and before the Apps Script action is deployed.
// Names are real roster members. Scores are not posted results.
export function previewLive() {
  return {
    ok: true,
    live: true,
    sample: true,
    week: 14,
    updated: new Date().toISOString(),
    playersPosting: 18,
    playersExpected: 44,
    birdies: 6,
    eagles: 1,
    bestTeam: 7,
    holes: {
      10: { best: 4, count: 1, groups: 3 },
      11: { best: 3, count: 2, groups: 4 },
      12: { best: 3, count: 1, groups: 4 },
      13: { best: 3, count: 2, groups: 5 },
      14: { best: 4, count: 3, groups: 2 },
      15: { best: 2, count: 1, groups: 1 },
      16: { best: 3, count: 1, groups: 1 },
      17: { best: 2, count: 2, groups: 1 },
      18: { best: 4, count: 1, groups: 1 }
    },
    board: [
      { name: 'Ed Bargerstock', team: 7, thru: 7, thruHole: 16, toPar: -4 },
      { name: 'Brian Barton', team: 8, thru: 9, thruHole: 18, toPar: -3 },
      { name: 'Duck Julius', team: 3, thru: 4, thruHole: 13, toPar: -2 },
      { name: 'Wes Barton', team: 7, thru: 6, thruHole: 15, toPar: -1 },
      { name: 'Jim Frye', team: 2, thru: 8, thruHole: 17, toPar: 0 }
    ],
    events: [
      { name: 'Duck Julius', team: 3, hole: 13, score: 3, par: 4, kind: 'birdie', at: '6:41' },
      { name: 'Jim Frye', team: 2, hole: 12, score: 3, par: 4, kind: 'birdie', at: '6:38' },
      { name: 'Ed Bargerstock', team: 7, hole: 10, score: 3, par: 5, kind: 'eagle', at: '6:31' },
      { name: 'Brian Barton', team: 8, hole: 11, score: 3, par: 4, kind: 'birdie', at: '6:22' }
    ]
  };
}
