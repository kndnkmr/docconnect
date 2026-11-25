import { useState } from 'react';

// A one-line row that opens to show its full card when tapped. Used on the
// doctor dashboard so promotion / setup cards don't push "Welcome" and the
// appointments off the screen. Starts closed; tap again to close.
const TONES = {
  green: 'bg-green-50 border-green-200 text-green-900 hover:bg-green-100',
  blue: 'bg-white border-primary-200 text-gray-800 hover:bg-primary-50',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100',
};

export default function CollapsibleCard({ icon, title, meta, tone = 'green', children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-left transition-colors ${TONES[tone] || TONES.green}`}
      >
        <span className="font-semibold text-sm min-w-0 truncate">
          <span aria-hidden="true">{icon}</span> {title}
        </span>
        <span className="flex items-center gap-2 flex-shrink-0 text-xs text-gray-500">
          {meta}
          <span aria-hidden="true" className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        </span>
      </button>
      {open && <div className="mt-2 [&>*]:!mb-0">{children}</div>}
    </div>
  );
}
