// ============================================
// MedicineEditor — doctor's prescription medicines, one card per medicine
// ============================================
// Used inside the Write/Update Prescription modal (Dashboard.jsx) as a
// "custom" PromptModal field. Value = array of rows { name, freq, food, days,
// note } (see utils/rxRows.js, which converts to/from the saved fields).
//
// Fast to fill: type a name, tap When / Food / Days chips. Enter in the name
// box adds the next medicine. Suggests names the doctor has prescribed before.
// "Repeat last" copies the patient's previous prescription. A live preview
// shows what the patient's daily chart will say. Doctors who prefer typing
// can switch to a text box (one medicine per line — commas are safe).

import { useEffect, useMemo, useRef, useState } from 'react';
import { FREQ_MAIN, FREQ_MORE, FOODS, DAYS, emptyRow, rowsToText, textToRows, rowSummary, rowsToMedicines } from '../utils/rxRows';
import { buildChart, istDay } from '../utils/rxChart';

const MODE_KEY = 'promedicoz_rx_mode';
const chip = (on) => `px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${on ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`;
const foodChip = (f, on) => {
  if (!on) return chip(false);
  return `px-2.5 py-1 rounded-full text-xs font-semibold border ${f === 'After food' ? 'bg-green-600 border-green-600' : 'bg-red-600 border-red-600'} text-white`;
};
const SLOT_LABEL = { morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌆 Evening', night: '🌙 Night' };

function Chips({ options, value, onPick, styleFor = (o, on) => chip(on), label }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onPick(value === o ? '' : o)} className={styleFor(o, value === o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function MedCard({ row, index, open, onOpen, onChange, onRemove, onEnter, nameRef, suggestId }) {
  const [more, setMore] = useState(() => Boolean(row.freq) && !FREQ_MAIN.includes(row.freq));
  const [noteOpen, setNoteOpen] = useState(Boolean(row.note));
  const set = (patch) => onChange({ ...row, ...patch });
  const customFreq = row.freq && !FREQ_MAIN.includes(row.freq) && !FREQ_MORE.includes(row.freq);
  const customDays = row.days && !DAYS.includes(String(row.days));

  if (!open) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 flex items-start gap-2">
        <span className="text-[11px] font-bold text-gray-400 mt-0.5">{index + 1}</span>
        <button type="button" onClick={onOpen} className="flex-1 text-left">
          <span className="block text-sm font-semibold text-gray-900">{row.name || <span className="text-gray-400">(no name)</span>}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {rowSummary(row).map((s) => <span key={s} className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-50 text-primary-700">{s}</span>)}
            {row.note && <span className="text-[11px] italic text-gray-500">note: {row.note}</span>}
          </span>
        </button>
        <button type="button" onClick={onOpen} className="text-xs font-medium text-primary-600">Edit</button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${row.name || 'medicine'}`} className="text-gray-400 hover:text-red-600 text-lg leading-none">×</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary-200 bg-gray-50 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-gray-400">{index + 1}</span>
        <input
          ref={nameRef}
          list={suggestId}
          value={row.name}
          onChange={(e) => set({ name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
          placeholder="Medicine name and strength, e.g. Tab Pan 40"
          aria-label={`Medicine ${index + 1} name`}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm bg-white"
        />
        <button type="button" onClick={onRemove} aria-label={`Remove medicine ${index + 1}`} className="text-gray-400 hover:text-red-600 text-lg leading-none px-1">×</button>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">When</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          <Chips label="When" options={FREQ_MAIN} value={row.freq} onPick={(v) => set({ freq: v })} />
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className={chip(false)}>⋯</button>
        </div>
        {more && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
            <Chips label="More frequencies" options={FREQ_MORE} value={row.freq} onPick={(v) => set({ freq: v })} />
            <input
              value={customFreq ? row.freq : ''}
              onChange={(e) => set({ freq: e.target.value })}
              placeholder="or type…"
              aria-label="Other frequency"
              className="w-28 px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white"
            />
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Food</p>
        <Chips label="Food" options={FOODS} value={row.food} onPick={(v) => set({ food: v })} styleFor={foodChip} />
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Days</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          <Chips label="Days" options={DAYS} value={String(row.days)} onPick={(v) => set({ days: v })} />
          <input
            inputMode="numeric"
            value={customDays ? row.days : ''}
            onChange={(e) => set({ days: e.target.value })}
            placeholder="__ days"
            aria-label="Other number of days"
            className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white"
          />
        </div>
      </div>

      {noteOpen ? (
        <input
          value={row.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder='Note, e.g. "before breakfast" or "if fever above 100"'
          aria-label="Note"
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
        />
      ) : (
        <button type="button" onClick={() => setNoteOpen(true)} className="text-xs font-medium text-primary-600">＋ note</button>
      )}
    </div>
  );
}

export default function MedicineEditor({ value, onChange, suggestions = [], lastRx = null }) {
  const rows = Array.isArray(value) ? value : [];
  const [mode, setMode] = useState(() => { try { return localStorage.getItem(MODE_KEY) === 'text' ? 'text' : 'cards'; } catch { return 'cards'; } });
  const [openIdx, setOpenIdx] = useState(() => (rows.length ? -1 : 0));
  const [text, setText] = useState('');
  const nameRefs = useRef([]);
  const focusIdx = useRef(null);
  const suggestId = 'rx-med-suggestions';

  // Start with one empty card so the doctor can type straight away.
  useEffect(() => {
    if (mode === 'cards' && rows.length === 0) onChange([emptyRow()]);
    if (mode === 'text') setText(rowsToText(rows));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focusIdx.current != null) { nameRefs.current[focusIdx.current]?.focus(); focusIdx.current = null; }
  });

  const switchMode = (m) => {
    if (m === 'cards') onChange(textToRows(text).length ? textToRows(text) : [emptyRow()]);
    else setText(rowsToText(rows));
    setMode(m);
    setOpenIdx(-1);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  };

  const update = (i, row) => onChange(rows.map((r, j) => (j === i ? row : r)));
  const remove = (i) => {
    const next = rows.filter((_, j) => j !== i);
    onChange(next.length ? next : [emptyRow()]);
    setOpenIdx(next.length ? -1 : 0);
  };
  const add = () => {
    onChange([...rows, emptyRow()]);
    setOpenIdx(rows.length);
    focusIdx.current = rows.length;
  };
  const repeatLast = () => {
    if (!lastRx?.rows?.length) return;
    const filled = rows.some((r) => r.name.trim());
    if (filled && !window.confirm('Replace the medicines you have entered with the previous prescription?')) return;
    onChange(lastRx.rows.map((r) => ({ ...r })));
    setOpenIdx(-1);
  };

  // Live preview of the patient's daily chart (same rules as the chart itself).
  const preview = useMemo(() => {
    const meds = rowsToMedicines(mode === 'text' ? textToRows(text) : rows);
    if (!meds.length) return null;
    const c = buildChart({ createdAt: new Date().toISOString(), medicines: meds }, istDay(new Date()));
    const lines = [];
    for (const s of ['morning', 'afternoon', 'evening', 'night']) {
      if (c.groups[s].length) lines.push(`${SLOT_LABEL[s]}: ${c.groups[s].map((it) => `${it.name}${it.food ? ` (${it.food === 'empty' ? 'empty stomach' : `${it.food} food`})` : ''}`).join(', ')}`);
    }
    if (c.groups.once.length) lines.push(`🕐 Once a day: ${c.groups.once.map((it) => it.name).join(', ')}`);
    if (c.groups.weekly.length) lines.push(`📅 Once a week: ${c.groups.weekly.map((it) => it.name).join(', ')}`);
    if (c.groups.times.length) lines.push(`🔁 4 times a day: ${c.groups.times.map((it) => it.name).join(', ')}`);
    if (c.groups.sos.length) lines.push(`🆘 When needed: ${c.groups.sos.map((it) => it.name).join(', ')}`);
    return { lines, check: c.groups.check.map((it) => it.name) };
  }, [rows, text, mode]);

  const uniqueSuggestions = useMemo(() => [...new Set(suggestions.filter(Boolean))].slice(0, 300), [suggestions]);

  // Enter inside any small box here must never submit the whole prescription
  // (the name box handles Enter itself: it adds the next medicine).
  const blockEnterSubmit = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault();
  };

  return (
    <div className="space-y-2" onKeyDown={blockEnterSubmit}>
      <div className="flex items-center justify-between gap-2">
        {lastRx?.rows?.length > 0 ? (
          <button type="button" onClick={repeatLast} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100">
            ↻ Repeat last ({lastRx.label})
          </button>
        ) : <span />}
        <button type="button" onClick={() => switchMode(mode === 'cards' ? 'text' : 'cards')} className="text-[11px] font-medium text-gray-500 underline">
          {mode === 'cards' ? 'Type as text instead' : 'Use medicine cards'}
        </button>
      </div>

      {mode === 'text' ? (
        <>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); onChange(textToRows(e.target.value)); }}
            rows={5}
            placeholder={'One medicine per line:\nTab Pan 40 - 1-0-0 - 5 days - before food\nTab Calpol 650 - SOS -  - if fever, body ache'}
            aria-label="Medicines, one per line"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-y text-sm font-mono"
          />
          <p className="text-[11px] text-gray-500">Name - when - days - note. One medicine per line; commas are fine.</p>
        </>
      ) : (
        <>
          {rows.map((row, i) => (
            <MedCard
              key={i}
              row={row}
              index={i}
              open={openIdx === i}
              onOpen={() => setOpenIdx(i)}
              onChange={(r) => update(i, r)}
              onRemove={() => remove(i)}
              onEnter={add}
              nameRef={(el) => { nameRefs.current[i] = el; }}
              suggestId={suggestId}
            />
          ))}
          <button type="button" onClick={add} className="w-full py-2 rounded-lg border-2 border-dashed border-primary-300 text-primary-700 text-sm font-semibold hover:bg-primary-50">
            ＋ Add medicine <span className="text-[11px] font-normal text-gray-500">(or press Enter in the name)</span>
          </button>
          <datalist id={suggestId}>
            {uniqueSuggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </>
      )}

      {preview && (
        <div className="rounded-lg bg-primary-50 border border-primary-200 p-2.5 text-xs text-primary-900">
          <p className="font-semibold mb-1">👀 Patient's daily chart will show</p>
          {preview.lines.map((l) => <p key={l}>{l}</p>)}
          {preview.check.length > 0 && (
            <p className="mt-1 text-amber-800">⚠ No "when" set for: {preview.check.join(', ')}. The patient will be told to ask you.</p>
          )}
        </div>
      )}
    </div>
  );
}
