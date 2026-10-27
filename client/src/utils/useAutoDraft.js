// ============================================
// useAutoDraft — keep a form's progress on the device as the user types
// ============================================
// Saves `data` under `name` ~0.8s after the last change (only when `enabled`
// and `isEmpty(data)` is false, so an untouched form never leaves a draft).
// Also saves right away when the page is hidden (switching to WhatsApp /
// UPI app, locking the phone), so nothing typed in the last second is lost.

import { useEffect, useRef } from 'react';
import { saveDraft } from './drafts';

export default function useAutoDraft(name, data, { userId, enabled = true, isEmpty = () => false, delay = 800 } = {}) {
  const latest = useRef({ name, data, userId, enabled, isEmpty });
  latest.current = { name, data, userId, enabled, isEmpty };
  const serialized = JSON.stringify(data);

  useEffect(() => {
    if (!enabled || !name || isEmpty(data)) return undefined;
    const t = setTimeout(() => saveDraft(name, data, userId), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, name, userId, enabled]);

  useEffect(() => {
    const flush = () => {
      const l = latest.current;
      if (document.visibilityState === 'hidden' && l.enabled && l.name && !l.isEmpty(l.data)) {
        saveDraft(l.name, l.data, l.userId);
      }
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, []);
}
