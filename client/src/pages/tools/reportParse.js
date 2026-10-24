// ============================================
// Report Samjhao — turn OCR text lines into test values
// ============================================
// Pure function, no browser APIs, so it can be unit-tested in Node.
// Input: [{ text, confidence }] lines from the on-phone reader (Tesseract).
// Output: { [paramId]: { value, range, unsure } } with value/range already in
// the canonical unit used by reports.js. Anything doubtful is marked `unsure`
// (shown in amber) — the user always confirms the numbers before results.

import { PARAMS } from './reports.js';

const MIN_CONFIDENCE = 75;

// Test-name patterns, checked in this order (HbA1c before Hb!). `skip`
// excludes look-alike rows (MCH contains "haemoglobin", MPV contains "platelet").
const MATCHERS = [
  { id: 'hba1c', re: /\b(hb\s*a\s*1\s*c|a1c|glyc(?:at|osyl)ated\s+ha?emoglobin)\b/g },
  { id: 'hb', re: /\b(ha?emoglobin|hgb|hb)\b/g, skip: /mean\s+corpuscular|\bmchc?\b|a1c|glyc/ },
  { id: 'wbc', re: /\b(total\s+)?(wbc|w\.\s*b\.\s*c\.?|tlc|t\.l\.c\.?|total\s+leu[ck]ocytes?(\s+count)?|leu[ck]ocyte\s+count|white\s+blood\s+cells?(\s+count)?)\b/g },
  { id: 'plt', re: /\b(platelets?(\s+count)?|plt)\b/g, skip: /mean\s+platelet|\bmpv\b|\bpdw\b|plateletcrit|\bpct\b|p-?lcr/ },
  { id: 'ft4', re: /\b(free\s*t\s*4|ft\s*4|free\s+thyroxine)\b/g },
  { id: 'tsh', re: /\b(tsh|thyroid\s+stimulating\s+hormone)\b/g },
  { id: 'fbs', re: /\b(fasting\s+(blood\s+|plasma\s+)?(glucose|sugar)|(glucose|sugar)\s*[-,(]?\s*fasting|fbs|fpg)\b/g },
  { id: 'ppbs', re: /\b(post\s*-?\s*prandial\s+(blood\s+|plasma\s+)?(glucose|sugar)|(glucose|sugar)\s*[-,(]?\s*(post\s*-?\s*prandial|pp)|ppbs|pp\s+(blood\s+)?sugar|pbs)\b/g },
  { id: 'b12', re: /\b(vitamin\s*-?\s*b\s*-?\s*12|vit\.?\s*b\s*-?\s*12|b\s*-?\s*12|cobalamin)\b/g },
  { id: 'vitd', re: /\b(25\s*-?\s*(oh|hydroxy)\s*(vitamin|vit\.?)?\s*d\s*(2\s*\+\s*3|3|total)?|vitamin\s*-?\s*d\s*(2\s*\+\s*3|3|total)?|vit\.?\s*d\s*3?)\b/g },
];

// Units whose digits must not be read as values, plus flags we need.
const UNIT_PATTERNS = [
  { re: /\b10\s*[\^x*]?\s*3\s*\/?\s*(?:[uµ]l|cumm|cu\.?\s*mm|mm3)\b|\bx?\s*10³\s*\/?\s*(?:[uµ]l)?|\b10e3\s*\/?\s*[uµ]?l?\b|\bthou(?:sand)?s?\s*\/?\s*(?:[uµ]l|cumm)?\b|\b[kK]\s*\/\s*[uµ]l\b/g, flag: 'thousand' },
  { re: /\blakhs?\b|\blacs?\b|\blakh\s*\/\s*(?:[uµ]l|cumm)\b|\b10\s*[\^x*]?\s*5\b/g, flag: 'lakh' },
  { re: /\b10\s*[\^x*]?\s*6\s*\/?\s*(?:[uµ]l|cumm)?\b/g, flag: 'million' },
  { re: /\bnmol\s*\/\s*l\b/g, flag: 'nmol' },
  { re: /\bpmol\s*\/\s*l\b/g, flag: 'pmol' },
  { re: /\bmmol\s*\/\s*l\b/g, flag: 'mmol' },
  { re: /\bg\s*\/\s*l\b/g, flag: 'gl' },
  { re: /\b(?:mg|g|ng|pg)\s*\/\s*(?:dl|ml)\b|\b[mµu]?iu\s*\/\s*(?:ml|l)\b|\bcells?\s*\/\s*(?:cumm|cu\.?\s*mm|[uµ]l)\b|\/\s*(?:cumm|cu\.?\s*mm|[uµ]l|mm3)\b|%/g, flag: null },
];

// Common OCR slips inside numbers: O→0, l/I/|→1, comma decimals.
function cleanLine(raw) {
  return String(raw || '')
    .replace(/[–—−]/g, '-')
    .replace(/(\d)[oO](?=\d|\b)/g, '$10')
    .replace(/(?<=\d)[lI|](?=\d)/g, '1')
    .replace(/(?<=\s|^)[oO](?=[.,]\d)/g, '0')
    .toLowerCase();
}

function toNumber(tok) {
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(tok)) return Number(tok.replace(/,/g, ''));
  if (/^\d+,\d{1,2}$/.test(tok)) return Number(tok.replace(',', '.'));
  return Number(tok.replace(/,/g, ''));
}

// Find the result value and an optional "low - high" reference range.
function extractNumbers(rest) {
  const nums = [];
  const re = /\d+(?:[.,]\d+)*/g;
  let m;
  while ((m = re.exec(rest))) nums.push({ v: toNumber(m[0]), start: m.index, end: m.index + m[0].length });
  if (!nums.length) return null;
  // Range = two numbers joined by "-" or "to".
  let range = null;
  const inRange = new Set();
  for (let i = 0; i < nums.length - 1; i++) {
    const between = rest.slice(nums[i].end, nums[i + 1].start);
    if (/^\s*(-|to)\s*$/.test(between) && nums[i].v < nums[i + 1].v) {
      range = [nums[i].v, nums[i + 1].v];
      inRange.add(i); inRange.add(i + 1);
      break;
    }
  }
  const first = nums.findIndex((_, i) => !inRange.has(i));
  if (first < 0) return null;
  // Skip a number that's part of "< 5.7" style reference text before the value.
  const value = nums[first].v;
  return Number.isFinite(value) ? { value, range } : null;
}

// Convert a raw reading to the canonical unit for a parameter. Unit GUESSES
// (from the size of the number) are only made when the line shows no unit.
function toCanonical(id, v, flags) {
  const guess = !flags.unit;
  switch (id) {
    case 'hb': return flags.gl || (guess && v > 30) ? v / 10 : v;
    case 'wbc': return flags.thousand || v < 200 ? v * 1000 : v;
    case 'plt':
      if (flags.lakh) return v;
      if (flags.thousand) return v / 100;
      if (v >= 1000) return v / 100000;
      if (v > 15) return v / 100;
      return v;
    case 'ft4': return flags.pmol || (guess && v > 8) ? v / 12.87 : v;
    case 'fbs': case 'ppbs': return flags.mmol || (guess && v < 35) ? v * 18 : v;
    case 'vitd': return flags.nmol ? v / 2.5 : v;
    case 'b12': return flags.pmol ? v * 1.355 : v;
    default: return v;
  }
}

// Unit guesses we made without seeing the unit — always mark these unsure.
function guessedUnit(id, v, flags) {
  if (flags.unit) return false;
  if (id === 'hb') return v > 30;
  if (id === 'ft4') return v > 8;
  if (id === 'fbs' || id === 'ppbs') return v < 35;
  return false;
}

// The reader sometimes drops a tiny decimal point ("2.1" → "21",
// "0.8 - 1.8" → "08-18") while still reporting high confidence. Using the
// typical range as a guide, undo a ×10 / ×100 slip and mark it unsure.
const near = (x, t) => x >= t / 2.5 && x <= t * 2.5;
function fixDroppedDecimals(id, value, range) {
  const p = PARAMS[id];
  let fixed = false;
  if (range) {
    const [t0, t1] = p.range('f');
    if (!(near(range[0], t0) && near(range[1], t1))) {
      for (const k of [10, 100]) {
        if (near(range[0] / k, t0) && near(range[1] / k, t1)) { range = range.map((x) => x / k); fixed = true; break; }
      }
    }
  }
  // Only touch the VALUE when it's physically implausible — a real but very
  // abnormal result (e.g. TSH 60) must never be "corrected".
  const ok = (v) => v >= p.plausible[0] && v <= p.plausible[1];
  if (!ok(value)) {
    for (const k of [10, 100]) {
      if (ok(value / k)) { value /= k; fixed = true; break; }
    }
  }
  return { value, range, fixed };
}

export function parseReportLines(lines) {
  const out = {};
  for (const line of lines || []) {
    const text = cleanLine(line.text);
    if (!text.trim()) continue;
    for (const mt of MATCHERS) {
      if (out[mt.id]) continue;
      if (mt.skip && mt.skip.test(text)) continue;
      mt.re.lastIndex = 0;
      const hit = mt.re.exec(text);
      if (!hit) continue;
      // Everything after the test name; drop units (and their digits) first.
      // Also remove repeats of the name ("Free T4 (FT4)") and digit-bearing
      // name parts ("(25-OH)", "D3", "A1c") so they aren't read as values.
      mt.re.lastIndex = 0;
      let rest = text.slice(hit.index + hit[0].length)
        .replace(mt.re, ' ')
        .replace(/\b25\s*-?\s*(?:oh|hydroxy)\b|\bd\s*[23]\b|\ba\s*1\s*c\b|\bt\s*[34]\b|\bb\s*-?\s*12\b/g, ' ');
      const flags = {};
      for (const u of UNIT_PATTERNS) {
        u.re.lastIndex = 0;
        if (u.re.test(rest)) { flags.unit = true; if (u.flag) flags[u.flag] = true; }
        u.re.lastIndex = 0;
        rest = rest.replace(u.re, ' ');
      }
      const found = extractNumbers(rest);
      if (!found) break; // matched the name but no number: leave for the user
      const raw = toCanonical(mt.id, found.value, flags);
      const rawRange = found.range ? found.range.map((x) => toCanonical(mt.id, x, flags)) : null;
      const p = PARAMS[mt.id];
      // Printed ranges are only used for range-type tests (not sugar/vit D bands).
      const usable = p.kind === 'range' && rawRange && rawRange[0] < rawRange[1] ? rawRange : null;
      const { value, range, fixed } = fixDroppedDecimals(mt.id, raw, usable);
      const implausible = value < p.plausible[0] || value > p.plausible[1];
      const farFromOwnRange = range ? value > range[1] * 5 || value < range[0] / 5 : false;
      out[mt.id] = {
        value: Math.round(value * 1000) / 1000,
        range: range ? range.map((x) => Math.round(x * 1000) / 1000) : null,
        unsure: (line.confidence != null && line.confidence < MIN_CONFIDENCE)
          || implausible || fixed || farFromOwnRange || guessedUnit(mt.id, found.value, flags),
      };
      break; // one test per line
    }
  }
  return out;
}

// Pull { text, confidence } lines out of Tesseract's "blocks" output, falling
// back to plain text (no confidence) if blocks are missing.
export function linesFromTesseract(data) {
  const lines = [];
  for (const b of data?.blocks || []) {
    for (const p of b.paragraphs || []) {
      for (const l of p.lines || []) lines.push({ text: l.text, confidence: l.confidence });
    }
  }
  if (lines.length) return lines;
  return String(data?.text || '').split('\n').map((text) => ({ text, confidence: null }));
}
