// ============================================
// "Parivaar ki dawai" — today's medicines for the whole family
// ============================================
// Opens from the Prescriptions tab when the account has prescriptions booked
// for family members. Shows TODAY's medicines from all running prescriptions,
// by time of day and person, plus what's coming up (last course days, free
// follow-ups, advised tests). One reminder file for everyone, WhatsApp text
// for family, and print (big, for the fridge). Logic: utils/familyChart.js.
// Same data the account already sees — nothing new is fetched or shared.

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import LangToggle from '../../components/LangToggle';
import { trackEvent } from '../../components/Analytics';
import { istDay } from '../../utils/rxChart';
import { buildFamilyDay, buildFamilyIcs, familyDayText, personEmoji, isEmptyDay } from '../../utils/familyChart';
import { useLang } from '../../context/LangContext';

const TIMES_KEY = 'promedicoz_rx_times'; // shared with the single chart
const DEFAULT_TIMES = { morning: '08:00', afternoon: '14:00', evening: '18:00', night: '21:00' };
const SLOTS = ['morning', 'afternoon', 'evening', 'night'];
const SLOT_STYLE = {
  morning: 'bg-amber-50 border-amber-200 text-amber-900',
  afternoon: 'bg-sky-50 border-sky-200 text-sky-900',
  evening: 'bg-orange-50 border-orange-200 text-orange-900',
  night: 'bg-indigo-50 border-indigo-200 text-indigo-900',
};
const FOOD_STYLE = { before: 'text-red-700', empty: 'text-red-700', after: 'text-green-700' };

