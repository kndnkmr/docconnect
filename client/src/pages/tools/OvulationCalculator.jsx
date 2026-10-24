// ============================================
// Ovulation & Period Calculator ("Ovulation kab hai?")
// ============================================
// A free, private tool: the user enters the first day of her last period,
// cycle length and period length, and sees her next fertile days, likely
// ovulation day, next period, a colour-coded month calendar and the next 3
// cycles. She can add reminders to her phone calendar (an .ics file built on
// the phone) and share the TOOL link — never her dates — on WhatsApp.
//
// Routes:
//   /tools/ovulation-calculator      English by default (or saved language)
//   /tools/ovulation-calculator/hi   Hindi — its own indexable page
//
// All logic and copy live in ./ovulation.js (shared with the build-time
// prerender, so crawlers see the same text). Nothing is stored or sent.

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import SEO from '../../components/SEO';
import LangToggle from '../../components/LangToggle';
import { trackEvent } from '../../components/Analytics';
import { articleMeta } from '../blog/blogMeta';
import { titlesHi } from '../blog/titlesHi';
import { dueDatePath } from './toolLinks';
import {
  TOOL_PATH, MIN_CYCLE, MAX_CYCLE, MIN_PERIOD, MAX_PERIOD, MAX_LMP_DAYS, COPY, RELATED_ARTICLES,
  calculate, dayKind, monthGrid, monthTitle, shortDate, dayDate, rangeLabel, buildIcs, todayUTC, toISO,
} from './ovulation';

const SITE = 'https://www.promedicoz.in';
const DAY = 86400000;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const KIND_CLASS = {
  ovulation: 'bg-violet-600 text-white font-bold',
  fertile: 'bg-violet-100 text-violet-800',
  period: 'bg-pink-100 text-pink-700',
};

