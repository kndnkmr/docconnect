// ============================================
// Sehat Kundli — family health chart → your own check-up plan
// ============================================
// Free, private tool: tick which relatives have common conditions, add your
// age and woman/man, and see which check-ups you need and from what age
// (earlier where family history calls for it). Medical guidance, NOT
// astrology. Nothing is sent anywhere: worked out on the phone.
//
// Sharing (the growth idea):
//   • "Share my Kundli picture" — a PNG drawn on the phone (kundliCard.js).
//   • "Send to brothers & sisters" — a link whose family list sits after "#"
//     (never sent to any server), so siblings open it already filled in and
//     only add their own age.
//
// Routes: /tools/sehat-kundli (English) and /tools/sehat-kundli/hi (Hindi).
// Rules, copy and tests: ./kundliRules.js, tests/kundliRules.test.mjs.

import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import SEO from '../../components/SEO';
import LangToggle from '../../components/LangToggle';
import { trackEvent } from '../../components/Analytics';
import { articleMeta } from '../blog/blogMeta';
import { titlesHi } from '../blog/titlesHi';
import {
  TOOL_PATH, MIN_AGE, MAX_AGE, RELATIVES, CONDITIONS, COPY, RELATED_ARTICLES,
  buildKundli, encodeFamily, decodeFamily, familyIsEmpty,
} from './kundliRules';

const SITE = 'https://www.promedicoz.in';

