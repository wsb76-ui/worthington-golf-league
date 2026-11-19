// Hiland Golf Course, white tees. Yardages match the live app's on-course card.
// Stroke indexes are the published white-tee handicap column (1 = hardest).
export const HOLES = {
  1:  { par: 4, yds: 272, si: 17 },
  2:  { par: 4, yds: 295, si: 16 },
  3:  { par: 3, yds: 180, si: 12 },
  4:  { par: 4, yds: 425, si: 5 },
  5:  { par: 4, yds: 415, si: 2 },
  6:  { par: 4, yds: 375, si: 10 },
  7:  { par: 5, yds: 531, si: 7 },
  8:  { par: 4, yds: 275, si: 18 },
  9:  { par: 3, yds: 225, si: 4 },
  10: { par: 5, yds: 501, si: 14 },
  11: { par: 4, yds: 370, si: 6 },
  12: { par: 4, yds: 364, si: 8 },
  13: { par: 4, yds: 344, si: 11 },
  14: { par: 4, yds: 416, si: 3 },
  15: { par: 3, yds: 230, si: 9 },
  16: { par: 4, yds: 285, si: 15 },
  17: { par: 3, yds: 142, si: 13 },
  18: { par: 4, yds: 446, si: 1 }
};

export const FRONT = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const BACK = [10, 11, 12, 13, 14, 15, 16, 17, 18];
export const ALL = [...FRONT, ...BACK];

// Paper cards: odd weeks are the back nine, even weeks the front.
export function sideForWeek(week) {
  return (+week % 2 === 1) ? 'back' : 'front';
}

export function holesFor(side) {
  if (side === 'back') return BACK;
  if (side === '18') return ALL;
  return FRONT;
}

export function parsFor(side) {
  return holesFor(side).map(n => HOLES[n].par);
}

export function sideLabel(side) {
  if (side === 'back') return 'Back 9';
  if (side === '18') return '18 holes';
  return 'Front 9';
}

export function sideRange(side) {
  if (side === 'back') return 'Holes 10–18';
  if (side === '18') return 'Holes 1–18';
  return 'Holes 1–9';
}

export function nineTitle(side) {
  if (side === 'back') return 'Back nine';
  if (side === '18') return '18 holes';
  return 'Front nine';
}

// One-tap range from the live scorecard: eagle (par−2, floored at 1) through double par.
export function scoreRange(par) {
  const lo = Math.max(1, par - 2);
  const hi = par * 2;
  const out = [];
  for (let s = lo; s <= hi; s++) out.push(s);
  return out;
}
