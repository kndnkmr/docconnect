// ============================================
// Report Samjhao — understand your blood report
// ============================================
// Free, private tool: the user takes a photo of a PRINTED lab report (read on
// the phone, never uploaded) or types values, checks the numbers, and gets a
// plain-language explanation: Low / Normal range / High, what the test is,
// common reasons, and which doctor to see. Dangerous values get a
// "see a doctor today" box at the top. It explains; it never diagnoses.
//
// Routes:
//   /tools/blood-report      English by default (or saved language)
//   /tools/blood-report/hi   Hindi — its own indexable page
//
// Rules, ranges and copy live in ./reports.js (shared with the prerender);
// photo reading lives in ./reportOcr.js and loads only when a photo is chosen.

import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import LangToggle from '../../components/LangToggle';
import { trackEvent } from '../../components/Analytics';
import { articleMeta } from '../blog/blogMeta';
import { titlesHi } from '../blog/titlesHi';
import {
  TOOL_PATH, PARAMS, TESTS, PARAM_ORDER, COPY, EXPLAIN, TEST_ARTICLES, RELATED_ARTICLES,
  interpret, levelLabel, reasonText, urgentText, formatValue, normalizeTyped,
} from './reports';

const SITE = 'https://www.promedicoz.in';
const LEVEL_STYLE = {
  low: { box: 'bg-orange-50 border-orange-200', pill: 'bg-orange-500 text-white', dot: 'bg-orange-500' },
  high: { box: 'bg-orange-50 border-orange-200', pill: 'bg-orange-500 text-white', dot: 'bg-orange-500' },
  border: { box: 'bg-amber-50 border-amber-200', pill: 'bg-amber-500 text-white', dot: 'bg-amber-500' },
  ok: { box: 'bg-green-50 border-green-100', pill: 'bg-green-600 text-white', dot: 'bg-green-600' },
};
const emptyRow = () => ({ value: '', unit: 0, low: '', high: '', unsure: false });
const num = (s) => {
  const n = Number(String(s).replace(/,/g, '').trim());
  return String(s).trim() !== '' && Number.isFinite(n) ? n : null;
};

// Where a value sits on a simple bar (range-type tests only).
function RangeBar({ value, range }) {
  const [lo, hi] = range;
  const span = hi - lo;
  const min = Math.max(0, lo - span);
  const max = hi + span;
  const pos = (x) => `${Math.min(100, Math.max(0, ((x - min) / (max - min)) * 100))}%`;
  return (
    <div className="relative mt-3 h-2.5 rounded-full bg-gray-200" aria-hidden="true">
      <div className="absolute inset-y-0 bg-green-200" style={{ left: pos(lo), right: `calc(100% - ${pos(hi)})` }} />
      <div className="absolute -top-1 w-4 h-4 -ml-2 rounded-full bg-gray-800 border-2 border-white shadow" style={{ left: pos(value) }} />
    </div>
  );
}

