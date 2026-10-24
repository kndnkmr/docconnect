// ============================================
// Pregnancy Due Date Calculator ("Meri due date kab hai?")
// ============================================
// A free, private tool: the user enters the first day of her last period and
// cycle length, and sees her estimated due date, weeks, trimester, and a fun
// "baby is the size of…" note. She can share the happy news (month only — never
// the exact date) to WhatsApp, which links family back to this tool.
//
// Routes (all render this component):
//   /tools/due-date-calculator        English by default (or saved language)
//   /tools/due-date-calculator/hi     Hindi — its own indexable page
//   /tools/due-date-calculator/:month Share landing (e.g. /2027-03): shows the
//                                     "happy news" banner; not indexed, its
//                                     canonical is the main tool page.
//
// All logic and copy live in ./dueDate.js (shared with the build-time
// prerender, so crawlers see the same text). Nothing is stored or sent: the
// calculation runs entirely in the browser.

import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import SEO from '../../components/SEO';
import LangToggle from '../../components/LangToggle';
import { trackEvent } from '../../components/Analytics';
import { articleMeta } from '../blog/blogMeta';
import { titlesHi } from '../blog/titlesHi';
import { vaccinePath } from './toolLinks';
import {
  TOOL_PATH, MIN_CYCLE, MAX_CYCLE, COPY, RELATED_ARTICLES,
  calculate, sizeForWeek, formatDate, monthLabel, todayUTC, toISO,
} from './dueDate';

const SITE = 'https://www.promedicoz.in';
const DAY = 86400000;

