import { useState, useEffect } from 'react';
import { announcementAPI } from '../services/api';

// Shows active admin announcements for the logged-in user's role as dismissible
// banners. Dismissals are remembered per-browser via localStorage.
function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    announcementAPI.getMine()
      .then((res) => setAnnouncements(res.data.announcements || []))
      .catch(() => { /* silent */ });
  }, []);

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem('dismissedAnnouncements', JSON.stringify(next));
    } catch { /* ignore */ }
  };

  const visible = announcements.filter((a) => !dismissed.includes(a._id));
  if (visible.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {visible.map((a) => (
        <div
          key={a._id}
          className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">📢</span>
            <div>
              <p className="font-semibold text-blue-800">{a.title}</p>
              <p className="text-sm text-blue-700 whitespace-pre-line">{a.message}</p>
            </div>
          </div>
          <button
            onClick={() => dismiss(a._id)}
            className="text-blue-400 hover:text-blue-600 text-xl leading-none flex-shrink-0"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

export default AnnouncementBanner;
