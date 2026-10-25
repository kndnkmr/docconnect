// ============================================
// Prescription writer — medicine "cards" ⇄ saved prescription fields
// ============================================
// Pure functions (unit-tested in Node). The doctor edits one card per medicine
// ({ name, freq, food, days, note }); we save into the SAME model fields as
// before (name, dosage, frequency, duration, instructions), so the PDF,
// WhatsApp share, patient card and daily chart keep working unchanged.
//
// instructions = "<Food>; <note>"  e.g. "Before food; before breakfast"
// duration     = "<n> days" | "Continue" | any text the doctor typed

export const FREQ_MAIN = ['1-0-0', '0-0-1', '1-0-1', '1-1-1', 'OD', 'HS', 'SOS'];
export const FREQ_MORE = ['BD', 'TDS', 'QID', '0-1-0', '1-1-0', '0-1-1', '½-0-½', '1-0-0-1', 'Once a week'];
export const FOODS = ['Before food', 'After food', 'Empty stomach'];
export const DAYS = ['3', '5', '7', '10', '15', '30', 'Continue'];

export const emptyRow = () => ({ name: '', freq: '', food: '', days: '', note: '' });

const FOOD_RE = /^\s*(before food|after food|empty stomach)\s*(?:[;,.-]\s*)?/i;

// Card → saved medicine. Rows without a name are dropped.
export function rowsToMedicines(rows) {
  return (rows || [])
    .filter((r) => r.name && r.name.trim())
    .map((r) => {
      const days = String(r.days || '').trim();
      return {
        name: r.name.trim(),
        dosage: '',
        frequency: String(r.freq || '').trim(),
        duration: /^\d+$/.test(days) ? `${Number(days)} day${Number(days) === 1 ? '' : 's'}` : days,
        instructions: [r.food, String(r.note || '').trim()].filter(Boolean).join('; '),
      };
    });
}

// Saved medicine → card (for "Update" and "Repeat last"). Nothing is lost:
// anything we don't recognise stays as typed text in its own field.
export function medicinesToRows(meds) {
  return (meds || []).map((m) => {
    let note = String(m.instructions || '');
    let food = '';
    const f = note.match(FOOD_RE);
    if (f) {
      food = FOODS.find((x) => x.toLowerCase() === f[1].toLowerCase());
      note = note.slice(f[0].length);
    }
    const dur = String(m.duration || '').trim();
    const d = dur.match(/^(\d+)\s*days?$/i);
    return {
      name: [m.name, m.dosage].filter(Boolean).join(' '),
      freq: String(m.frequency || '').trim(),
      food,
      days: d ? d[1] : dur,
      note: note.trim(),
    };
  });
}

// "Type as text instead": one medicine per LINE (so commas in notes are safe).
//   Name - when - days - note
export function rowsToText(rows) {
  return rowsToMedicines(rows)
    .map((m) => [m.name, m.frequency, m.duration, m.instructions].join(' - ').replace(/(\s-\s)+$/, ''))
    .join('\n');
}

export function textToRows(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  return medicinesToRows(lines.map((line) => {
    const p = line.split(' - ');
    return { name: p[0] || '', frequency: p[1] || '', duration: p[2] || '', instructions: p.slice(3).join(' - ') };
  }));
}

// One-line summary shown on a filled, collapsed card.
export function rowSummary(r) {
  const days = /^\d+$/.test(String(r.days)) ? `${r.days} days` : r.days;
  return [r.freq, r.food, days].filter(Boolean);
}
