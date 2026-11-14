// The free tools, for the /tools hub page and its prerender. Plain JS so the
// build script can import it. Add new tools here.

export const TOOLS = [
  {
    id: 'sehat_kundli', path: '/tools/sehat-kundli', emoji: '🪔',
    cls: 'bg-orange-50 border-orange-200 text-orange-900',
    name: { en: 'Sehat Kundli (family health chart)', hi: 'Sehat Kundli' },
    desc: { en: 'Family history → which check-ups you need, from what age', hi: 'Parivaar ki history se: kaunse test, kis umar se' },
  },
  {
    id: 'due_date', path: '/tools/due-date-calculator', emoji: '🤰',
    cls: 'bg-pink-50 border-pink-200 text-pink-900',
    name: { en: 'Pregnancy due date', hi: 'Meri due date kab hai?' },
    desc: { en: 'Due date, pregnancy weeks and trimester', hi: 'Due date, kitne hafte aur kaun si timaahi' },
  },
  {
    id: 'ovulation', path: '/tools/ovulation-calculator', emoji: '🌷',
    cls: 'bg-violet-50 border-violet-200 text-violet-900',
    name: { en: 'Ovulation & period', hi: 'Ovulation kab hai?' },
    desc: { en: 'Fertile days and next period date', hi: 'Fertile days aur agla period' },
  },
  {
    id: 'report', path: '/tools/blood-report', emoji: '🧪',
    cls: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    name: { en: 'Report Samjhao', hi: 'Report Samjhao' },
    desc: { en: 'Understand your blood report (CBC, thyroid, sugar, vitamins)', hi: 'Blood report aasaan shabdon mein (CBC, thyroid, sugar)' },
  },
  {
    id: 'vaccines', path: '/tools/vaccination-schedule', emoji: '💉',
    cls: 'bg-teal-50 border-teal-200 text-teal-900',
    name: { en: 'Baby vaccination schedule', hi: 'Baby ko teeka kab lagega?' },
    desc: { en: 'Every vaccine with its exact date', hi: 'Har vaccine ki sahi date' },
  },
];

export const HUB_COPY = {
  en: {
    seoTitle: 'Free Health Tools — Sehat Kundli, Blood Report, Due Date, Ovulation & Baby Vaccines',
    seoDesc: 'Free, private health tools from ProMedicoz in English and Hindi: Sehat Kundli (family health chart), Report Samjhao (blood report explained), pregnancy due date calculator, ovulation & period calculator, and baby vaccination schedule. Everything you enter stays on your phone.',
    title: 'Free health tools',
    subtitle: 'Free · Hindi + English · Your details stay on your phone',
    privacy: 'All tools work right here on your phone. What you type or photograph is never sent to ProMedicoz and never shared with anyone.',
  },
  hi: {
    title: 'Free health tools',
    subtitle: 'Free · Hindi + English · Jaankari aapke phone par hi rehti hai',
    privacy: 'Saare tools yahin aapke phone par chalte hain. Aap jo type karte hain ya photo lete hain, woh ProMedicoz ko nahi bheja jaata aur kisi ke saath share nahi hota.',
  },
};
