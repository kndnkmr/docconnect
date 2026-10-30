// ============================================
// Baby Vaccination Schedule ("Baby ko teeka kab lagega?")
// ============================================
// A free, private tool: parents enter the baby's date of birth and see every
// vaccine in India's government schedule (UIP) with its date, a "next due"
// summary, and a timeline they can tick off. Ticks are saved only in this
// browser (localStorage, keyed by birth date). They can add reminders to the
// phone calendar (.ics built on the phone) and share the TOOL link only.
//
// Routes:
//   /tools/vaccination-schedule      English by default (or saved language)
//   /tools/vaccination-schedule/hi   Hindi — its own indexable page
//
// Schedule, logic and copy live in ./vaccines.js (shared with the prerender).

import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import SEO from '../../components/SEO';
import LangToggle from '../../components/LangToggle';
import { trackEvent } from '../../components/Analytics';
import { articleMeta } from '../blog/blogMeta';
import { titlesHi } from '../blog/titlesHi';
import {
  TOOL_PATH, MAX_AGE_YEARS, COPY, RELATED_ARTICLES, PRIVATE_EXTRAS,
  calculate, visitStatuses, buildIcs, addMonths, formatDate, todayUTC, toISO,
} from './vaccines';

const SITE = 'https://www.promedicoz.in';
const DAY = 86400000;
const tickKey = (dob) => `promedicoz_vax_${dob}`;

function loadTicks(dob) {
  try { return new Set(JSON.parse(localStorage.getItem(tickKey(dob)) || '[]')); } catch { return new Set(); }
}

const DOT = {
  done: 'bg-green-600 text-white',
  check: 'bg-amber-500 text-white',
  now: 'bg-teal-600 text-white ring-4 ring-teal-200',
  next: 'bg-teal-600 text-white ring-4 ring-teal-200',
  later: 'bg-white border-2 border-gray-300',
};
const BOX = {
  done: 'bg-green-50 border-green-100',
  check: 'bg-amber-50 border-amber-200',
  now: 'bg-teal-50 border-teal-200',
  next: 'bg-teal-50 border-teal-200',
  later: 'bg-white border-gray-100',
};