const T = {
  en: {
    title: "Family's medicines today",
    sub: (d) => `${d} · from all running prescriptions`,
    self: 'You',
    slot: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' },
    slotIcon: { morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' },
    onceName: '🕐 Once a day (at the time the doctor said)',
    weeklyName: '📅 Weekly dose today',
    timesName: '🔁 4 times a day',
    sosName: '🆘 Only when needed',
    checkName: '❓ Ask the doctor when to take',
    food: { before: 'before food', after: 'after food', empty: 'empty stomach' },
    nothingToday: 'No medicines today',
    allEmpty: 'Nobody has medicines to take today from running prescriptions.',
    comingUp: '📌 Coming up',
    endsToday: (n) => `${n}: last day today`,
    endsOn: (n, d) => `${n}: ends ${d}`,
    followUp: (d, doc) => `Free follow-up${doc ? ` with Dr. ${doc}` : ''} until ${d}`,
    tests: (t) => `Tests advised: ${t.join(', ')}`,
    dr: (d) => `Dr. ${d}`,
    remind: '⏰ Set reminders for everyone',
    remindDone: 'Calendar file downloaded — open it to add the reminders.',
    remindNone: 'No upcoming doses to remind about.',
    share: '💬 Send to family',
    print: '🖨️ Print for the fridge',
    close: 'Close',
    note: 'Made from prescriptions in ProMedicoz. If a doctor changed or stopped a medicine (here or elsewhere), follow the doctor. "Continue" medicines are shown only from prescriptions of the last 90 days.',
    reminder: (s) => `Medicines: ${s}`,
    shareTitle: (d) => `💊 Family medicines — ${d} (via ProMedicoz)`,
    shareFooter: 'Follow exactly as the doctors wrote. If unsure, ask the doctor.',
  },
  hi: {
    title: 'आज की दवाई — परिवार',
    sub: (d) => `${d} · सभी चल रहे पर्चों से`,
    self: 'आप',
    slot: { morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम', night: 'रात' },
    slotIcon: { morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' },
    onceName: '🕐 दिन में एक बार (डॉक्टर के बताए समय पर)',
    weeklyName: '📅 आज की हफ़्ते वाली खुराक',
    timesName: '🔁 दिन में 4 बार',
    sosName: '🆘 सिर्फ़ ज़रूरत पड़ने पर',
    checkName: '❓ समय डॉक्टर से पूछें',
    food: { before: 'खाने से पहले', after: 'खाने के बाद', empty: 'खाली पेट' },
    nothingToday: 'आज कोई दवा नहीं',
    allEmpty: 'चल रहे पर्चों के हिसाब से आज किसी को दवा नहीं लेनी है।',
    comingUp: '📌 आगे ध्यान रखें',
    endsToday: (n) => `${n}: आज आखिरी दिन`,
    endsOn: (n, d) => `${n}: ${d} को खत्म`,
    followUp: (d, doc) => `${doc ? `Dr. ${doc} से ` : ''}${d} तक फ़्री फ़ॉलो-अप`,
    tests: (t) => `डॉक्टर ने टेस्ट बताए: ${t.join(', ')}`,
    dr: (d) => `Dr. ${d}`,
    remind: '⏰ सबके रिमाइंडर एक साथ लगाएँ',
    remindDone: 'कैलेंडर फ़ाइल डाउनलोड हो गई — रिमाइंडर के लिए इसे खोलें।',
    remindNone: 'आगे की कोई खुराक बाकी नहीं है।',
    share: '💬 घरवालों को भेजें',
    print: '🖨️ फ्रिज पर लगाने के लिए प्रिंट',
    close: 'बंद करें',
    note: 'ProMedicoz के पर्चों से बना है। अगर डॉक्टर ने कोई दवा बदली या बंद की (यहाँ या कहीं और), तो डॉक्टर की बात मानें। "Continue" वाली दवाएँ सिर्फ़ पिछले 90 दिन के पर्चों से दिखाई जाती हैं।',
    reminder: (s) => `दवाई: ${s}`,
    shareTitle: (d) => `💊 परिवार की दवाई — ${d} (ProMedicoz)`,
    shareFooter: 'डॉक्टर ने जैसा लिखा है, वैसे ही लें। शक हो तो डॉक्टर से पूछें।',
  },
};

const fmtDay = (t) => new Date(t).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtShort = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const loadTimes = () => {
  try { return { ...DEFAULT_TIMES, ...JSON.parse(localStorage.getItem(TIMES_KEY) || '{}') }; } catch { return { ...DEFAULT_TIMES }; }
};

function Item({ it, multi, t }) {
  return (
    <li className="text-sm">
      <span className="font-semibold text-gray-900">{it.name}</span>
      {it.food && <span className={`ml-1.5 text-xs font-semibold ${FOOD_STYLE[it.food]}`}>· {t.food[it.food]}</span>}
      {multi && it.doctor && <span className="ml-1.5 text-[11px] text-gray-500">({t.dr(it.doctor)})</span>}
    </li>
  );
}

function PersonBlock({ p, list, t, familyMembers }) {
  const name = p.key === 'self' ? t.self : p.name;
  return (
    <div className="mt-2 first:mt-1">
      <p className="text-xs font-bold text-gray-700">{personEmoji(p.key === 'self' ? 'self' : p.name, familyMembers)} {name}</p>
      <ul className="ml-5 mt-0.5 space-y-0.5">{list.map((it) => <Item key={`${it.rxId}-${it.key}`} it={it} multi={p.multi} t={t} />)}</ul>
    </div>
  );
}

export default function FamilyMeds({ prescriptions, familyMembers = [], onClose }) {
  const appLang = useLang().lang;
  const [lang, setLang] = useState(appLang);
  const t = T[lang];
  const today = istDay(new Date());
  const day = useMemo(() => buildFamilyDay(prescriptions, today), [prescriptions, today]);
  const times = loadTimes();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const who = (name) => (name === 'self' ? t.self : name);

  const onRemind = () => {
    const ics = buildFamilyIcs(day, times, t, today);
    if (!ics.includes('BEGIN:VEVENT')) { toast(t.remindNone); return; }
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'promedicoz-family-medicines.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(t.remindDone);
    trackEvent('family_meds_reminders', { people: day.people.length });
  };
  const onShare = async () => {
    const text = familyDayText(day, t, fmtDay);
    trackEvent('family_meds_share', { method: navigator.share ? 'native' : 'whatsapp' });
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* dismissed */ } return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const onPrint = () => {
    document.body.classList.add('rx-printing');
    const done = () => { document.body.classList.remove('rx-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    trackEvent('family_meds_print', {});
    window.print();
    setTimeout(done, 1000);
  };

  const empty = isEmptyDay(day);
  const group = (key, title, cls = 'bg-gray-50 border-gray-200 text-gray-900') => {
    const rows = day.people.filter((p) => p[key].length);
    if (!rows.length) return null;
    return (
      <section key={key} className={`rounded-2xl border p-4 ${cls}`}>
        <h3 className="font-extrabold text-base">{title}</h3>
        {rows.map((p) => <PersonBlock key={p.key} p={p} list={p[key]} t={t} familyMembers={familyMembers} />)}
      </section>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="family-meds-title" onClick={onClose}>
      <div id="rx-chart-print" className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl overflow-y-auto max-h-full" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center gap-2 rx-noprint">
          <h2 id="family-meds-title" className="flex-1 font-extrabold text-gray-900 text-lg">{t.title}</h2>
          <LangToggle lang={lang} onChange={setLang} />
          <button type="button" onClick={onClose} aria-label={t.close} className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-4 grid gap-3">
          <div>
            <h2 className="hidden rx-printonly text-2xl font-extrabold">{t.title}</h2>
            <p className="text-sm text-gray-600">{t.sub(fmtDay(today))}</p>
          </div>

          {empty && <p className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700">{t.allEmpty}</p>}

          {SLOTS.map((s) => {
            const rows = day.people.filter((p) => p.slots[s].length);
            if (!rows.length) return null;
            return (
              <section key={s} className={`rounded-2xl border p-4 ${SLOT_STYLE[s]}`}>
                <h3 className="font-extrabold text-base">{t.slotIcon[s]} {t.slot[s]} <span className="font-semibold opacity-80 text-sm">· {fmt12(times[s])}</span></h3>
                {rows.map((p) => <PersonBlock key={p.key} p={p} list={p.slots[s]} t={t} familyMembers={familyMembers} />)}
              </section>
            );
          })}
          {group('once', t.onceName)}
          {group('weekly', t.weeklyName, 'bg-violet-50 border-violet-200 text-violet-900')}
          {group('times', t.timesName)}
          {group('sos', t.sosName)}
          {group('check', t.checkName, 'bg-red-50 border-red-200 text-red-900')}

          {day.comingUp.length > 0 && (
            <section className="rounded-2xl border border-gray-200 p-4">
              <h3 className="font-extrabold text-gray-900 text-base">{t.comingUp}</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-gray-800">
                {day.comingUp.map((c, i) => (
                  <li key={i}>
                    <span className="mr-1">{personEmoji(c.person, familyMembers)}</span>
                    <span className="font-semibold">{who(c.person)}:</span>{' '}
                    {c.kind === 'ends' ? (c.today ? t.endsToday(c.name) : t.endsOn(c.name, fmtShort(c.date)))
                      : c.kind === 'followUp' ? t.followUp(fmtShort(c.date), c.doctor)
                        : t.tests(c.tests)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-2 rx-noprint">
            <button type="button" onClick={onRemind} className="py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700">{t.remind}</button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onShare} className="py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700">{t.share}</button>
              <button type="button" onClick={onPrint} className="py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t.print}</button>
            </div>
          </div>
          <p className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-3 text-xs">⚠️ {t.note}</p>
        </div>
      </div>
    </div>
  );
}
