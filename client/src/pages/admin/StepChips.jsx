// Where the patient and the doctor are right now (from the server's steps).
const DOT = { ok: 'bg-green-500', wait: 'bg-yellow-400', bad: 'bg-red-500', idle: 'bg-gray-300' };
const TEXT = { ok: 'text-green-800', wait: 'text-gray-700', bad: 'text-red-700 font-semibold', idle: 'text-gray-500' };
function Line({ who, step }) {
  if (!step) return null;
  return (
    <div className="flex items-start gap-1.5 text-xs leading-snug">
      <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${DOT[step.tone] || DOT.idle}`} aria-hidden="true" />
      <span className="text-gray-400 flex-shrink-0 w-10">{who}</span>
      <span className={TEXT[step.tone] || TEXT.idle}>{step.label}</span>
    </div>
  );
}
export default function StepChips({ steps }) {
  if (!steps) return null;
  return (
    <div className="space-y-0.5 min-w-[200px]">
      <Line who="Patient" step={steps.patient} />
      <Line who="Doctor" step={steps.doctor} />
      {steps.flag === 'dispute' && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">⚠ DISPUTE</span>}
      {steps.flag === 'stuck' && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700">⏱ STUCK</span>}
    </div>
  );
}
