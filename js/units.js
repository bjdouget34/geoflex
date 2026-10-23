// Parsing and formatting of angles and lengths.
// Internal units: angles in radians, lengths in inches (decimal mode is unitless,
// so the same number is shown as-is).

const DEG = Math.PI / 180;

export const ANGLE_UNITS = [
  { id: 'deg', label: 'Degrees' },
  { id: 'dms', label: 'Degrees Minutes Seconds' },
  { id: 'rad', label: 'Radian' },
  { id: 'grade', label: 'Percent Grade' },
  { id: 'over12', label: 'Over 12' },
];

export const LENGTH_FORMATS = [
  { id: 'dec', label: 'Decimal' },
  { id: 'fif', label: 'Feet, Inches & Fractions' },
  { id: 'in', label: 'Inches & Fractions' },
];

export const FRACTIONS = [8, 16, 32, 64];
export const DECIMALS = [2, 3, 4, 6];

function normalize(str) {
  return String(str)
    .replace(/[′’‘`]/g, "'")
    .replace(/[″“”]|''/g, '"')
    .replace(/[º˚]/g, '°')
    .trim();
}

function trimZeros(s) {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

export function formatNumber(v, decimals) {
  if (!isFinite(v)) return '';
  const s = trimZeros(v.toFixed(decimals));
  return s === '-0' ? '0' : s;
}

// ---------- angles ----------

function parseDms(s) {
  const nums = s.match(/\d+(?:\.\d+)?|\.\d+/g);
  if (!nums || nums.length > 3) return NaN;
  const [d, m = 0, sec = 0] = nums.map(Number);
  if (m >= 60 || sec >= 60) return NaN;
  return (d + m / 60 + sec / 3600) * DEG;
}

export function parseAngle(str, unit) {
  // Accept the displayed forms back: "100%" and "6/12".
  let s = normalize(str);
  if (unit === 'grade') s = s.replace(/\s*%$/, '');
  if (unit === 'over12') s = s.replace(/\s*\/\s*12$/, '');
  if (!s) return NaN;
  // Anything written with DMS marks or several numbers is read as DMS.
  if (unit === 'dms' || /[°'"]/.test(s) || /\d\s+\d/.test(s)) return parseDms(s);
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return NaN;
  const v = Number(s);
  switch (unit) {
    case 'rad': return v;
    case 'grade': return Math.atan(v / 100);
    case 'over12': return Math.atan(v / 12);
    default: return v * DEG;
  }
}

export function formatAngle(rad, unit, decimals) {
  if (!isFinite(rad)) return '';
  const deg = rad / DEG;
  switch (unit) {
    case 'rad':
      return formatNumber(rad, decimals);
    case 'dms': {
      let total = Math.round(deg * 36000) / 10; // tenths of a second
      let d = Math.floor(total / 3600 + 1e-9);
      total -= d * 3600;
      let m = Math.floor(total / 60 + 1e-9);
      let s = Math.round((total - m * 60) * 10) / 10;
      if (s >= 60) { s -= 60; m += 1; }
      if (m >= 60) { m -= 60; d += 1; }
      return `${d}° ${m}' ${formatNumber(s, 1)}"`;
    }
    case 'grade':
    case 'over12':
      // Grade and pitch can't express 90 degrees or more; fall back to degrees.
      if (deg >= 90 - 1e-9) return `${formatNumber(deg, decimals)}°`;
      return unit === 'grade'
        ? `${formatNumber(Math.tan(rad) * 100, decimals)}%`
        : `${formatNumber(Math.tan(rad) * 12, decimals)}/12`;
    default:
      return `${formatNumber(deg, decimals)}°`;
  }
}

// ---------- lengths ----------

const TOKEN = /(\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*('|"|ft|in)?/g;

export function parseLength(str, format) {
  const s = normalize(str).toLowerCase();
  if (!s) return NaN;
  // Reject stray characters (letters other than ft/in, signs, etc.).
  if (/[^\d\s./'"\-ftin]/.test(s) || /[a-z]/.test(s.replace(/ft|in/g, ''))) return NaN;
  const tokens = [];
  for (const t of s.replace(/-/g, ' ').matchAll(TOKEN)) {
    const value = t[2] !== undefined ? Number(t[1]) / Number(t[2]) : Number(t[1]);
    if (!isFinite(value)) return NaN;
    const mark = t[3] === 'ft' ? "'" : t[3] === 'in' ? '"' : t[3];
    tokens.push({ value, fraction: t[2] !== undefined, mark });
  }
  if (!tokens.length) return NaN;

  if (format === 'fif') {
    const marked = tokens.some(t => t.mark);
    let inches = 0;
    let wholes = 0;
    for (const t of tokens) {
      if (t.mark === "'") inches += t.value * 12;
      else if (t.mark === '"' || t.fraction) inches += t.value;
      else if (marked) inches += t.value; // bare number next to marked ones = inches
      else inches += wholes++ === 0 ? t.value * 12 : t.value; // "5 3 1/2" = 5' 3 1/2"
    }
    return inches;
  }
  // dec and in: everything is inches (or unitless), feet marks still honored.
  return tokens.reduce((sum, t) => sum + (t.mark === "'" ? t.value * 12 : t.value), 0);
}

function inchFraction(inches, denom) {
  let ticks = Math.round(inches * denom);
  const whole = Math.floor(ticks / denom);
  let num = ticks - whole * denom;
  let den = denom;
  while (num && num % 2 === 0) { num /= 2; den /= 2; }
  return { whole, num, den };
}

export function formatLength(v, format, opts) {
  if (!isFinite(v)) return '';
  if (format === 'dec') return formatNumber(v, opts.decimals);
  const denom = opts.fraction;
  const ticks = Math.round(v * denom);
  if (format === 'fif') {
    const feet = Math.floor(ticks / (12 * denom));
    const { whole, num, den } = inchFraction((ticks - feet * 12 * denom) / denom, denom);
    const inch = num ? `${whole ? whole + ' ' : ''}${num}/${den}"` : `${whole}"`;
    return feet ? `${feet}' ${inch}` : inch;
  }
  const { whole, num, den } = inchFraction(ticks / denom, denom);
  return num ? `${whole ? whole + ' ' : ''}${num}/${den}"` : `${whole}"`;
}

export function formatArea(v, format, opts) {
  if (!isFinite(v)) return '';
  if (format === 'dec') return formatNumber(v, opts.decimals);
  if (format === 'fif') return `${formatNumber(v / 144, opts.decimals)} sq ft`;
  return `${formatNumber(v, opts.decimals)} sq in`;
}
