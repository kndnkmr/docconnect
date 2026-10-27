// ============================================
// Drafts — "pick up where you left off" (tested in tests/drafts.test.mjs)
// ============================================
// Form progress is kept on THIS device only (localStorage), never sent to
// the server. Each entry is per account, so a shared family phone keeps
// people's drafts apart, and every draft has a maximum age.
//
//   key:   pmz_draft:<userId or "guest">:<name>
//   value: { v: 1, savedAt: <ms>, data: {...} }
//
// Callers must never put passwords, consent ticks or payment details in
// `data`. Explicit logout deletes the account's drafts (see AuthContext);
// an expired login does NOT, so the work is still there after logging in.

const PREFIX = 'pmz_draft:';
export const HOUR = 60 * 60 * 1000;
export const DRAFT_TTL = {
  booking: 24 * HOUR,
  register: 2 * HOUR, // shared phones: a half-filled sign-up shouldn't linger
  rx: 7 * 24 * HOUR,
  profile: 7 * 24 * HOUR,
};

const store = () => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // private mode / blocked storage: drafts just don't persist
  }
};

const owner = (userId) => String(userId || 'guest');
export const draftKey = (name, userId) => `${PREFIX}${owner(userId)}:${name}`;

export function saveDraft(name, data, userId, now = Date.now()) {
  const s = store();
  if (!s) return;
  try {
    s.setItem(draftKey(name, userId), JSON.stringify({ v: 1, savedAt: now, data }));
  } catch {
    /* storage full — not worth breaking the form over */
  }
}

// Returns { data, savedAt } or null (missing, broken or too old; old ones are removed).
export function loadDraft(name, userId, maxAgeMs, now = Date.now()) {
  const s = store();
  if (!s) return null;
  const key = draftKey(name, userId);
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.data) throw new Error('bad');
    if (maxAgeMs && now - parsed.savedAt > maxAgeMs) {
      s.removeItem(key);
      return null;
    }
    return { data: parsed.data, savedAt: parsed.savedAt };
  } catch {
    s.removeItem(key);
    return null;
  }
}

export function clearDraft(name, userId) {
  const s = store();
  if (s) s.removeItem(draftKey(name, userId));
}

// All live drafts for an account whose name starts with `namePrefix`,
// newest first: [{ name, data, savedAt }]. Expired ones are removed.
export function listDrafts(userId, namePrefix, maxAgeMs, now = Date.now()) {
  const s = store();
  if (!s) return [];
  const base = `${PREFIX}${owner(userId)}:`;
  const names = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k.startsWith(base + namePrefix)) names.push(k.slice(base.length));
  }
  return names
    .map((name) => ({ name, ...(loadDraft(name, userId, maxAgeMs, now) || {}) }))
    .filter((d) => d.data)
    .sort((a, b) => b.savedAt - a.savedAt);
}

// Logout: forget everything this account left on the device.
export function clearAllDrafts(userId) {
  const s = store();
  if (!s) return;
  const base = `${PREFIX}${owner(userId)}:`;
  const doomed = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k.startsWith(base)) doomed.push(k);
  }
  doomed.forEach((k) => s.removeItem(k));
}

// "10 min ago", "3h ago", "2 days ago"
export function savedAgo(savedAt, now = Date.now()) {
  const min = Math.max(0, Math.round((now - savedAt) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
