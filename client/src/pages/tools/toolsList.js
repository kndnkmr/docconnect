// The free tools, for the /tools hub page and its prerender. Plain JS so the
// build script can import it. Add new tools here.

export const TOOLS = [
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
    seoTitle: 'Free Health Tools — Blood Report, Due Date, Ovulation & Baby Vaccine Calculators',
    seoDesc: 'Free, private health tools from ProMedicoz in English and Hindi: Report Samjhao (blood report explained), pregnancy due date calculator, ovulation & period calculator, and baby vaccination schedule. Nothing is stored.',
    title: 'Free health tools',
    subtitle: 'Private · Hindi + English · nothing is saved',
    privacy: 'All tools run on your phone. Nothing is stored or sent.',
  },
  hi: {
    title: 'Free health tools',
    subtitle: 'Private · Hindi + English · kuch bhi save nahi hota',
    privacy: 'Saare tools aapke phone par chalte hain. Kuch bhi save ya send nahi hota.',
  },
};
