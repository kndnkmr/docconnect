// ============================================
// Sehat Kundli share picture (drawn on the phone, never uploaded)
// ============================================
// A 1080x1350 portrait card (good for WhatsApp chats and Status): title,
// the conditions in the family (no relative names), the top check-ups with
// their start ages, and the free tool link. Canvas 2D only, no libraries.
import { CONDITIONS, COPY, topForCard } from './kundliRules.js';

const W = 1080;
const H = 1350;
const FONT = '"Noto Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else { line = test; }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Returns a PNG Blob.
export function drawKundliCard(k, lang, link) {
  const t = COPY[lang] || COPY.en;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background: warm saffron to deep maroon.
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#f97316');
  g.addColorStop(0.55, '#e11d48');
  g.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(940, 120, 260, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(80, 1260, 200, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Kundli diamond (decorative)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 4;
  const cx = 890; const cy = 190; const s = 110;
  ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
  ctx.beginPath();
  ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy); ctx.closePath();
  ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s);
  ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s);
  ctx.stroke();

  // Title
  ctx.fillStyle = '#ffedd5';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText('ProMedicoz', 80, 110);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 88px ${FONT}`;
  ctx.fillText(t.picTitle, 80, 220);
  ctx.font = `36px ${FONT}`;
  ctx.fillStyle = '#ffe4e6';
  ctx.fillText(lang === 'hi' ? `Umar ${k.age} · ${k.sex === 'f' ? t.woman : t.man}` : `Age ${k.age} · ${k.sex === 'f' ? t.woman : t.man}`, 80, 280);

  // Family conditions
  let y = 350;
  roundRect(ctx, 60, y, W - 120, 190, 32);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fill();
  ctx.fillStyle = '#fff7ed';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(t.picFamily, 100, y + 60);
  ctx.font = `40px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  const fam = k.familyConditions.map((key) => CONDITIONS.find((c) => c.key === key)).filter(Boolean)
    .map((c) => `${c.emoji} ${c.label[lang] || c.label.en}`);
  const famText = fam.length ? fam.join('  ·  ') : (lang === 'hi' ? 'Koi bimari nahi chuni' : 'Nothing ticked');
  wrap(ctx, famText, W - 200).slice(0, 2).forEach((line, i) => ctx.fillText(line, 100, y + 120 + i * 52));

  // Check-up plan
  y = 580;
  roundRect(ctx, 60, y, W - 120, 560, 32);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#9f1239';
  ctx.font = `bold 38px ${FONT}`;
  ctx.fillText(t.picTests, 100, y + 70);
  let ly = y + 130;
  for (const it of topForCard(k, 5)) {
    if (ly > y + 520) break;
    const when = it.startAge != null ? (it.startAge <= k.age ? t.dueTitle : t.fromAge(it.startAge)) : t.momentsTitle;
    ctx.fillStyle = it.family ? '#e11d48' : '#64748b';
    ctx.beginPath(); ctx.arc(112, ly - 12, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 32px ${FONT}`;
    const lines = wrap(ctx, it.title[lang] || it.title.en, W - 300).slice(0, 2);
    lines.forEach((line, i) => ctx.fillText(line, 140, ly + i * 40));
    ctx.fillStyle = it.family ? '#be123c' : '#475569';
    ctx.font = `28px ${FONT}`;
    ctx.fillText(when, 140, ly + lines.length * 40 + 2);
    ly += lines.length * 40 + 64;
  }

  // Footer
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 38px ${FONT}`;
  ctx.fillText(`${t.picMake}:`, 80, 1210);
  ctx.fillStyle = '#ffedd5';
  ctx.font = `bold 36px ${FONT}`;
  ctx.fillText(link.replace(/^https?:\/\/(www\.)?/, ''), 80, 1260);
  ctx.fillStyle = '#ffe4e6';
  ctx.font = `28px ${FONT}`;
  ctx.fillText(t.picNote, 80, 1305);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
