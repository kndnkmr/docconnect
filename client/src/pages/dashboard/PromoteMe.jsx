// ============================================
// Promote Me — the doctor's own "grow my practice" toolkit
// ============================================
// A doctor-only dashboard tab that turns their public profile into an owned,
// shareable asset. It gives them:
//   1. Their personal booking link (vanity /dr/:slug) + copy + native share
//   2. A QR code of that link they can download (PNG) for their reception desk
//   3. A printable A5 "clinic card" poster (PDF, with the QR) to put on paper
//   4. One-tap share to WhatsApp / Instagram (copy) / Google / SMS
//   5. A live "this month" stats strip (page views, bookings-from-link,
//      earnings collected, rating) so the payoff of sharing is visible — this
//      is the hook that makes the app worth opening daily.
//
// Everything here reads the doctor's OWN data (doctorAPI.getMyStats) — nothing
// is invented. If stats fail to load, the toolkit still works; the strip just
// hides. The QR uses qrcode.react (already a dependency); the PDF uses jsPDF
// (lazy-loaded, same as the prescription PDF) so it never bloats other pages.

import { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { doctorAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// Public site origin — the links a doctor shares must point at the real
// production site, not localhost/preview, regardless of where the dashboard
// is open. (The in-app routing uses relative paths; shared links need absolute.)
const SITE_ORIGIN = 'https://www.promedicoz.in';

// Compact money format for the stats strip: 24000 -> "Rs. 24k", 900 -> "Rs. 900".
function formatMoney(n) {
  const v = Number(n) || 0;
  if (v >= 100000) return `Rs. ${(v / 100000).toFixed(v >= 1000000 ? 0 : 1)}L`;
  if (v >= 1000) return `Rs. ${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `Rs. ${v}`;
}

function PromoteMe() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  // Hidden canvas used only to rasterize the QR to a PNG for download + PDF.
  const qrRef = useRef(null);

  // The doctor's vanity handle. Comes from the user record, with the stats
  // response as a fallback (both are populated server-side). If somehow absent
  // we fall back to the id-based profile so the toolkit is never empty.
  const slug = user?.slug || stats?.slug || null;
  const bookingUrl = slug
    ? `${SITE_ORIGIN}/dr/${slug}`
    : `${SITE_ORIGIN}/doctors/${user?._id || ''}`;
  const prettyUrl = bookingUrl.replace(/^https?:\/\/(www\.)?/, '');

  // A ready-to-send invite in the doctor's own voice (same framing as the
  // dashboard banner: "consult me online", not "join a platform").
  const shareMsg =
    `Hello, this is Dr. ${user?.name || ''}. You can now book an appointment with me online on ProMedicoz — ` +
    `video, phone, or in-person. Book here: ${bookingUrl}`;

  useEffect(() => {
    let cancelled = false;
    doctorAPI.getMyStats()
      .then(({ data }) => { if (!cancelled && data?.stats) setStats(data.stats); })
      .catch(() => { /* stats are a nice-to-have — never block the toolkit */ });
    return () => { cancelled = true; };
  }, []);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      window.prompt('Copy this:', text);
    }
  };

  // Native share sheet where supported (mobile), falling back to copying the
  // link. Reuses the Web Share API pattern already used for prescriptions.
  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Dr. ${user?.name}`, text: shareMsg, url: bookingUrl });
        return;
      } catch { /* user dismissed — fall through to copy */ }
    }
    copy(shareMsg, 'Invite message copied — paste it to any patient!');
  };

  // Turn the hidden QR <canvas> into a PNG and trigger a download.
  const downloadQrPng = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) { toast.error('QR not ready yet — try again in a moment.'); return; }
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `promedicoz-${slug || 'clinic'}-qr.png`;
    link.click();
  };

  // Build and download an A5 printable "clinic card" poster (PDF) with the
  // doctor's name, specialty, city, the QR, and the booking URL — for the
  // reception desk / notice board. jsPDF is loaded lazily so it never weighs
  // down the rest of the app.
  const downloadPoster = async () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) { toast.error('QR not ready yet — try again in a moment.'); return; }
    try {
      const { jsPDF } = await import('jspdf');
      // A5 portrait, points. Centered, clinic-friendly layout.
      const doc = new jsPDF({ unit: 'pt', format: 'a5' });
      const W = doc.internal.pageSize.getWidth();

      // Header band
      doc.setFillColor(29, 78, 216); // primary-700
      doc.rect(0, 0, W, 70, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text(`Dr. ${user?.name || ''}`, W / 2, 34, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const sub = [user?.specialization, user?.city].filter(Boolean).join('  ·  ');
      if (sub) doc.text(sub, W / 2, 54, { align: 'center' });

      // Prompt
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('Book an appointment online', W / 2, 110, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Scan this code with your phone camera', W / 2, 130, { align: 'center' });

      // QR (from the hidden canvas)
      const qrData = canvas.toDataURL('image/png');
      const qrSize = 190;
      doc.addImage(qrData, 'PNG', (W - qrSize) / 2, 150, qrSize, qrSize);

      // URL + brand footer
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(29, 78, 216);
      doc.text(prettyUrl, W / 2, 150 + qrSize + 28, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text('Powered by ProMedicoz · Pay the doctor directly, no commission', W / 2, 150 + qrSize + 48, { align: 'center' });

      doc.save(`promedicoz-${slug || 'clinic'}-poster.pdf`);
    } catch (e) {
      console.error('Poster PDF error:', e);
      toast.error('Could not generate the poster. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-gradient-to-br from-primary-700 to-primary-900 text-white rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" aria-hidden="true" />
        <h2 className="text-xl font-bold flex items-center gap-2 relative z-10">📣 Promote your practice</h2>
        <p className="text-primary-100 text-sm mt-1 relative z-10 max-w-xl">
          This is your own booking page. Share it anywhere — every patient you already see can book,
          pay, and review you here, and stay your patient wherever they move.
        </p>
      </div>

      {/* Your link */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Your personal booking link</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-semibold text-gray-800 truncate">
            {prettyUrl}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => copy(bookingUrl, 'Link copied!')}
              className="px-4 py-3 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-sm font-semibold hover:bg-primary-100 transition-colors"
            >
              📋 Copy
            </button>
            <button
              onClick={nativeShare}
              className="px-4 py-3 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Share 📤
            </button>
          </div>
        </div>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-sm text-primary-600 hover:underline"
        >
          👁️ Preview my page →
        </a>
      </div>

      {/* Three asset cards: QR, printable poster, share channels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* QR */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col items-center text-center">
          <h3 className="font-bold text-gray-800 mb-3">QR code</h3>
          <div ref={qrRef} className="bg-white p-3 rounded-lg border border-gray-100">
            {/* Canvas renderer so we can export a PNG + embed in the PDF. */}
            <QRCodeCanvas value={bookingUrl} size={150} level="M" includeMargin />
          </div>
          <button
            onClick={downloadQrPng}
            className="mt-4 w-full px-4 py-2.5 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-sm font-semibold hover:bg-primary-100 transition-colors"
          >
            ⬇ Download PNG
          </button>
          <p className="text-xs text-gray-500 mt-2">Print it for your reception desk.</p>
        </div>

        {/* Printable poster */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col items-center text-center">
          <h3 className="font-bold text-gray-800 mb-3">Printable clinic card</h3>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-28 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-primary-700 text-white text-[10px] font-bold py-2">Dr. {user?.name?.split(' ')[0] || ''}</div>
              <div className="py-3 text-3xl">👩‍⚕️</div>
              <div className="pb-3 px-1 text-[9px] text-gray-500">Scan to book</div>
            </div>
          </div>
          <button
            onClick={downloadPoster}
            className="mt-4 w-full px-4 py-2.5 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-sm font-semibold hover:bg-primary-100 transition-colors"
          >
            ⬇ Download poster (PDF)
          </button>
          <p className="text-xs text-gray-500 mt-2">An A5 poster with your QR.</p>
        </div>

        {/* Share channels */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-bold text-gray-800 mb-3 text-center">Share in one tap</h3>
          <div className="space-y-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareMsg)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2.5 rounded-lg bg-green-50 text-green-700 text-sm font-semibold hover:bg-green-100 transition-colors"
            >
              💬 WhatsApp status / chat
            </a>
            <button
              onClick={() => copy(bookingUrl, 'Link copied — paste it in your Instagram bio!')}
              className="block w-full text-left px-4 py-2.5 rounded-lg bg-pink-50 text-pink-700 text-sm font-semibold hover:bg-pink-100 transition-colors"
            >
              📸 Copy for Instagram bio
            </button>
            <button
              onClick={() => copy(bookingUrl, 'Link copied — add it to your Google Business profile!')}
              className="block w-full text-left px-4 py-2.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors"
            >
              🔵 Copy for Google Business
            </button>
            <a
              href={`sms:?&body=${encodeURIComponent(shareMsg)}`}
              className="block px-4 py-2.5 rounded-lg bg-gray-50 text-gray-700 text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              ✉️ SMS to a patient
            </a>
          </div>
        </div>
      </div>

      {/* Live stats strip — the "why share" payoff, from the doctor's own data.
          Hidden entirely until stats load so we never flash zeros/placeholders. */}
      {stats && (
        <div className="bg-gray-900 text-white rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-300 mb-4">This month on your page</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-3xl font-extrabold">{stats.pageViews}</div>
              <div className="text-gray-400 text-xs mt-1">page views</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold">{stats.linkBookings}</div>
              <div className="text-gray-400 text-xs mt-1">bookings from link</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-green-400">{formatMoney(stats.earningsThisMonth)}</div>
              <div className="text-gray-400 text-xs mt-1">collected this month</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-amber-400">
                {stats.rating.count > 0 ? `${stats.rating.average}★` : '—'}
              </div>
              <div className="text-gray-400 text-xs mt-1">
                {stats.rating.count > 0 ? `rating · ${stats.rating.count} review${stats.rating.count > 1 ? 's' : ''}` : 'no reviews yet'}
              </div>
            </div>
          </div>
          {/* Secondary row: consultation + patient loyalty numbers. */}
          <div className="grid grid-cols-3 gap-4 text-center mt-5 pt-5 border-t border-white/10">
            <div>
              <div className="text-xl font-bold">{stats.consultationsThisMonth}</div>
              <div className="text-gray-400 text-xs mt-1">consultations this month</div>
            </div>
            <div>
              <div className="text-xl font-bold">{stats.uniquePatients}</div>
              <div className="text-gray-400 text-xs mt-1">patients seen</div>
            </div>
            <div>
              <div className="text-xl font-bold">{stats.repeatPatients}</div>
              <div className="text-gray-400 text-xs mt-1">came back</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PromoteMe;