function Item({ it, lang, t, showAge }) {
  return (
    <li className={`rounded-xl border p-3 ${it.family ? 'bg-rose-50 border-rose-200' : 'bg-white border-gray-100'}`}>
      <div className="flex items-start gap-3">
        {showAge && (
          <span className={`flex-shrink-0 min-w-[3.25rem] text-center rounded-lg px-2 py-1 text-xs font-bold ${it.family ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {t.fromAge(it.startAge)}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {it.title[lang] || it.title.en}
            {it.family && <span className="ml-2 align-middle text-[10px] px-2 py-0.5 rounded-full bg-rose-600 text-white">{t.famTag}</span>}
          </p>
          {it.every && <p className="text-xs text-gray-600 mt-0.5">{it.every[lang] || it.every.en}</p>}
          {it.why && <p className="text-xs text-rose-700 mt-0.5">{it.why[lang] || it.why.en}</p>}
        </div>
      </div>
    </li>
  );
}

function SehatKundli({ defaultLang }) {
  const [lang, setLang] = useState(() => {
    if (defaultLang) return defaultLang;
    try {
      const saved = localStorage.getItem('promedicoz_lang');
      if (saved === 'en' || saved === 'hi') return saved;
    } catch { /* ignore */ }
    return 'en';
  });
  const t = COPY[lang] || COPY.en;
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [family, setFamily] = useState({ young: {} });
  const [prefilled, setPrefilled] = useState(false);
  const [result, setResult] = useState(null);
  const [sharing, setSharing] = useState(false);
  const resultRef = useRef(null);

  // Opened from a brother/sister's link: family list is in the URL hash.
  useEffect(() => {
    const m = /[#&]f=([^&]*)/.exec(window.location.hash || '');
    if (!m) return;
    const fam = decodeFamily(decodeURIComponent(m[1]));
    if (!familyIsEmpty(fam)) {
      setFamily(fam);
      setPrefilled(true);
      trackEvent('tool_kundli_open_shared', {}); // no health details to analytics
    }
  }, []);

  const toggle = (cond, rel) => setFamily((f) => {
    const list = Array.isArray(f[cond]) ? f[cond] : [];
    const next = list.includes(rel) ? list.filter((r) => r !== rel) : [...list, rel];
    return { ...f, [cond]: next };
  });
  const setYoung = (cond, on) => setFamily((f) => ({ ...f, young: { ...(f.young || {}), [cond]: on } }));

  const onSubmit = (e) => {
    e.preventDefault();
    const k = buildKundli({ age: Number(age), sex, family });
    setResult(k);
    if (!k.error) {
      trackEvent('tool_kundli_create', { from_link: prefilled ? 'yes' : 'no' });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  };
  const ok = result && !result.error;
  const errText = result?.error === 'age' ? t.errAge : result?.error === 'sex' ? t.errSex : '';
  const toolUrl = `${SITE}${lang === 'hi' ? `${TOOL_PATH}/hi` : TOOL_PATH}`;

  const sharePicture = async () => {
    if (!ok || sharing) return;
    setSharing(true);
    try {
      const { drawKundliCard } = await import('./kundliCard');
      const blob = await drawKundliCard(result, lang, toolUrl);
      const file = new File([blob], 'sehat-kundli.png', { type: 'image/png' });
      const text = t.shareToolMsg(toolUrl);
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        trackEvent('tool_kundli_share_image', { method: 'native' });
        try { await navigator.share({ files: [file], text }); } catch { /* dismissed */ }
      } else {
        trackEvent('tool_kundli_share_image', { method: 'download' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'sehat-kundli.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success(lang === 'hi' ? 'Photo download ho gayi. Ise WhatsApp par bhejein.' : 'Picture downloaded. Send it on WhatsApp.');
      }
    } catch {
      toast.error(lang === 'hi' ? 'Photo nahi ban paayi. Dobara koshish karein.' : 'Could not make the picture. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const shareFamily = async () => {
    const enc = encodeFamily(family);
    const url = enc ? `${toolUrl}#f=${encodeURIComponent(enc)}` : toolUrl;
    const msg = enc ? t.shareFamilyMsg(url) : t.shareToolMsg(url);
    trackEvent('tool_kundli_share_family', { method: navigator.share ? 'native' : 'whatsapp' });
    if (navigator.share) {
      try { await navigator.share({ text: msg }); } catch { /* dismissed */ }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const startOver = () => {
    setResult(null); setAge(''); setSex(''); setFamily({ young: {} }); setPrefilled(false);
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const related = useMemo(() => RELATED_ARTICLES.map((slug) => articleMeta.find((a) => a.slug === slug)).filter(Boolean), []);
  const isHindiRoute = defaultLang === 'hi';
  const condLabel = (key) => { const c = CONDITIONS.find((x) => x.key === key); return c ? (c.label[lang] || c.label.en) : key; };
  const firstDegree = (key) => (family[key] || []).some((r) => r !== 'grand');

  return (
    <div className="flex-grow bg-orange-50/40">
      <SEO
        title={isHindiRoute ? COPY.hi.seoTitle : COPY.en.seoTitle}
        description={isHindiRoute ? COPY.hi.seoDesc : COPY.en.seoDesc}
        path={isHindiRoute ? `${TOOL_PATH}/hi` : TOOL_PATH}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-rose-600 to-red-800 text-white">
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        {/* Decorative kundli diamond */}
        <svg className="hidden sm:block pointer-events-none absolute right-6 top-16 w-28 h-28 opacity-25" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="4" y="4" width="92" height="92" fill="none" stroke="#fff" strokeWidth="3" />
          <path d="M50 4 L96 50 L50 96 L4 50 Z M4 4 L96 96 M96 4 L4 96" fill="none" stroke="#fff" strokeWidth="3" />
        </svg>
        <div className="relative container mx-auto px-4 pt-8 pb-16 max-w-2xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-orange-100 text-xs font-medium">{t.kicker}</p>
            <LangToggle lang={lang} onChange={setLang} />
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold">{t.title}</h1>
          <p className="mt-1 text-orange-50 text-sm sm:text-base max-w-md">{t.subtitle}</p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-2xl -mt-10 pb-12 relative">
        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-md p-5 sm:p-6">
          {prefilled && (
            <p className="mb-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">👨‍👩‍👧 {t.prefilled}</p>
          )}

          <h2 className="text-sm font-bold text-gray-800">{t.aboutYou}</h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sk-age" className="block text-xs font-semibold text-gray-600">{t.ageLabel}</label>
              <input id="sk-age" type="number" inputMode="numeric" min={MIN_AGE} max={MAX_AGE} value={age}
                onChange={(e) => { setAge(e.target.value); setResult(null); }}
                className="mt-1 w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-400 focus:bg-white outline-none" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-gray-600">{t.sexLabel}</span>
              <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.sexLabel}>
                {[['f', t.woman], ['m', t.man]].map(([v, label]) => (
                  <button key={v} type="button" role="radio" aria-checked={sex === v} onClick={() => { setSex(v); setResult(null); }}
                    className={`py-3 rounded-xl border text-sm font-semibold transition ${sex === v ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-rose-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <h2 className="mt-6 text-sm font-bold text-gray-800">{t.familyTitle}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t.familyHint}</p>
          <ul className="mt-3 grid gap-3">
            {CONDITIONS.map((c) => {
              const picked = family[c.key] || [];
              return (
                <li key={c.key} className={`rounded-xl border p-3 ${picked.length ? 'border-rose-200 bg-rose-50/50' : 'border-gray-100'}`}>
                  <p className="text-sm font-semibold text-gray-800"><span aria-hidden="true">{c.emoji}</span> {c.label[lang] || c.label.en}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={c.label[lang] || c.label.en}>
                    {RELATIVES.map((r) => {
                      const on = picked.includes(r.key);
                      return (
                        <button key={r.key} type="button" aria-pressed={on} onClick={() => { toggle(c.key, r.key); setResult(null); }}
                          className={`px-3 py-1.5 rounded-full text-xs border transition ${on ? 'bg-rose-600 border-rose-600 text-white font-semibold' : 'bg-white border-gray-300 text-gray-700 hover:border-rose-300'}`}>
                          {on ? '✓ ' : ''}{r.label[lang] || r.label.en}
                        </button>
                      );
                    })}
                  </div>
                  {c.young && firstDegree(c.key) && (
                    <label className="mt-2 flex items-start gap-2 text-xs text-gray-700">
                      <input type="checkbox" className="mt-0.5 accent-rose-600" checked={Boolean(family.young && family.young[c.key])}
                        onChange={(e) => { setYoung(c.key, e.target.checked); setResult(null); }} />
                      <span>{c.young[lang] || c.young.en}</span>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>

          <button type="submit" className="mt-5 w-full py-3.5 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 active:scale-[0.99] transition">
            {t.make}
          </button>
          <p className="mt-3 text-xs text-gray-600 text-center leading-relaxed">🔒 {t.privacy}</p>
        </form>

        <div aria-live="polite">
          {errText && <p className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-4">{errText}</p>}
        </div>

        {ok && (
          <div ref={resultRef} className="mt-4 bg-white rounded-2xl shadow-md p-5 sm:p-6 scroll-mt-20">
            <div className="rounded-2xl bg-gradient-to-br from-orange-500 via-rose-600 to-red-800 text-white p-5">
              <p className="text-xs text-orange-100">ProMedicoz · {t.picNote}</p>
              <h2 className="mt-1 text-2xl font-extrabold">{t.resultTitle(result.age)}</h2>
              <p className="mt-1 text-sm text-orange-50">{t.familyCount(result.familyItems)}</p>
              {result.familyConditions.length > 0 && (
                <p className="mt-3 pt-3 border-t border-white/30 text-sm">
                  {result.familyConditions.map((k) => `${CONDITIONS.find((c) => c.key === k).emoji} ${condLabel(k)}`).join('  ·  ')}
                </p>
              )}
            </div>

            <h3 className="mt-5 text-sm font-bold text-gray-800">✅ {t.dueTitle}</h3>
            <ul className="mt-2 grid gap-2">{result.due.map((it) => <Item key={it.id} it={it} lang={lang} t={t} />)}</ul>

            {result.later.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-bold text-gray-800">🗓️ {t.laterTitle}</h3>
                <ul className="mt-2 grid gap-2">{result.later.map((it) => <Item key={it.id} it={it} lang={lang} t={t} showAge />)}</ul>
              </>
            )}

            {result.moments.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-bold text-gray-800">⭐ {t.momentsTitle}</h3>
                <ul className="mt-2 grid gap-2">{result.moments.map((it) => <Item key={it.id} it={it} lang={lang} t={t} />)}</ul>
              </>
            )}

            {result.secondOnly.length > 0 && (
              <p className="mt-4 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-3">{t.secondOnly(result.secondOnly.map(condLabel).join(', '))}</p>
            )}
            <p className="mt-3 text-xs text-green-800 bg-green-50 border border-green-100 rounded-xl p-3">🏥 {t.free}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={sharePicture} disabled={sharing}
                className="py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60 transition">
                {sharing ? '…' : t.sharePic}
              </button>
              <button type="button" onClick={shareFamily}
                className="py-3 rounded-xl border-2 border-green-600 text-green-700 font-semibold hover:bg-green-50 transition">
                {t.shareFamily}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500 text-center">{t.sharePicNote}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link to="/specialization/general-physician"
                onClick={() => trackEvent('find_doctor_click', { source: 'tool_kundli', specialization: 'General Physician' })}
                className="py-3 rounded-xl border-2 border-rose-600 text-rose-700 font-semibold text-center hover:bg-rose-50 transition">
                {t.discussGp}
              </Link>
              {result.doctors.includes('gynae') && (
                <Link to="/specialization/gynaecologist"
                  onClick={() => trackEvent('find_doctor_click', { source: 'tool_kundli', specialization: 'Gynaecologist' })}
                  className="py-3 rounded-xl border-2 border-rose-600 text-rose-700 font-semibold text-center hover:bg-rose-50 transition">
                  {t.discussGynae}
                </Link>
              )}
            </div>
            <button type="button" onClick={startOver} className="mt-4 w-full text-sm text-gray-500 underline">{t.startOver}</button>
          </div>
        )}

        <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4">⚠️ {t.safety}</p>

        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <span className="w-1.5 h-5 rounded-full bg-rose-600" aria-hidden="true" />{t.readMore}
            </h2>
            <ul className="mt-3 grid gap-2">
              {related.map((a) => (
                <li key={a.slug}>
                  <Link to={lang === 'hi' ? `/blog/${a.slug}/hi` : `/blog/${a.slug}`}
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:border-rose-200 hover:shadow-sm transition">
                    <span className="text-2xl" aria-hidden="true">{a.image}</span>
                    <span className="text-sm font-medium text-gray-800">{lang === 'hi' ? (titlesHi[a.slug] || a.title) : a.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <span className="w-1.5 h-5 rounded-full bg-rose-600" aria-hidden="true" />{t.howTitle}
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">{t.how}</p>
          <h2 className="mt-6 flex items-center gap-2 text-lg font-bold text-gray-800">
            <span className="w-1.5 h-5 rounded-full bg-rose-600" aria-hidden="true" />{t.faqTitle}
          </h2>
          <div className="mt-2 divide-y divide-gray-100">
            {t.faq.map((f) => (
              <details key={f.q} className="py-3 group">
                <summary className="cursor-pointer list-none flex justify-between gap-3 text-sm font-semibold text-gray-800">
                  {f.q}<span className="text-rose-600 group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
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

export default SehatKundli;
