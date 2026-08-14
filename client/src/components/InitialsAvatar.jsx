// Gender-neutral fallback avatar: a colored circle with the doctor's initials.
// The color is derived from the name so it's consistent per doctor. Used when a
// doctor has no profile photo (avoids showing a wrong-gender emoji).

const PALETTE = [
  'bg-blue-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-rose-500',
  'bg-amber-500', 'bg-teal-500', 'bg-purple-500', 'bg-cyan-600'
];

function getInitials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'DR';
}

function getColor(name) {
  const sum = (name || 'D').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return PALETTE[sum % PALETTE.length];
}

// Props:
//   name       - doctor's name (for initials + color)
//   className  - size classes, e.g. "w-24 h-24" (default)
//   textClass  - text size, e.g. "text-3xl" (default)
function InitialsAvatar({ name, className = 'w-24 h-24', textClass = 'text-3xl' }) {
  return (
    <div
      className={`${className} ${getColor(name)} rounded-full flex items-center justify-center text-white ${textClass} font-semibold shadow-md`}
      aria-label={name || 'Doctor'}
    >
      {getInitials(name)}
    </div>
  );
}

export default InitialsAvatar;
