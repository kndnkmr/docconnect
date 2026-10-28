// Top + bottom nav bars must stay readable over ANY page colour.
// Bug this guards: see-through "glass" bars over blue/green sections tinted
// the bar and faded the grey labels (Home / Doctors / Blog / Login) to
// ~3.8:1 — below the 4.5:1 WCAG minimum for small text.
// Reads the real class names from the components, so a future design tweak
// (e.g. bg-white/80, backdrop-blur, text-gray-400) fails the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import config from '../tailwind.config.js';

const require = createRequire(import.meta.url);
const twColors = require('tailwindcss/colors');
const palette = { ...twColors, white: '#ffffff', black: '#000000', primary: config.theme.extend.colors.primary };

const hex = (c) => {
  const v = c.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};
const lum = ([r, g, b]) => {
  const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const blend = (top, alpha, under) => top.map((c, i) => Math.round(alpha * c + (1 - alpha) * under[i]));
const color = (name) => {
  if (name === 'white' || name === 'black') return hex(palette[name]);
  const [fam, shade] = name.split('-');
  assert.ok(palette[fam] && palette[fam][shade], `unknown colour ${name}`);
  return hex(palette[fam][shade]);
};

// Worst-case page colours that can sit behind a bar: every saturated brand /
// section colour used on the site, plus pure black (phone dark modes).
const BEHIND = ['primary-500', 'primary-600', 'primary-700', 'primary-800', 'primary-900', 'green-600', 'green-700',
  'teal-600', 'emerald-600', 'cyan-700', 'indigo-600', 'red-600', 'orange-600', 'black', 'white'];

const BARS = [
  { file: 'src/components/BottomNav.jsx', name: 'bottom bar' },
  { file: 'src/components/Navbar.jsx', name: 'top bar' },
];

for (const bar of BARS) {
  const src = fs.readFileSync(new URL(`../${bar.file}`, import.meta.url), 'utf8');
  const navClass = src.match(/<nav[\s\S]*?className="([^"]+)"/)[1];

  test(`${bar.name}: solid background, no see-through glass`, () => {
    assert.doesNotMatch(navClass, /backdrop-blur/, 'no backdrop-blur on the bar');
    const bg = navClass.match(/(?:^|\s)bg-([a-z]+(?:-\d{2,3})?)(?:\/(\d+))?(?=\s|$)/);
    assert.ok(bg, 'bar needs a bg- class');
    assert.equal(bg[2], undefined, `bar background must be fully opaque (found bg-${bg[1]}/${bg[2]})`);
  });

  test(`${bar.name}: every label colour ≥ 4.5:1 over any page colour`, () => {
    const bg = navClass.match(/(?:^|\s)bg-([a-z]+(?:-\d{2,3})?)(?:\/(\d+))?(?=\s|$)/);
    const alpha = bg[2] ? Number(bg[2]) / 100 : 1;
    const barColor = color(bg[1]);
    // Resting + active label colours (hover:/group-hover: states are transient).
    const textColors = [...new Set([...src.matchAll(/(?<![\w:-])text-([a-z]+-\d{3})(?![\w/])/g)].map((m) => m[1]))];
    assert.ok(textColors.length > 0);
    for (const t of textColors) {
      for (const behind of BEHIND) {
        const effective = blend(barColor, alpha, color(behind));
        const ratio = contrast(color(t), effective);
        assert.ok(ratio >= 4.5, `text-${t} on ${bar.name} over ${behind} = ${ratio.toFixed(2)}:1 (need 4.5)`);
      }
    }
  });
}

test('old glass bar would have failed (the check really catches it)', () => {
  const effective = blend(color('white'), 0.85, color('primary-600'));
  assert.ok(contrast(color('gray-500'), effective) < 4.5);
});

test('site asks phones not to auto-darken it', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(html, /<meta name="color-scheme" content="only light"/);
  assert.match(css, /color-scheme:\s*only light/);
});