function OvulationCalculator({ defaultLang }) {
  const [lang, setLang] = useState(() => {
    if (defaultLang) return defaultLang;
    try {
      const saved = localStorage.getItem('promedicoz_lang');
      if (saved === 'en' || saved === 'hi') return saved;
    } catch { /* ignore */ }
    return 'en';
  });
  const t = COPY[lang] || COPY.en;

  const today = todayUTC();
  const [lmp, setLmp] = useState('');
  const [cycle, setCycle] = useState(28);
  const [period, setPeriod] = useState(5);
  const [result, setResult] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0); // calendar: months from today's month

  const reset = () => { setResult(null); setMonthOffset(0); };
  const onSubmit = (e) => {
    e.preventDefault();
    const r = calculate(lmp, cycle, period, todayUTC());
    setResult(r);
    setMonthOffset(0);
    if (!r.error) trackEvent('tool_ovulation_calculate', { cycle: r.cycle, late: r.late ? 'yes' : 'no' });
  };

  const ok = result && !result.error;
  const errText = result?.error === 'future' ? t.errFuture : result?.error === 'tooOld' ? t.errTooOld : result?.error ? t.errInvalid : '';

  // Calendar month shown (today's month + offset, limited to -3..+3).
  const now = new Date(today);
  const calY = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1)).getUTCFullYear();
  const calM = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1)).getUTCMonth();
  const weeks = useMemo(() => monthGrid(calY, calM), [calY, calM]);

  const onCalendar = () => {
    if (!ok) return;
    const blob = new Blob([buildIcs(result, lang)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'promedicoz-cycle-reminders.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(t.calDone);
    trackEvent('tool_ovulation_calendar', {});
  };

  // Shares the tool link only — never her dates.
  const onShare = async () => {
    const url = `${SITE}${lang === 'hi' ? `${TOOL_PATH}/hi` : TOOL_PATH}`;
    const msg = t.shareMsg(url);
    trackEvent('tool_ovulation_share', { method: navigator.share ? 'native' : 'whatsapp' });
    if (navigator.share) {
      try { await navigator.share({ text: msg }); } catch { /* dismissed */ }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const related = useMemo(() => RELATED_ARTICLES
    .map((slug) => articleMeta.find((a) => a.slug === slug))
    .filter(Boolean), []);

  const isHindiRoute = defaultLang === 'hi';
  const selectCls = 'mt-1.5 w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-violet-500 focus:border-violet-400 focus:bg-white outline-none';
  return (
    <div className="flex-grow bg-gray-50">
      <SEO
        title={isHindiRoute ? COPY.hi.seoTitle : COPY.en.seoTitle}
        description={isHindiRoute ? COPY.hi.seoDesc : COPY.en.seoDesc}
        path={isHindiRoute ? `${TOOL_PATH}/hi` : TOOL_PATH}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-violet-600 to-purple-800 text-white">
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="relative container mx-auto px-4 pt-8 pb-16 max-w-2xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-violet-100 text-xs font-medium">{t.kicker}</p>
            <LangToggle lang={lang} onChange={setLang} />
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold">{t.title}</h1>
          <p className="mt-1 text-violet-100 text-sm sm:text-base">{t.subtitle}</p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-2xl -mt-10 pb-12 relative">
        {/* Form */}
        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-md p-5 sm:p-6">
          <label htmlFor="ovu-lmp" className="block text-sm font-semibold text-gray-700">{t.lmpLabel}</label>
          <input
            id="ovu-lmp"
            type="date"
            required
            value={lmp}
            max={toISO(today)}
            min={toISO(today - MAX_LMP_DAYS * DAY)}
            onChange={(e) => { setLmp(e.target.value); reset(); }}
            className={selectCls}
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ovu-cycle" className="block text-sm font-semibold text-gray-700">{t.cycleLabel}</label>
              <select id="ovu-cycle" value={cycle} onChange={(e) => { setCycle(Number(e.target.value)); reset(); }} className={selectCls}>
                {Array.from({ length: MAX_CYCLE - MIN_CYCLE + 1 }, (_, i) => MIN_CYCLE + i).map((n) => (
                  <option key={n} value={n}>{t.cycleDays(n)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ovu-period" className="block text-sm font-semibold text-gray-700">{t.periodLabel}</label>
              <select id="ovu-period" value={period} onChange={(e) => { setPeriod(Number(e.target.value)); reset(); }} className={selectCls}>
                {Array.from({ length: MAX_PERIOD - MIN_PERIOD + 1 }, (_, i) => MIN_PERIOD + i).map((n) => (
                  <option key={n} value={n}>{t.periodDays(n)}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">{t.help}</p>

          <button type="submit" className="mt-5 w-full py-3.5 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 active:scale-[0.99] transition">
            {t.calc}
          </button>
          <p className="mt-3 text-xs text-gray-500 text-center">🔒 {t.privacy}</p>
        </form>

        {/* Result */}
        <div aria-live="polite">
          {errText && (
            <p className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-4">{errText}</p>
          )}
          {ok && (
            <div className="mt-4 bg-white rounded-2xl shadow-md p-5 sm:p-6">
              {/* Late period → pregnancy test + due-date tool */}
              {result.late && (
                <Link
                  to={dueDatePath(lang)}
                  onClick={() => trackEvent('tool_due_date_entry', { source: 'ovulation_late' })}
                  className="mb-4 block rounded-2xl bg-pink-50 border border-pink-200 p-4 hover:bg-pink-100 transition-colors"
                >
                  <p className="text-sm font-semibold text-pink-900">🤰 {t.lateTitle}</p>
                  <p className="mt-1 text-sm text-pink-800">{t.lateText(shortDate(result.late.expected), result.late.days)}</p>
                  <p className="mt-1 text-sm font-semibold text-pink-700">{t.lateLink}</p>
                </Link>
              )}

              <div className="rounded-2xl bg-violet-600 text-white p-5">
                <p className="text-sm text-violet-100">{result.fertileNow ? t.fertileNow : t.fertileLabel}</p>
                <p className="mt-1 text-3xl font-bold">{rangeLabel(result.fertileStart, result.ovulation)}</p>
                <p className="mt-2 text-sm text-violet-50">{t.ovulation(dayDate(result.ovulation))}</p>
                <div className="mt-3 pt-3 border-t border-violet-400/60 text-sm">
                  <p className="text-violet-50">{t.nextPeriod(dayDate(result.nextPeriod))}</p>
                  <p className="text-xs text-violet-200 mt-0.5">{t.testFrom(shortDate(result.testFrom))}</p>
                </div>
              </div>

              {/* Calendar */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setMonthOffset((m) => Math.max(-3, m - 1))} disabled={monthOffset <= -3}
                    aria-label={t.prevMonth} className="w-9 h-9 rounded-full hover:bg-gray-100 disabled:opacity-30 text-gray-600">‹</button>
                  <h2 className="text-sm font-bold text-gray-800">{monthTitle(calY, calM)}</h2>
                  <button type="button" onClick={() => setMonthOffset((m) => Math.min(3, m + 1))} disabled={monthOffset >= 3}
                    aria-label={t.nextMonth} className="w-9 h-9 rounded-full hover:bg-gray-100 disabled:opacity-30 text-gray-600">›</button>
                </div>
                <table className="mt-2 w-full text-center text-sm">
                  <thead>
                    <tr>{WEEKDAYS.map((d, i) => <th key={i} scope="col" className="pb-1 text-[11px] font-medium text-gray-400">{d}</th>)}</tr>
                  </thead>
                  <tbody>
                    {weeks.map((w, wi) => (
                      <tr key={wi}>
                        {w.map((d, di) => {
                          if (d === null) return <td key={di} />;
                          const kind = dayKind(d, result.cycles);
                          const label = kind === 'ovulation' ? t.legendOvulation : kind === 'fertile' ? t.legendFertile : kind === 'period' ? t.legendPeriod : '';
                          return (
                            <td key={di} className="p-0.5">
                              <span
                                className={`mx-auto flex items-center justify-center h-8 rounded-lg ${KIND_CLASS[kind] || 'text-gray-700'} ${d === today ? 'ring-2 ring-gray-800' : ''}`}
                                aria-label={`${shortDate(d)}${label ? ` · ${label}` : ''}`}
                              >
                                {new Date(d).getUTCDate()}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-100" aria-hidden="true" />{t.legendFertile}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-600" aria-hidden="true" />{t.legendOvulation}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-pink-100 border border-pink-200" aria-hidden="true" />{t.legendPeriod}</span>
                </div>
              </div>

              {/* Next 3 cycles */}
              <h2 className="mt-5 text-sm font-bold text-gray-800">{t.nextThree}</h2>
              <table className="mt-2 w-full text-sm rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                <thead>
                  <tr className="text-xs text-gray-500 text-left">
                    <th scope="col" className="px-3 pt-2.5 pb-1 font-medium">{t.colPeriod}</th>
                    <th scope="col" className="px-3 pt-2.5 pb-1 font-medium">{t.colFertile}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.upcoming.map((c) => (
                    <tr key={c.start}>
                      <td className="px-3 py-1.5 font-semibold text-pink-700">{shortDate(c.start)}</td>
                      <td className="px-3 py-1.5 text-violet-800">{rangeLabel(c.fertileStart, c.ovulation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button type="button" onClick={onCalendar}
                className="mt-4 w-full py-3 rounded-xl border-2 border-violet-200 text-violet-700 font-semibold hover:bg-violet-50 transition">
                {t.addCal}
              </button>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={onShare} className="py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition">
                  {t.share}
                </button>
                <Link
                  to="/specialization/gynaecologist"
                  onClick={() => trackEvent('find_doctor_click', { source: 'tool_ovulation', specialization: 'Gynaecologist' })}
                  className="py-3 rounded-xl border-2 border-violet-600 text-violet-700 font-semibold text-center hover:bg-violet-50 transition"
                >
                  {t.doctor}
                </Link>
              </div>
              <p className="mt-3 text-xs text-gray-500">{t.doctorNote}</p>
            </div>
          )}
        </div>

        {/* Safety note — always visible */}
        <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4">⚠️ {t.safety}</p>

        {/* Related reading */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <span className="w-1.5 h-5 rounded-full bg-violet-600" aria-hidden="true" />{t.readMore}
            </h2>
            <ul className="mt-3 grid gap-2">
              {related.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={lang === 'hi' ? `/blog/${a.slug}/hi` : `/blog/${a.slug}`}
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:border-violet-200 hover:shadow-sm transition"
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
            <span className="w-1.5 h-5 rounded-full bg-violet-600" aria-hidden="true" />{t.howTitle}
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">{t.how}</p>

          <h2 className="mt-6 flex items-center gap-2 text-lg font-bold text-gray-800">
            <span className="w-1.5 h-5 rounded-full bg-violet-600" aria-hidden="true" />{t.faqTitle}
          </h2>
          <div className="mt-2 divide-y divide-gray-100">
            {t.faq.map((f) => (
              <details key={f.q} className="py-3 group">
                <summary className="cursor-pointer list-none flex justify-between gap-3 text-sm font-semibold text-gray-800">
                  {f.q}<span className="text-violet-600 group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
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

export default OvulationCalculator;
