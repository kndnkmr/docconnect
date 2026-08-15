// Eye / eye-slash icon for password show/hide toggles — a crisp SVG instead
// of an emoji (🙈/👁️), which renders inconsistently across Windows/Android/iOS
// and looks unprofessional. Matches the standard icon used by most login forms.
function PasswordToggleIcon({ visible, size = 20 }) {
  return visible ? (
    // Password is visible as text -> icon shows "eye-slash" (click to hide)
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9-4-10-8a12.5 12.5 0 0 1 3.16-4.94" />
      <path d="M9.9 4.24A10.6 10.6 0 0 1 12 4c5 0 9 4 10 8a12.5 12.5 0 0 1-1.67 3.06" />
      <path d="M1 1l22 22" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  ) : (
    // Password is masked -> icon shows "eye" (click to show)
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default PasswordToggleIcon;
