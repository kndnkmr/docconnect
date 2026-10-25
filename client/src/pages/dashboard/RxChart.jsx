// ============================================
// Daily medicine chart (patient) — "Roz ki dawai ka chart"
// ============================================
// Opens from a prescription card in PatientPrescriptions. Shows the doctor's
// prescription grouped by time of day, with food timing, course end dates and
// the free follow-up window. Reminders (.ics, built on the phone), a WhatsApp
// text for family, and a large-print / print view. Reading rules live in
// utils/rxChart.js — nothing is guessed and the doctor's own words are always
// one tap away. No AI, no server call, nothing new stored (reminder times are
// remembered in this browser only).

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import LangToggle from '../../components/LangToggle';
import { trackEvent } from '../../components/Analytics';
import { buildChart, buildIcs, chartText, istDay } from '../../utils/rxChart';

const TIMES_KEY = 'promedicoz_rx_times';
const DEFAULT_TIMES = { morning: '08:00', afternoon: '14:00', evening: '18:00', night: '21:00' };
const DAY = 86400000;

const T = {
  en: {
    title: 'Daily medicine chart',
    by: (d, date) => `Dr. ${d} · ${date}`,
    todayDay: (n) => `Today: day ${n}`,
    slot: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' },
    slotIcon: { morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' },
    onceName: '🕐 Once a day',
    onceNote: 'Take at the time your doctor told you.',
    weeklyName: '📅 Once a week',
    weeklyDay: (d) => `every ${d}`,
    timesName: '🔁 4 times a day',
    timesNote: 'Space them through the day as your doctor told you.',
    sosName: '🆘 Only when needed',
    checkName: '❓ Check with your doctor',
    checkNote: 'We couldn’t read when to take these. Please follow the doctor’s words below, or ask your doctor or chemist.',
    food: { before: 'before food', after: 'after food', empty: 'empty stomach' },
    amountUnknown: 'Amount: as your doctor told you',
    doctorWords: 'Doctor wrote',
    courseTitle: 'How long to take',
    till: (d) => `till ${d}`,
    dayOf: (n, total) => `day ${n} of ${total}`,
    ongoing: 'continue until your doctor says',
    noEnd: 'duration not written — ask your doctor',
    finished: 'course finished',
    followUp: (d) => `🩺 Free follow-up with your doctor until ${d}`,
    timesTitle: 'Reminder times',
    remind: '⏰ Set daily reminders',
    remindDone: 'Calendar file downloaded — open it to add the reminders.',
    remindNone: 'No upcoming doses to remind about.',
    shareFamily: '💬 Send to family',
    large: '🔠 Large text',
    print: '🖨️ Print',
    close: 'Close',
    safety: 'This chart is made from what your doctor wrote. If anything is unclear, ask your doctor or show the prescription to your chemist. Don’t change or stop a medicine without asking your doctor.',
    reminder: (s) => `Medicines: ${s}`,
    shareTitle: (d) => `💊 Medicine chart (Dr. ${d}) — via ProMedicoz`,
    shareFooter: 'Follow exactly as the doctor wrote. If unsure, ask the doctor.',
    nothing: 'This prescription has no medicines.',
  },
  hi: {
    title: 'रोज़ की दवाई का चार्ट',
    by: (d, date) => `Dr. ${d} · ${date}`,
    todayDay: (n) => `आज: दिन ${n}`,
    slot: { morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम', night: 'रात' },
    slotIcon: { morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' },
    onceName: '🕐 दिन में एक बार',
    onceNote: 'डॉक्टर ने जिस समय बताया, उसी समय लें।',
    weeklyName: '📅 हफ़्ते में एक बार',
    weeklyDay: (d) => `हर ${d}`,
    timesName: '🔁 दिन में 4 बार',
    timesNote: 'डॉक्टर ने जैसे बताया, दिन भर में बाँट कर लें।',
    sosName: '🆘 सिर्फ़ ज़रूरत पड़ने पर',
    checkName: '❓ डॉक्टर से पूछें',
    checkNote: 'इन दवाओं का समय हम पढ़ नहीं पाए। नीचे डॉक्टर के शब्दों के अनुसार लें, या डॉक्टर या केमिस्ट से पूछें।',
    food: { before: 'खाने से पहले', after: 'खाने के बाद', empty: 'खाली पेट' },
    amountUnknown: 'मात्रा: डॉक्टर ने जैसा बताया',
    doctorWords: 'डॉक्टर ने लिखा',
    courseTitle: 'कब तक लेनी है',
    till: (d) => `${d} तक`,
    dayOf: (n, total) => `दिन ${n}/${total}`,
    ongoing: 'डॉक्टर के कहने तक जारी रखें',
    noEnd: 'कितने दिन, यह नहीं लिखा — डॉक्टर से पूछें',
    finished: 'कोर्स पूरा',
    followUp: (d) => `🩺 ${d} तक डॉक्टर से फ़्री फ़ॉलो-अप`,
    timesTitle: 'रिमाइंडर का समय',
    remind: '⏰ रोज़ का रिमाइंडर लगाएँ',
    remindDone: 'कैलेंडर फ़ाइल डाउनलोड हो गई — रिमाइंडर के लिए इसे खोलें।',
    remindNone: 'आगे की कोई खुराक बाकी नहीं है।',
    shareFamily: '💬 घरवालों को भेजें',
    large: '🔠 बड़े अक्षर',
    print: '🖨️ प्रिंट',
    close: 'बंद करें',
    safety: 'यह चार्ट डॉक्टर के लिखे से बना है। कुछ समझ न आए तो डॉक्टर से पूछें या केमिस्ट को पर्चा दिखाएँ। डॉक्टर से पूछे बिना कोई दवा न बदलें, न बंद करें।',
    reminder: (s) => `दवाई: ${s}`,
    shareTitle: (d) => `💊 दवाई का चार्ट (Dr. ${d}) — ProMedicoz`,
    shareFooter: 'डॉक्टर ने जैसा लिखा है, वैसे ही लें। शक हो तो डॉक्टर से पूछें।',
    nothing: 'इस पर्चे में कोई दवा नहीं है।',
  },
};
const WEEKDAYS = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
};
const SLOT_STYLE = {
  morning: 'bg-amber-50 border-amber-200 text-amber-900',
  afternoon: 'bg-sky-50 border-sky-200 text-sky-900',
  evening: 'bg-orange-50 border-orange-200 text-orange-900',
  night: 'bg-indigo-50 border-indigo-200 text-indigo-900',
};
const FOOD_STYLE = { before: 'bg-red-100 text-red-700', empty: 'bg-red-100 text-red-700', after: 'bg-green-100 text-green-700' };

const fmtDay = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

function loadTimes() {
  try { return { ...DEFAULT_TIMES, ...JSON.parse(localStorage.getItem(TIMES_KEY) || '{}') }; } catch { return { ...DEFAULT_TIMES }; }
}

function MedRow({ it, slot, t, large }) {
  const [open, setOpen] = useState(false);
  const count = slot ? it.freq?.counts?.[slot] : null;
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full text-left">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`font-bold text-gray-900 ${large ? 'text-xl' : 'text-sm'}`}>
            {it.name}{it.dose ? ` ${it.dose}` : ''}{count ? ` · ${count === 0.5 ? '½' : count}` : ''}
          </span>
          {it.food && <span className={`px-2 py-0.5 rounded-full font-bold ${large ? 'text-sm' : 'text-[11px]'} ${FOOD_STYLE[it.food]}`}>{t.food[it.food]}</span>}
          <span className="text-gray-400 text-xs" aria-hidden="true">{open ? '▴' : '▾'}</span>
        </span>
        {/^syp|^syr|syrup|drops|^susp|suspension/i.test(it.name) && !it.dose && (
          <span className={`block text-gray-500 ${large ? 'text-base' : 'text-[11px]'}`}>{t.amountUnknown}</span>
        )}
      </button>
      {open && (
        <p className={`mt-1 rounded-lg bg-white/70 border border-gray-200 px-2 py-1 text-gray-700 ${large ? 'text-base' : 'text-xs'}`}>
          <span className="font-semibold">{t.doctorWords}:</span> {it.original}
        </p>
      )}
    </li>
  );
}

// One group of medicines (a time slot, "once a day", "when needed"…).
function Box({ title, note, list, cls = 'bg-gray-50 border-gray-200 text-gray-900', slot, extra, t, large }) {
  return (
    <section className={`rounded-2xl border p-4 ${cls}`}>
      <h3 className={`font-extrabold ${large ? 'text-xl' : 'text-base'}`}>{title}{extra && <span className="ml-2 font-semibold opacity-80 text-sm">{extra}</span>}</h3>
      {note && <p className={`mt-0.5 opacity-80 ${large ? 'text-base' : 'text-xs'}`}>{note}</p>}
      <ul className="mt-2 divide-y divide-black/5">
        {list.map((it) => <MedRow key={`${slot || title}-${it.key}`} it={it} slot={slot} t={t} large={large} />)}
      </ul>
    </section>
  );
}

function RxChart({ rx, onClose }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('promedicoz_lang') === 'hi' ? 'hi' : 'en'; } catch { return 'en'; }
  });
  const t = T[lang];
  const [large, setLarge] = useState(false);
  const [times, setTimes] = useState(loadTimes);
  const today = istDay(new Date());
  const chart = useMemo(() => buildChart(rx, today), [rx, today]);
  const doctor = rx.doctor?.name || '';

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const setTime = (slot, v) => {
    const next = { ...times, [slot]: v || DEFAULT_TIMES[slot] };
    setTimes(next);
    try { localStorage.setItem(TIMES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const labels = t; // rxChart.js reads slot/food/till/… labels from the same dictionary

  const onRemind = () => {
    const ics = buildIcs(chart, times, labels, today);
    if (!ics.includes('BEGIN:VEVENT')) { toast(t.remindNone); return; }
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'promedicoz-medicine-reminders.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(t.remindDone);
    trackEvent('rx_chart_reminders', {});
  };

  // The patient chooses to send their own chart to family (text only).
  const onShare = async () => {
    const text = chartText(chart, doctor, labels, fmtDay);
    trackEvent('rx_chart_share', { method: navigator.share ? 'native' : 'whatsapp' });
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* dismissed */ }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const onPrint = () => {
    document.body.classList.add('rx-printing');
    const done = () => { document.body.classList.remove('rx-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    trackEvent('rx_chart_print', {});
    window.print();
    setTimeout(done, 1000);
  };

  const live = (list) => list.filter((it) => !it.finished);
  const slotsWithMeds = ['morning', 'afternoon', 'evening', 'night'].filter((s) => live(chart.groups[s]).length);
  const dayNo = Math.floor((today - chart.start) / DAY) + 1;
  const txt = large ? 'text-base' : 'text-sm';
  const head = large ? 'text-xl' : 'text-base';

  const boxProps = { t, large };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="rx-chart-title" onClick={onClose}>
      <div id="rx-chart-print" className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl overflow-y-auto max-h-full" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center gap-2 rx-noprint">
          <h2 id="rx-chart-title" className="flex-1 font-extrabold text-gray-900 text-lg">{t.title}</h2>
          <LangToggle lang={lang} onChange={setLang} />
          <button type="button" onClick={onClose} aria-label={t.close} className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-4 grid gap-3">
          <div>
            <h2 className="hidden rx-printonly text-2xl font-extrabold">{t.title}</h2>
            <p className={`text-gray-600 ${txt}`}>{t.by(doctor, fmtDay(chart.start))}{dayNo >= 1 ? ` · ${t.todayDay(dayNo)}` : ''}</p>
          </div>

          {chart.items.length === 0 && <p className="text-gray-600">{t.nothing}</p>}

          {slotsWithMeds.map((s) => (
            <Box {...boxProps} key={s} slot={s} cls={SLOT_STYLE[s]} list={live(chart.groups[s])}
              title={`${t.slotIcon[s]} ${t.slot[s]}`} extra={`· ${fmt12(times[s])}`} />
          ))}
          {live(chart.groups.once).length > 0 && <Box {...boxProps} title={t.onceName} note={t.onceNote} list={live(chart.groups.once)} />}
          {live(chart.groups.weekly).length > 0 && (
            <Box {...boxProps} title={t.weeklyName} extra={`(${t.weeklyDay(WEEKDAYS[lang][chart.weekday])})`} list={live(chart.groups.weekly)} cls="bg-violet-50 border-violet-200 text-violet-900" />
          )}
          {live(chart.groups.times).length > 0 && <Box {...boxProps} title={t.timesName} note={t.timesNote} list={live(chart.groups.times)} />}
          {live(chart.groups.sos).length > 0 && <Box {...boxProps} title={t.sosName} list={live(chart.groups.sos)} />}
          {chart.groups.check.length > 0 && (
            <Box {...boxProps} title={t.checkName} note={t.checkNote} list={chart.groups.check} cls="bg-red-50 border-red-200 text-red-900" />
          )}

          {/* Course tracker */}
          {chart.items.some((it) => it.freq && it.freq.kind !== 'sos') && (
            <section className="rounded-2xl border border-gray-200 p-4">
              <h3 className={`font-extrabold text-gray-900 ${head}`}>{t.courseTitle}</h3>
              <ul className="mt-2 grid gap-2.5">
                {chart.items.filter((it) => it.freq && it.freq.kind !== 'sos').map((it) => {
                  const pct = it.dayNo && it.days ? Math.round((it.dayNo / it.days) * 100) : 0;
                  return (
                    <li key={it.key}>
                      <div className={`flex justify-between gap-2 ${txt}`}>
                        <span className="text-gray-800 font-medium">{it.name}</span>
                        <span className={`text-right font-semibold ${it.finished ? 'text-gray-400' : 'text-primary-700'}`}>
                          {it.finished ? t.finished
                            : it.ongoing ? t.ongoing
                              : it.lastDay ? `${t.till(fmtDay(it.lastDay))}${it.dayNo ? ` · ${t.dayOf(it.dayNo, it.days)}` : ''}`
                                : t.noEnd}
                        </span>
                      </div>
                      {it.dayNo && !it.finished && (
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                          <div className="h-full bg-primary-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {chart.followUpUntil && chart.followUpUntil >= today && (
            <p className={`rounded-xl bg-primary-50 border border-primary-200 text-primary-800 font-semibold p-3 ${txt}`}>{t.followUp(fmtDay(chart.followUpUntil))}</p>
          )}

          {/* Reminder times + actions */}
          {slotsWithMeds.length > 0 && (
            <section className="rounded-2xl border border-gray-200 p-4 rx-noprint">
              <h3 className="font-bold text-gray-900 text-sm">{t.timesTitle}</h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {slotsWithMeds.map((s) => (
                  <label key={s} className="text-xs text-gray-600">
                    {t.slotIcon[s]} {t.slot[s]}
                    <input type="time" value={times[s]} onChange={(e) => setTime(s, e.target.value)}
                      className="mt-1 w-full px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900" />
                  </label>
                ))}
              </div>
            </section>
          )}
          <div className="grid gap-2 rx-noprint">
            <button type="button" onClick={onRemind} className="py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700">{t.remind}</button>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={onShare} className="py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700">{t.shareFamily}</button>
              <button type="button" onClick={() => setLarge((v) => !v)} aria-pressed={large}
                className={`py-2.5 rounded-xl border text-sm font-semibold ${large ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{t.large}</button>
              <button type="button" onClick={onPrint} className="py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t.print}</button>
            </div>
          </div>

          <p className={`rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-3 ${large ? 'text-base' : 'text-xs'}`}>⚠️ {t.safety}</p>
        </div>
      </div>
    </div>
  );
}

export default RxChart;