function ReportSamjhao({ defaultLang }) {
  const [lang, setLang] = useState(() => {
    if (defaultLang) return defaultLang;
    try {
      const saved = localStorage.getItem('promedicoz_lang');
      if (saved === 'en' || saved === 'hi') return saved;
    } catch { /* ignore */ }
    return 'en';
  });
  const t = COPY[lang] || COPY.en;

  const [sex, setSex] = useState('f');
  const [tab, setTab] = useState('cbc');
  const [rows, setRows] = useState(() => Object.fromEntries(PARAM_ORDER.map((id) => [id, emptyRow()])));
  const [useReportRange, setUseReportRange] = useState(false);
  const [fromPhoto, setFromPhoto] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [ocr, setOcr] = useState({ status: 'idle', progress: 0, stage: '', found: 0 });
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const fileRef = useRef(null);

  const setRow = (id, patch) => { setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } })); setResults(null); };
  const filledIn = (testId) => TESTS.find((x) => x.id === testId).params.filter((id) => num(rows[id].value) != null).length;

  // ---- Photo ----
  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setResults(null); setShowForm(true);
    setOcr({ status: 'reading', progress: 0, stage: 'load', found: 0 });
    trackEvent('tool_report_photo', { step: 'start' });
    try {
      const { readReportPhoto } = await import('./reportOcr');
      const { values } = await readReportPhoto(file, (p, stage) => setOcr((o) => ({ ...o, progress: p, stage })));
      const ids = Object.keys(values);
      setRows((r) => {
        const next = { ...r };
        for (const id of ids) {
          const v = values[id];
          next[id] = {
            value: String(v.value), unit: 0, unsure: v.unsure,
            low: v.range ? String(v.range[0]) : '', high: v.range ? String(v.range[1]) : '',
          };
        }
        return next;
      });
      if (ids.some((id) => values[id].range)) setUseReportRange(true);
      if (ids.length) setTab(PARAMS[ids[0]].test);
      setFromPhoto(ids.length > 0);
      setConfirmed(false);
      setOcr({ status: ids.length ? 'done' : 'none', progress: 1, stage: 'read', found: ids.length });
      trackEvent('tool_report_photo', { step: ids.length ? 'found' : 'none', count: ids.length });
    } catch (err) {
      setOcr({ status: 'fail', progress: 0, stage: '', found: 0 });
      trackEvent('tool_report_photo', { step: 'fail' });
    }
  };

  // ---- Explain ----
  const onExplain = (e) => {
    e.preventDefault();
    const filled = PARAM_ORDER.filter((id) => num(rows[id].value) != null);
    if (!filled.length) { setError(t.noValues); return; }
    if (fromPhoto && !confirmed) { setError(t.confirmNeeded); return; }
    setError('');
    const list = filled.map((id) => {
      const p = PARAMS[id];
      const row = rows[id];
      // In the default unit, detect the common other scales (see normalizeTyped).
      const toBase = row.unit === 0 ? (v) => normalizeTyped(id, v) : (p.units[row.unit]?.toBase || ((v) => v));
      const value = toBase(num(row.value));
      const lo = num(row.low); const hi = num(row.high);
      const reportRange = useReportRange && lo != null && hi != null ? [toBase(lo), toBase(hi)] : null;
      return { id, value, r: interpret(id, value, sex, reportRange) };
    }).filter((x) => x.r);
    setResults(list);
    // Only how the values were entered — never results (no health details to analytics).
    trackEvent('tool_report_explain', { source: fromPhoto ? 'photo' : 'typed' });
    setTimeout(() => document.getElementById('report-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const resetAll = () => {
    setRows(Object.fromEntries(PARAM_ORDER.map((id) => [id, emptyRow()])));
    setResults(null); setFromPhoto(false); setConfirmed(false); setUseReportRange(false);
    setOcr({ status: 'idle', progress: 0, stage: '', found: 0 }); setShowForm(false); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onShare = async () => {
    const url = `${SITE}${lang === 'hi' ? `${TOOL_PATH}/hi` : TOOL_PATH}`;
    const msg = t.shareMsg(url);
    trackEvent('tool_report_share', { method: navigator.share ? 'native' : 'whatsapp' });
    if (navigator.share) {
      try { await navigator.share({ text: msg }); } catch { /* dismissed */ }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const bySlug = useMemo(() => new Map(articleMeta.map((a) => [a.slug, a])), []);
  const articleLinks = (slugs) => slugs.map((s) => bySlug.get(s)).filter(Boolean);
  const resultTests = results ? [...new Set(results.map((x) => PARAMS[x.id].test))] : [];
  const related = articleLinks(results ? [...new Set(resultTests.flatMap((id) => TEST_ARTICLES[id] || []))] : RELATED_ARTICLES);
  const urgentList = results ? results.filter((x) => x.r.urgent) : [];
  const sorted = results ? [...results].sort((a, b) => (a.r.level === 'ok') - (b.r.level === 'ok')) : [];
  const specFor = (id) => PARAMS[id].doctor;
  const rangeText = (id, rr) => (rr.range ? `${formatValue(id, rr.range[0])} – ${formatValue(id, rr.range[1])}` : '');
  const bandText = (id) => {
    const b = PARAMS[id].bands;
    const unit = PARAMS[id].units[0].id;
    // Same wording in both languages ("Normal" is used as-is in Hinglish).
    if (id === 'hba1c') return `Normal: < 5.7 ${unit}`;
    if (id === 'vitd') return `Normal: 30 – 100 ${unit}`;
    return `Normal: ${b[0].max + 1} – ${b[1].max} ${unit}`;
  };

  const isHindiRoute = defaultLang === 'hi';
  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-gray-50 border text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 focus:bg-white outline-none';
  const activeTest = TESTS.find((x) => x.id === tab);

  return (
    <div className="flex-grow bg-gray-50">
      <SEO
        title={isHindiRoute ? COPY.hi.seoTitle : COPY.en.seoTitle}
        description={isHindiRoute ? COPY.hi.seoDesc : COPY.en.seoDesc}
        path={isHindiRoute ? `${TOOL_PATH}/hi` : TOOL_PATH}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-900 text-white">
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="relative container mx-auto px-4 pt-8 pb-16 max-w-2xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-indigo-100 text-xs font-medium">{t.kicker}</p>
            <LangToggle lang={lang} onChange={setLang} />
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold">{t.title}</h1>
          <p className="mt-1 text-indigo-100 text-sm sm:text-base">{t.subtitle}</p>
          <p className="mt-1 text-indigo-200 text-xs">{t.scope}</p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-2xl -mt-10 pb-12 relative">
        {/* Step 1: photo or type */}
        <div className="bg-white rounded-2xl shadow-md p-5 sm:p-6">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} aria-hidden="true" tabIndex={-1} />
          <div className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-5 text-center">
            <p className="text-3xl" aria-hidden="true">📷</p>
            <p className="mt-1 font-bold text-indigo-900">{t.photoTitle}</p>
            <p className="text-xs text-indigo-700">{t.photoSub}</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={ocr.status === 'reading'}
              className="mt-3 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {t.openCamera}
            </button>
          </div>

          {ocr.status === 'reading' && (
            <div className="mt-4 rounded-xl bg-indigo-50 p-4" role="status">
              <p className="text-sm font-semibold text-indigo-900">{t.reading}</p>
              <div className="mt-2 h-2 rounded-full bg-indigo-100 overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all" style={{ width: `${Math.round((ocr.stage === 'read' ? 0.3 + ocr.progress * 0.7 : ocr.progress * 0.3) * 100)}%` }} />
              </div>
              {ocr.stage === 'load' && <p className="mt-1.5 text-xs text-indigo-700">{t.readingSlow}</p>}
            </div>
          )}
          {ocr.status === 'done' && <p className="mt-4 rounded-xl bg-indigo-50 text-indigo-900 text-sm p-3">✓ {t.readDone(ocr.found)}</p>}
          {ocr.status === 'none' && <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">{t.readNone}</p>}
          {ocr.status === 'fail' && <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">{t.readFail}</p>}

          {!showForm && (
            <>
              <p className="my-3 text-center text-xs text-gray-400">— {t.or} —</p>
              <button type="button" onClick={() => setShowForm(true)}
                className="w-full py-3 rounded-xl border-2 border-indigo-200 text-indigo-700 font-semibold hover:bg-indigo-50 transition">
                {t.typeInstead}
              </button>
              {/* Privacy first: people decide whether to take the photo here. */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                  <p className="text-sm font-bold text-green-900">{t.photoPrivacyTitle}</p>
                  <p className="mt-1.5 text-xs text-green-800 leading-relaxed">{t.photoPrivacy}</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-sm font-bold text-gray-800">{t.tipsTitle}</p>
                  <ul className="mt-1.5 text-xs text-gray-600 grid gap-1 list-disc pl-4">
                    {t.tips.map((tip) => <li key={tip}>{tip}</li>)}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Step 2: values (typed or read from photo) */}
        {showForm && (
          <form onSubmit={onExplain} className="mt-4 bg-white rounded-2xl shadow-md p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">{t.sexLabel}</span>
              <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label={t.sexLabel}>
                {[['f', t.woman], ['m', t.man]].map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={sex === k} onClick={() => { setSex(k); setResults(null); }}
                    className={`px-4 py-1.5 text-sm font-medium ${sex === k ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-4 text-sm font-semibold text-gray-700">{t.pickTest}</p>
            <div className="mt-2 flex flex-wrap gap-2" role="tablist">
              {TESTS.map((x) => {
                const n = filledIn(x.id);
                return (
                  <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${tab === x.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}>
                    {x.label[lang] || x.label.en}{n > 0 && <span className="ml-1.5 text-xs opacity-80">· {n}</span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-4" role="tabpanel">
              {activeTest.params.map((id) => {
                const p = PARAMS[id];
                const row = rows[id];
                const showRange = useReportRange && p.kind === 'range';
                return (
                  <div key={id} className={`rounded-xl p-3 border ${row.unsure ? 'bg-amber-50 border-amber-300' : 'border-gray-100'}`}>
                    <label htmlFor={`rv-${id}`} className="block text-sm font-semibold text-gray-700">{p.name[lang] || p.name.en}</label>
                    {row.unsure && <p className="text-xs text-amber-700 mt-0.5">⚠ {t.unsure}</p>}
                    <div className="mt-1.5 flex gap-2">
                      <input id={`rv-${id}`} inputMode="decimal" autoComplete="off" value={row.value}
                        onChange={(e) => setRow(id, { value: e.target.value, unsure: false })}
                        className={`${inputCls} ${row.unsure ? 'border-amber-400' : 'border-gray-200'} flex-1 min-w-0`} />
                      {p.units.length > 1 ? (
                        <select aria-label={t.unitLabel} value={row.unit} onChange={(e) => setRow(id, { unit: Number(e.target.value) })}
                          className="px-2 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 w-32">
                          {p.units.map((u, i) => <option key={u.id} value={i}>{u.id}</option>)}
                        </select>
                      ) : (
                        <span className="self-center text-sm text-gray-500 w-32">{p.units[0].id}</span>
                      )}
                    </div>
                    {showRange && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                        <span>{t.reportRange('')}</span>
                        <input aria-label={`${p.name.en} ${t.rangeLow}`} inputMode="decimal" placeholder={t.rangeLow} value={row.low}
                          onChange={(e) => setRow(id, { low: e.target.value })} className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50" />
                        <span>–</span>
                        <input aria-label={`${p.name.en} ${t.rangeHigh}`} inputMode="decimal" placeholder={t.rangeHigh} value={row.high}
                          onChange={(e) => setRow(id, { high: e.target.value })} className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500">{t.blankHint}</p>

            <label className="mt-4 flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={useReportRange} onChange={(e) => { setUseReportRange(e.target.checked); setResults(null); }} className="mt-0.5 w-4 h-4 accent-indigo-600" />
              {t.useReportRange}
            </label>
            {fromPhoto && (
              <label className="mt-3 flex items-start gap-2 text-sm font-medium text-gray-800 cursor-pointer rounded-xl bg-indigo-50 p-3">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600" />
                {t.confirm}
              </label>
            )}

            {error && <p className="mt-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3" role="alert">{error}</p>}
            <button type="submit" className="mt-4 w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:scale-[0.99] transition">
              {t.explain}
            </button>
            <p className="mt-3 text-xs text-gray-600 text-center leading-relaxed">🔒 {t.privacy}</p>
          </form>
        )}

        {/* Step 3: results */}
        {results && (
          <div id="report-results" className="mt-4 bg-white rounded-2xl shadow-md p-5 sm:p-6 scroll-mt-20" aria-live="polite">
            {urgentList.length > 0 && (
              <div className="mb-4 rounded-2xl bg-red-50 border-2 border-red-300 p-4" role="alert">
                <p className="font-bold text-red-800">{t.urgentTitle}</p>
                {urgentList.map((x) => <p key={x.id} className="mt-1.5 text-sm text-red-900">{urgentText(x.id, x.value, lang)}</p>)}
              </div>
            )}
            <h2 className="text-lg font-bold text-gray-800">{t.resultsTitle}</h2>
            <ul className="mt-3 grid gap-3">
              {sorted.map(({ id, value, r }) => {
                const p = PARAMS[id];
                const st = LEVEL_STYLE[r.level];
                const reason = reasonText(id, r, lang);
                const what = EXPLAIN[id][lang]?.what || EXPLAIN[id].en.what;
                return (
                  <li key={id} className={`rounded-2xl border p-4 ${st.box}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900">{p.name[lang] || p.name.en}</h3>
                      <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold ${st.pill}`}>{levelLabel(r, lang)}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-700">
                      {t.yours}: <span className="font-bold">{formatValue(id, value)} {p.format ? '' : p.units[0].id}</span>
                      {' · '}
                      {p.kind === 'range'
                        ? (r.usedReportRange ? t.yourRange(rangeText(id, r)) : t.normalRange(rangeText(id, r)))
                        : bandText(id)}
                    </p>
                    {p.kind === 'range' && <RangeBar value={value} range={r.range} />}
                    {!r.usedReportRange && p.kind === 'range' && <p className="mt-2 text-[11px] text-gray-500">{t.typicalNote}</p>}
                    {r.implausible && <p className="mt-2 text-xs text-amber-800">⚠ {t.implausible}</p>}

                    {r.level === 'ok' ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-medium text-green-800">{t.whatIs}</summary>
                        <p className="mt-1 text-sm text-gray-700">{what}</p>
                      </details>
                    ) : (
                      <>
                        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-500">{t.whatIs}</p>
                        <p className="text-sm text-gray-700">{what}</p>
                        {reason && <p className="mt-2 text-sm text-gray-800">{reason}</p>}
                        <Link
                          to={`/specialization/${specFor(id)}`}
                          onClick={() => trackEvent('find_doctor_click', { source: 'tool_report', specialization: specFor(id) })}
                          className="mt-3 inline-block text-sm font-semibold text-indigo-700 hover:underline"
                        >
                          {t.showDoctor(t.specNames[specFor(id)])}
                        </Link>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 grid gap-3">
              <Link
                to="/doctors"
                onClick={() => trackEvent('find_doctor_click', { source: 'tool_report', cta_position: 'results' })}
                className="py-3 rounded-xl bg-indigo-600 text-white font-semibold text-center hover:bg-indigo-700 transition"
              >
                {t.consult}
              </Link>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={onShare} className="py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition">{t.share}</button>
                <button type="button" onClick={resetAll} className="py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition">{t.again}</button>
              </div>
            </div>
          </div>
        )}

        {/* Safety note — always visible */}
        <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4">⚠️ {t.safety}</p>

        {/* Related reading */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <span className="w-1.5 h-5 rounded-full bg-indigo-600" aria-hidden="true" />{t.readMore}
            </h2>
            <ul className="mt-3 grid gap-2">
              {related.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={lang === 'hi' ? `/blog/${a.slug}/hi` : `/blog/${a.slug}`}
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:border-indigo-200 hover:shadow-sm transition"
                  >
                    <span className="text-2xl" aria-hidden="true">{a.image}</span>
                    <span className="text-sm font-medium text-gray-800">{lang === 'hi' ? (titlesHi[a.slug] || a.title) : a.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* How it works + FAQ */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <span className="w-1.5 h-5 rounded-full bg-indigo-600" aria-hidden="true" />{t.howTitle}
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">{t.how}</p>
          <h2 className="mt-6 flex items-center gap-2 text-lg font-bold text-gray-800">
            <span className="w-1.5 h-5 rounded-full bg-indigo-600" aria-hidden="true" />{t.faqTitle}
          </h2>
          <div className="mt-2 divide-y divide-gray-100">
            {t.faq.map((f) => (
              <details key={f.q} className="py-3 group">
                <summary className="cursor-pointer list-none flex justify-between gap-3 text-sm font-semibold text-gray-800">
                  {f.q}<span className="text-indigo-600 group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
                </summary>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportSamjhao;