function DueDateCalculator({ defaultLang }) {
  const { month } = useParams();
  const sharedMonth = monthLabel(month); // null unless a valid share link

  const [lang, setLang] = useState(() => {
    if (defaultLang) return defaultLang;
    try {
      const saved = localStorage.getItem('promedicoz_lang');
      if (saved === 'en' || saved === 'hi') return saved;
    } catch { /* ignore */ }
    // Share links usually travel through Hindi-speaking family groups.
    return sharedMonth ? 'hi' : 'en';
  });
  const t = COPY[lang] || COPY.en;

  const today = todayUTC();
  const [lmp, setLmp] = useState('');
  const [cycle, setCycle] = useState(28);
  const [result, setResult] = useState(null);

  const onSubmit = (e) => {
    e.preventDefault();
    const r = calculate(lmp, cycle, todayUTC());
    setResult(r);
    if (!r.error) trackEvent('tool_due_date_calculate', { weeks: r.weeks, trimester: r.trimester });
  };

  const shareUrl = result && !result.error ? `${SITE}${TOOL_PATH}/${result.monthKey}` : `${SITE}${TOOL_PATH}`;
  const onShare = async () => {
    if (!result || result.error) return;
    const msg = t.shareMsg(monthLabel(result.monthKey), shareUrl);
    trackEvent('tool_due_date_share', { method: navigator.share ? 'native' : 'whatsapp' });
    if (navigator.share) {
      try { await navigator.share({ text: msg }); return; } catch { /* dismissed */ return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const related = useMemo(() => RELATED_ARTICLES
    .map((slug) => articleMeta.find((a) => a.slug === slug))
    .filter(Boolean), []);

  const size = result && !result.error ? sizeForWeek(result.weeks) : null;
  const progress = result && !result.error ? Math.min(100, Math.round((Math.min(result.weeks, 40) / 40) * 100)) : 0;
  const errText = result?.error === 'future' ? t.errFuture : result?.error === 'tooOld' ? t.errTooOld : result?.error ? t.errInvalid : '';

  const isHindiRoute = defaultLang === 'hi';
  return (
    <div className="flex-grow bg-gray-50">
      <SEO
        title={isHindiRoute ? COPY.hi.seoTitle : COPY.en.seoTitle}
        description={isHindiRoute ? COPY.hi.seoDesc : COPY.en.seoDesc}
        path={isHindiRoute ? `${TOOL_PATH}/hi` : TOOL_PATH}
        noindex={Boolean(month) && !isHindiRoute}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-pink-600 via-pink-600 to-rose-800 text-white">
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="relative container mx-auto px-4 pt-8 pb-16 max-w-2xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-pink-100 text-xs font-medium">{t.kicker}</p>
            <LangToggle lang={lang} onChange={setLang} />
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold">{t.title}</h1>
          <p className="mt-1 text-pink-100 text-sm sm:text-base">{t.subtitle}</p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-2xl -mt-10 pb-12 relative">
        {sharedMonth && (
          <div className="mb-4 rounded-2xl bg-white border border-pink-100 shadow-sm p-4 text-sm text-pink-900">
            {t.sharedBanner(sharedMonth)}
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-md p-5 sm:p-6">
          <label htmlFor="lmp" className="block text-sm font-semibold text-gray-700">{t.lmpLabel}</label>
          <input
            id="lmp"
            type="date"
            required
            value={lmp}
            max={toISO(today)}
            min={toISO(today - 44 * 7 * DAY)}
            onChange={(e) => { setLmp(e.target.value); setResult(null); }}
            className="mt-1.5 w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-pink-500 focus:border-pink-400 focus:bg-white outline-none"
          />

          <label htmlFor="cycle" className="block mt-4 text-sm font-semibold text-gray-700">{t.cycleLabel}</label>
          <select
            id="cycle"
            value={cycle}
            onChange={(e) => { setCycle(Number(e.target.value)); setResult(null); }}
            className="mt-1.5 w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-pink-500 focus:border-pink-400 focus:bg-white outline-none"
          >
            {Array.from({ length: MAX_CYCLE - MIN_CYCLE + 1 }, (_, i) => MIN_CYCLE + i).map((n) => (
              <option key={n} value={n}>{t.cycleDays(n)}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">{t.cycleHelp}</p>

          <button type="submit" className="mt-5 w-full py-3.5 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 active:scale-[0.99] transition">
            {t.calc}
          </button>
          <p className="mt-3 text-xs text-gray-500 text-center">🔒 {t.privacy}</p>
        </form>

        {/* Result */}
        <div aria-live="polite">
          {errText && (
            <p className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-4">{errText}</p>
          )}
          {result && !result.error && (
            <div className="mt-4 bg-white rounded-2xl shadow-md p-5 sm:p-6">
              <div className="rounded-2xl bg-pink-50 border border-pink-100 p-5">
                <p className="text-sm text-pink-800">{t.resultLabel}</p>
                <p className="mt-1 text-3xl font-bold text-pink-900">{formatDate(result.due)}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs sm:text-sm">
                  <span className="px-3 py-1 rounded-full bg-white text-pink-800 border border-pink-100">🗓 {t.weeksNow(result.weeks, result.days)}</span>
                  <span className="px-3 py-1 rounded-full bg-white text-pink-800 border border-pink-100">{t.trimester(result.trimester)}</span>
                  {!result.pastDue && <span className="px-3 py-1 rounded-full bg-white text-pink-800 border border-pink-100">{t.daysLeft(result.daysLeft)}</span>}
                </div>
                <div className="mt-4">
                  <div className="h-2 rounded-full bg-pink-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={40} aria-valuenow={Math.min(result.weeks, 40)}>
                    <div className="h-full bg-pink-600 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">{t.weekOf(result.weeks)}</p>
                </div>
                {size && <p className="mt-3 text-sm text-gray-700">{t.size(size[lang] || size.en)}</p>}
                {result.early && <p className="mt-3 text-sm text-gray-700">ℹ️ {t.early}</p>}
                {result.pastDue && <p className="mt-3 text-sm text-gray-700">ℹ️ {t.pastDue}</p>}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={onShare} className="py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition">
                  {t.share}
                </button>
                <Link
                  to="/specialization/gynaecologist"
                  onClick={() => trackEvent('find_doctor_click', { source: 'tool_due_date', specialization: 'Gynaecologist' })}
                  className="py-3 rounded-xl border-2 border-pink-600 text-pink-700 font-semibold text-center hover:bg-pink-50 transition"
                >
                  {t.doctor}
                </Link>
              </div>
              <Link
                to={vaccinePath(lang)}
                onClick={() => trackEvent('tool_vaccine_entry', { source: 'due_date_result' })}
                className="mt-3 block text-center text-sm font-semibold text-teal-700 hover:underline"
              >
                💉 {t.afterBaby}
              </Link>
            </div>
          )}
        </div>

        {/* Safety note — always visible */}
        <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4">⚠️ {t.safety}</p>

        {/* Related reading */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <span className="w-1.5 h-5 rounded-full bg-pink-600" aria-hidden="true" />{t.readMore}
            </h2>
            <ul className="mt-3 grid gap-2">
              {related.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={lang === 'hi' ? `/blog/${a.slug}/hi` : `/blog/${a.slug}`}
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:border-pink-200 hover:shadow-sm transition"
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
            <span className="w-1.5 h-5 rounded-full bg-pink-600" aria-hidden="true" />{t.howTitle}
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">{t.how}</p>

          <h2 className="mt-6 flex items-center gap-2 text-lg font-bold text-gray-800">
            <span className="w-1.5 h-5 rounded-full bg-pink-600" aria-hidden="true" />{t.faqTitle}
          </h2>
          <div className="mt-2 divide-y divide-gray-100">
            {t.faq.map((f) => (
              <details key={f.q} className="py-3 group">
                <summary className="cursor-pointer list-none flex justify-between gap-3 text-sm font-semibold text-gray-800">
                  {f.q}<span className="text-pink-600 group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
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

export default DueDateCalculator;
