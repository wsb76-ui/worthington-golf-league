// Public endpoints the live app already calls. No secrets.
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4vADa-QnAHP7QeHz6mN7lxA1Q24Ny7Z0GiDzFFg7nMqY35Uh54kS2C61JUYU87pj23g/exec';
export const DATA_URL = 'https://raw.githubusercontent.com/wsb76-ui/worthington-golf-league/main/wgl-data.json';
export const FALLBACK_DATA_URL = new URL('../../wgl-data.json', import.meta.url).href;
export const VERIFIED_WEEKS_URL = new URL('../data/verified-weeks.json', import.meta.url).href;

export const SCORE_EMAIL = 'wglscore@gmail.com';
export const TZ = 'America/New_York';
export const COURSE = 'Hiland Golf Course';
export const LEAGUE_NAME = 'Worthington Golf League';
// League copy: first group off the tee. settings.firstTee or settings.teeTime overrides it.
export const FIRST_TEE = '4:30 PM';

// Same regular-season rules as the live app.
export const PLAYOFF_FIRST = 18;
export const PREV_THROUGH = 9;
export const PENALTY_PER_CARD = 50;
export const TEAM_COUNT = 8;
// Official paper cumulative through week 9. Weeks 1–9 that are present in the
// verified bundle are subtracted back out so they are not counted twice.
export const PREV_TOTALS = { 1: 1327, 2: 1309, 3: 1334, 4: 1302, 5: 1325, 6: 1416, 7: 1277, 8: 1311 };