function VaccinationSchedule({ defaultLang }) {
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
  const [dob, setDob] = useState('');
  const [result, setResult] = useState(null);
  const [ticked, setTicked] = useState(() => new Set());

  // Persist ticks for this birth date (this browser only).
  useEffect(() => {
    if (!result || result.error) return;
    try { localStorage.setItem(tickKey(dob), JSON.stringify([...ticked])); } catch { /* storage full/blocked */ }
  }, [ticked]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (e) => {
    e.preventDefault();
    const r = calculate(dob, todayUTC());
    setResult(r);
    if (!r.error) {
      setTicked(loadTicks(dob));
      trackEvent('tool_vaccine_calculate', {}); // no child details to analytics
    }
  };

  const ok = result && !result.error;
  const errText = result?.error === 'future' ? t.errFuture : result?.error === 'tooOld' ? t.errTooOld : result?.error ? t.errInvalid : '';
  const statuses = ok ? visitStatuses(result.visits, ticked, today) : [];
  const focusIdx = statuses.findIndex((s) => s === 'now') >= 0 ? statuses.indexOf('now') : statuses.indexOf('next');
  const focus = focusIdx >= 0 ? result.visits[focusIdx] : null;
  const checkCount = statuses.filter((s) => s === 'check').length;

  const toggle = (id) => setTicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const tickAllPast = () => setTicked((prev) => {
    const next = new Set(prev);
    result.visits.forEach((x, i) => {
      if (statuses[i] === 'check') x.vaccines.forEach((vac) => { if (!vac.optional) next.add(vac.id); });
    });
    trackEvent('tool_vaccine_tick_all', {});
    return next;
  });

  const onCalendar = () => {
    if (!ok) return;
    const blob = new Blob([buildIcs(result, lang, todayUTC())], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'promedicoz-baby-vaccines.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(t.calDone);
    trackEvent('tool_vaccine_calendar', {});
  };

  // Shares the tool link only — never the baby's birth date.
  const onShare = async () => {
    const url = `${SITE}${lang === 'hi' ? `${TOOL_PATH}/hi` : TOOL_PATH}`;
    const msg = t.shareMsg(url);
    trackEvent('tool_vaccine_share', { method: navigator.share ? 'native' : 'whatsapp' });
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
  const daysTo = (x) => Math.max(0, Math.round((x - today) / DAY));
  return (
    <div className="flex-grow bg-gray-50">
      <SEO
        title={isHindiRoute ? COPY.hi.seoTitle : COPY.en.seoTitle}
        description={isHindiRoute ? COPY.hi.seoDesc : COPY.en.seoDesc}
        path={isHindiRoute ? `${TOOL_PATH}/hi` : TOOL_PATH}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-800 text-white">
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="relative container mx-auto px-4 pt-8 pb-16 max-w-2xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-teal-100 text-xs font-medium">{t.kicker}</p>
            <LangToggle lang={lang} onChange={setLang} />
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold">{t.title}</h1>
          <p className="mt-1 text-teal-100 text-sm sm:text-base">{t.subtitle}</p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-2xl -mt-10 pb-12 relative">
        {/* Form */}
        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-md p-5 sm:p-6">
          <label htmlFor="vax-dob" className="block text-sm font-semibold text-gray-700">{t.dobLabel}</label>
          <input
            id="vax-dob"
            type="date"
            required
            value={dob}
            max={toISO(today)}
            min={toISO(addMonths(today, -MAX_AGE_YEARS * 12))}
            onChange={(e) => { setDob(e.target.value); setResult(null); }}
            className="mt-1.5 w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-400 focus:bg-white outline-none"
          />
          <button type="submit" className="mt-5 w-full py-3.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 active:scale-[0.99] transition">
            {t.calc}
          </button>
          <p className="mt-3 text-xs text-gray-600 text-center leading-relaxed">🔒 {t.privacy}</p>
        </form>

        <div aria-live="polite">
          {errText && (
            <p className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-4">{errText}</p>
          )}
        </div>

        {ok && (
          <>
            {/* Summary */}
            <div className="mt-4 bg-white rounded-2xl shadow-md p-5 sm:p-6">
              <div className="rounded-2xl bg-teal-600 text-white p-5">
                <p className="text-sm text-teal-100">{t.age(result.age)}</p>
                {focus ? (
                  <>
                    <p className="mt-2 text-sm">{statuses[focusIdx] === 'now' ? t.nowLabel : t.nextLabel}</p>
                    <p className="mt-1 text-2xl sm:text-3xl font-bold">
                      {statuses[focusIdx] === 'now' ? (focus.label[lang] || focus.label.en) : formatDate(focus.date)}
                    </p>
                    <p className="mt-1 text-sm text-teal-100">
                      {statuses[focusIdx] === 'now'
                        ? t.nowUntil(formatDate(focus.until))
                        : `${focus.label[lang] || focus.label.en} · ${t.inDays(daysTo(focus.date))}`}
                      {' · '}{t.countVaccines(focus.vaccines.filter((x) => !x.optional).length)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-lg font-semibold">{checkCount ? t.unticked(checkCount) : t.allDone}</p>
                )}
                {focus && checkCount > 0 && (
                  <p className="mt-3 pt-3 border-t border-teal-400/60 text-xs text-teal-50">⚠️ {t.unticked(checkCount)}</p>
                )}
              </div>

              <button type="button" onClick={onCalendar}
                className="mt-4 w-full py-3 rounded-xl border-2 border-teal-200 text-teal-700 font-semibold hover:bg-teal-50 transition">
                {t.addCal}
              </button>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={onShare} className="py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition">
                  {t.share}
                </button>
                <Link
                  to="/specialization/pediatrician"
                  onClick={() => trackEvent('find_doctor_click', { source: 'tool_vaccine', specialization: 'Pediatrician' })}
                  className="py-3 rounded-xl border-2 border-teal-600 text-teal-700 font-semibold text-center hover:bg-teal-50 transition"
                >
                  {t.doctor}
                </Link>
              </div>
            </div>

            {/* Timeline */}
            <div className="mt-4 bg-white rounded-2xl shadow-md p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-500">✓ {t.tickSaved}</p>
                {checkCount > 0 && (
                  <button type="button" onClick={tickAllPast} className="text-xs font-semibold text-teal-700 underline">
                    {t.tickAllPast}
                  </button>
                )}
              </div>
              <ol className="mt-4 relative border-l-2 border-gray-100 ml-3">
                {result.visits.map((x, i) => {
                  const s = statuses[i];
                  const label = x.label[lang] || x.label.en;
                  return (
                    <li key={x.key} className="mb-5 ml-6">
                      <span className={`absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${DOT[s]}`} aria-hidden="true">
                        {s === 'done' ? '✓' : s === 'check' ? '!' : ''}
                      </span>
                      <h2 className={`text-sm font-bold ${s === 'next' || s === 'now' ? 'text-teal-800' : 'text-gray-800'}`}>
                        {label} · {x.until ? t.from(formatDate(x.date)) : formatDate(x.date)}
                        {(s === 'next' || s === 'now') && (
                          <span className="ml-2 align-middle text-[10px] px-2 py-0.5 rounded-full bg-teal-600 text-white">{s === 'now' ? t.nowTag : t.nextTag}</span>
                        )}
                      </h2>
                      <div className={`mt-2 rounded-xl border p-3 ${BOX[s]}`}>
                        <ul className="grid gap-1.5">
                          {x.vaccines.map((vac) => (
                            <li key={vac.id}>
                              <label className="flex items-start gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ticked.has(vac.id)}
                                  onChange={() => toggle(vac.id)}
                                  className="mt-0.5 w-4 h-4 rounded accent-teal-600 flex-shrink-0"
                                />
                                <span>
                                  <span className={`font-medium ${ticked.has(vac.id) ? 'text-green-700' : 'text-gray-800'}`}>{vac.name}</span>
                                  <span className="text-xs text-gray-500"> · {vac.note[lang] || vac.note.en}</span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                        {s === 'check' && <p className="mt-2 text-xs text-amber-800">{t.checkNote}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-2 rounded-xl bg-gray-50 border border-gray-100 p-4">
                <h2 className="text-sm font-bold text-gray-800">{t.extrasTitle}</h2>
                <p className="mt-1 text-xs text-gray-600">{t.extrasText}</p>
                <p className="mt-2 text-sm text-teal-800">{PRIVATE_EXTRAS.join(' · ')}</p>
              </div>
            </div>
          </>
        )}

        {/* Safety note — always visible */}
        <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4">⚠️ {t.safety}</p>

        {/* Related reading */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <span className="w-1.5 h-5 rounded-full bg-teal-600" aria-hidden="true" />{t.readMore}
            </h2>
            <ul className="mt-3 grid gap-2">
              {related.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={lang === 'hi' ? `/blog/${a.slug}/hi` : `/blog/${a.slug}`}
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:border-teal-200 hover:shadow-sm transition"
                  >
                    <span className="text-2xl" aria-hidden="true">{a.image}</span>
                    <span className="text-sm font-medium text-gray-800">{lang === 'hi' ? (titlesHi[a.slug] || a.title) : a.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* About + FAQ */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <span className="w-1.5 h-5 rounded-full bg-teal-600" aria-hidden="true" />{t.howTitle}
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">{t.how}</p>

          <h2 className="mt-6 flex items-center gap-2 text-lg font-bold text-gray-800">
            <span className="w-1.5 h-5 rounded-full bg-teal-600" aria-hidden="true" />{t.faqTitle}
          </h2>
          <div className="mt-2 divide-y divide-gray-100">
            {t.faq.map((f) => (
              <details key={f.q} className="py-3 group">
                <summary className="cursor-pointer list-none flex justify-between gap-3 text-sm font-semibold text-gray-800">
                  {f.q}<span className="text-teal-600 group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
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

export default VaccinationSchedule;
