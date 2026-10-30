// ============================================
// PaymentBox — the patient's payment steps on an appointment card
// ============================================
// Every state has a way forward (see utils/paymentFlow.js + server
// controllers/paymentController.js):
//   pay     → one-tap UPI app button, QR (tap to enlarge), UPI ID copy,
//             then "upload screenshot", "type UPI reference", or "I've paid"
//   waiting → said "I've paid" without proof: add screenshot / UTR,
//             show QR again, or "I haven't paid yet"
//   proof   → screenshot/UTR sent: view, replace, remind doctor, WhatsApp support
//   paid    → small "Payment confirmed" badge
//
// The enlarged QR opens as an in-page overlay tied to the URL hash, so the
// phone's Back button closes the overlay instead of leaving the page (the
// old "Download QR" link opened the image on its own page, and Back from
// there is where patients got lost).

//
// Paying from the SAME phone that shows the QR (most patients) — you can't
// scan your own screen. So:
//   • The UPI ID is read from the doctor's QR image when they never typed
//     one (utils/upiQr.js), so "Pay with UPI app" works for every doctor
//     with a QR. We also show the account-holder name the UPI app will show
//     (often not the doctor's own name), so the patient isn't put off by it.
//   • "Save QR to gallery" → then Scan → Gallery in any UPI app.
//   • A doctor with only a UPI ID (no QR image) gets a QR made on the page,
//     with the fee filled in, for patients paying from a computer.

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { appointmentAPI, getUploadUrl } from '../services/api';
import { paymentStage, buildUpiLink, isMobileDevice, cleanUTR, reminderState, supportMessage } from '../utils/paymentFlow';
import { readUpiFromImage, isValidUpiId, sameUpi } from '../utils/upiQr';
import { useLang } from '../context/LangContext';

// Only needed for doctors with a UPI ID but no QR image.
const MadeQr = lazy(() => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })));
const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || '');

const SUPPORT_WHATSAPP = import.meta.env.VITE_WHATSAPP_NUMBER || '919997019900';

// Fixed UI text (patient-only component). Amounts, names, UPI IDs, UTRs and
// times are data and are passed in, never translated.
const TXT = {
  en: {
    paidBadge: '✓ Payment Confirmed',
    done: 'Done',
    wentWrong: 'Something went wrong. Please try again.',
    utrHelp: 'The UPI reference (UTR) is the 12-digit number shown in your UPI app after paying.',
    upiCopied: 'UPI ID copied',
    copyFailed: (id) => 'Could not copy. Please note it down: ' + id,
    chooseFile: 'Choose payment screenshot',
    uploading: 'Uploading…',
    utrPlaceholder: '12-digit UPI reference',
    utrAria: 'UPI reference number (UTR)',
    sending: 'Sending…',
    send: 'Send',
    noScreenshot: 'No screenshot? Type the 12-digit UPI reference (UTR) instead',
    payWithApp: (fee) => `📱 Pay Rs. ${fee} with UPI app`,
    opensApps: 'Opens GPay / PhonePe / Paytm with the amount filled in',
    payeeShows: 'Your UPI app will show the name:',
    payeeNote: "(the doctor's UPI account)",
    noAppTitle: "App didn't open, or paying from this phone? Use the QR:",
    saveQr: '⬇ Save QR to gallery',
    savingQr: 'Saving…',
    qrSaved: 'QR saved. Open your UPI app → Scan → 🖼 Gallery → pick it.',
    saveSteps: 'Then in your UPI app: Scan → 🖼 Gallery → pick the saved QR',
    scanWithPhone: 'On a computer? Scan this with your phone’s UPI app — the amount is filled in.',
    madeQrAlt: (fee) => `UPI QR code to pay Rs. ${fee}`,
    enlargeAria: 'Enlarge payment QR code',
    qrAlt: 'UPI QR code',
    tapEnlarge: '🔍 Tap QR to enlarge',
    copy: 'Copy',
    noDetails: "The doctor hasn't added payment details yet. Please ask them in Chat, or contact support below.",
    qrDialogAria: 'Payment QR code',
    closeQrAria: 'Close QR code',
    payTo: (fee, dr) => `Pay Rs. ${fee} to Dr. ${dr}`,
    longPress: 'On a phone? Long-press the QR to save it, then pick it from your UPI app\'s "scan from gallery".',
    doneBtn: 'Done',
    payTitle: (fee, dr) => `Pay Rs. ${fee || 'as discussed'} to Dr. ${dr}`,
    steps: 'Step 1: pay · Step 2: send the screenshot',
    paidUpload: "📎 I've paid: upload screenshot",
    claimOk: 'Doctor notified. You can still add a screenshot.',
    claim: "I've paid, just tell the doctor",
    waitingTitle: '⏳ Waiting for the doctor to confirm your payment',
    waitingHint: 'Adding a screenshot helps the doctor confirm faster.',
    addPaymentShot: '📎 Add payment screenshot',
    viewShotAria: 'View your payment screenshot',
    sentTitle: (isShot) => `✓ ${isShot ? 'Screenshot' : 'UPI reference'} sent to the doctor`,
    sentAt: (time) => `Sent ${time} · `,
    waitingConfirm: 'waiting for confirmation',
    upiRef: 'UPI ref:',
    view: 'View',
    replace: 'Replace',
    addShot: 'Add screenshot',
    hideQr: 'Hide QR',
    showQr: 'Show QR / pay again',
    notPaid: "↩ I haven't paid yet",
    remind: '🔔 Remind doctor',
    notified: 'The doctor has been notified.',
    remindAfter: (time) => ` You can send a reminder after ${time}.`,
    support: '💬 WhatsApp support',
  },
  hi: {
    paidBadge: '✓ पेमेंट कन्फ़र्म हो गया',
    done: 'हो गया',
    wentWrong: 'कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।',
    utrHelp: 'UPI reference (UTR) वह 12 अंकों का नंबर है जो पेमेंट के बाद आपके UPI app में दिखता है।',
    upiCopied: 'UPI ID कॉपी हो गई',
    copyFailed: (id) => 'कॉपी नहीं हो पाया। कृपया इसे लिख लें: ' + id,
    chooseFile: 'पेमेंट का स्क्रीनशॉट चुनें',
    uploading: 'अपलोड हो रहा है…',
    utrPlaceholder: '12 अंकों का UPI reference',
    utrAria: 'UPI reference नंबर (UTR)',
    sending: 'भेजा जा रहा है…',
    send: 'भेजें',
    noScreenshot: 'स्क्रीनशॉट नहीं है? उसकी जगह 12 अंकों का UPI reference (UTR) लिखें',
    payWithApp: (fee) => `📱 UPI app से Rs. ${fee} भेजें`,
    opensApps: 'GPay / PhonePe / Paytm खुलेगा, रकम पहले से भरी होगी',
    payeeShows: 'आपके UPI app में यह नाम दिखेगा:',
    payeeNote: '(डॉक्टर का UPI खाता)',
    noAppTitle: 'App नहीं खुला, या इसी फ़ोन से पेमेंट कर रहे हैं? QR से करें:',
    saveQr: '⬇ QR गैलरी में सेव करें',
    savingQr: 'सेव हो रहा है…',
    qrSaved: 'QR सेव हो गया। UPI app खोलें → Scan → 🖼 Gallery → QR चुनें।',
    saveSteps: 'फिर UPI app में: Scan → 🖼 Gallery → सेव किया QR चुनें',
    scanWithPhone: 'कंप्यूटर पर हैं? फ़ोन के UPI app से यह QR स्कैन करें — रकम पहले से भरी होगी।',
    madeQrAlt: (fee) => `Rs. ${fee} भेजने का UPI QR code`,
    enlargeAria: 'पेमेंट का QR code बड़ा करें',
    qrAlt: 'UPI QR code',
    tapEnlarge: '🔍 QR बड़ा करने के लिए दबाएँ',
    copy: 'कॉपी करें',
    noDetails: 'डॉक्टर ने अभी पेमेंट की जानकारी नहीं डाली है। कृपया Chat में उनसे पूछें, या नीचे support से बात करें।',
    qrDialogAria: 'पेमेंट का QR code',
    closeQrAria: 'QR code बंद करें',
    payTo: (fee, dr) => `Dr. ${dr} को Rs. ${fee} भेजें`,
    longPress: 'फ़ोन पर हैं? QR को दबाकर रखें और सेव करें, फिर अपने UPI app में "scan from gallery" से उसे चुनें।',
    doneBtn: 'ठीक है',
    payTitle: (fee, dr) => (fee ? `Dr. ${dr} को Rs. ${fee} भेजें` : `Dr. ${dr} को तय की गई फ़ीस भेजें`),
    steps: 'पहला: पेमेंट करें · दूसरा: स्क्रीनशॉट भेजें',
    paidUpload: '📎 पेमेंट कर दिया: स्क्रीनशॉट अपलोड करें',
    claimOk: 'डॉक्टर को बता दिया गया। आप अभी भी स्क्रीनशॉट जोड़ सकते हैं।',
    claim: 'पेमेंट कर दिया, बस डॉक्टर को बता दें',
    waitingTitle: '⏳ डॉक्टर के पेमेंट कन्फ़र्म करने का इंतज़ार है',
    waitingHint: 'स्क्रीनशॉट जोड़ने से डॉक्टर जल्दी कन्फ़र्म कर पाते हैं।',
    addPaymentShot: '📎 पेमेंट का स्क्रीनशॉट जोड़ें',
    viewShotAria: 'अपना पेमेंट स्क्रीनशॉट देखें',
    sentTitle: (isShot) => `✓ ${isShot ? 'स्क्रीनशॉट' : 'UPI reference'} डॉक्टर को भेज दिया गया`,
    sentAt: (time) => `${time} को भेजा · `,
    waitingConfirm: 'कन्फ़र्म होने का इंतज़ार है',
    upiRef: 'UPI ref:',
    view: 'देखें',
    replace: 'बदलें',
    addShot: 'स्क्रीनशॉट जोड़ें',
    hideQr: 'QR छुपाएँ',
    showQr: 'QR दिखाएँ / फिर से पेमेंट करें',
    notPaid: '↩ अभी पेमेंट नहीं किया',
    remind: '🔔 डॉक्टर को याद दिलाएँ',
    notified: 'डॉक्टर को बता दिया गया है।',
    remindAfter: (time) => ` ${time} के बाद आप फिर से याद दिला सकते हैं।`,
    support: '💬 WhatsApp पर मदद',
  },
};

const timeLabel = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '');

export default function PaymentBox({ apt, user, onChanged, onViewReceipt }) {
  const stage = paymentStage(apt);
  const location = useLocation();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [showUTR, setShowUTR] = useState(false);
  const [utr, setUtr] = useState('');
  const [showPayAgain, setShowPayAgain] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { lang } = useLang();
  const t = TXT[lang === 'hi' ? 'hi' : 'en'];

  // Re-check "Remind doctor" availability every minute while waiting.
  useEffect(() => {
    if (stage !== 'waiting' && stage !== 'proof') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, [stage]);

  // Read the doctor's QR (UPI ID + account name) while payment is open.
  const qrSrc = apt?.doctor?.upiQrCode ? getUploadUrl(apt.doctor.upiQrCode) : '';
  const [qrInfo, setQrInfo] = useState(null);
  const [savingQr, setSavingQr] = useState(false);
  useEffect(() => {
    if (!qrSrc || !['pay', 'waiting', 'proof'].includes(stage)) return undefined;
    let cancelled = false;
    readUpiFromImage(qrSrc).then((r) => { if (!cancelled) setQrInfo(r); });
    return () => { cancelled = true; };
  }, [qrSrc, stage]);

  if (!stage) return null;
  if (stage === 'paid') {
    return <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{t.paidBadge}</span>;
  }

  const doctor = apt.doctor || {};
  const fee = doctor.consultationFee;
  const qrHash = `#pay-qr-${apt._id}`;
  const qrOpen = location.hash === qrHash;
  const openQr = () => navigate(`${location.pathname}${location.search}${qrHash}`);
  // Go back if we opened it (so Back/Done behave the same); if the page was
  // loaded with the hash already in the URL, just drop the hash.
  const closeQr = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate(`${location.pathname}${location.search}`, { replace: true });
  };
  // The UPI ID to pay: what the doctor typed (their explicit choice), else
  // the one read from their QR.
  const typedUpi = isValidUpiId(doctor.upiId) ? String(doctor.upiId).trim() : '';
  const fromQr = qrInfo && qrInfo.kind === 'upi' ? qrInfo : null;
  const payUpi = typedUpi || (fromQr ? fromQr.upiId : '');
  // Name the UPI app will show — only when it's the same account we pay.
  const payeeName = fromQr && fromQr.name && sameUpi(fromQr.upiId, payUpi) ? fromQr.name : '';
  const linkFor = () => buildUpiLink({ upiId: payUpi, doctorName: doctor.name, amount: fee, patientId: user?.patientId, date: apt.date });
  const upiLink = isMobileDevice() && payUpi ? linkFor() : '';
  // No QR image but a UPI ID: we draw a QR (with the fee) for computer users.
  const madeQrValue = !doctor.upiQrCode && payUpi ? linkFor() : '';

  // Save the QR so the patient can pick it in Scan → Gallery. iPhone: share
  // sheet ("Save Image"). Others: a normal download (lands in the gallery /
  // Downloads). Never navigates away from this page.
  const saveQr = async () => {
    setSavingQr(true);
    try {
      // The original PNG/JPG (not the auto WebP/AVIF copy) — every UPI
      // app's gallery picker can read it.
      const original = /^(https?|data):/i.test(doctor.upiQrCode || '') ? doctor.upiQrCode : qrSrc;
      const blob = await (await fetch(original)).blob();
      const ext = /png/.test(blob.type) ? 'png' : 'jpg';
      const name = `ProMedicoz-pay-Dr-${String(doctor.name || 'doctor').replace(/[^\w]+/g, '-')}.${ext}`;
      const file = new File([blob], name, { type: blob.type || 'image/png' });
      if (isIOS() && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 10000);
      }
      toast.success(t.qrSaved, { duration: 6000 });
    } catch (e) {
      if (e && e.name === 'AbortError') return; // closed the share sheet
      openQr(); // fall back to the big QR + long-press tip
    } finally {
      setSavingQr(false);
    }
  };

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      const { data } = await fn();
      toast.success(okMsg || data?.message || t.done);
      onChanged && onChanged();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || t.wentWrong);
      return false;
    } finally {
      setBusy('');
    }
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    const data = new FormData();
    data.append('screenshot', file);
    await run('upload', () => appointmentAPI.uploadScreenshot(apt._id, data));
  };

  const sendUTR = async () => {
    const v = cleanUTR(utr);
    if (!v) {
      toast.error(t.utrHelp);
      return;
    }
    if (await run('utr', () => appointmentAPI.notifyPayment(apt._id, v))) {
      setShowUTR(false);
      setUtr('');
    }
  };

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(payUpi);
      toast.success(t.upiCopied);
    } catch {
      toast.error(t.copyFailed(payUpi));
    }
  };

  const remind = reminderState(apt, now);
  const supportUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(supportMessage({
    patientName: user?.name, patientId: user?.patientId, doctorName: doctor.name, date: apt.date, timeSlot: apt.timeSlot,
  }))}`;

  const hiddenFileInput = (
    <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} aria-label={t.chooseFile} />
  );

  const uploadButton = (label) => (
    <button
      type="button"
      onClick={() => fileRef.current && fileRef.current.click()}
      disabled={!!busy}
      className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
    >
      {busy === 'upload' ? t.uploading : label}
    </button>
  );

  const utrForm = showUTR ? (
    <div className="mt-2 flex gap-2">
      <input
        type="text" inputMode="numeric" autoComplete="off" maxLength={16}
        value={utr} onChange={(e) => setUtr(e.target.value)}
        placeholder={t.utrPlaceholder}
        aria-label={t.utrAria}
        className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
      <button type="button" onClick={sendUTR} disabled={!!busy} className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium disabled:opacity-60">
        {busy === 'utr' ? t.sending : t.send}
      </button>
    </div>
  ) : (
    <button type="button" onClick={() => setShowUTR(true)} className="mt-2 text-xs text-primary-600 hover:underline">
      {t.noScreenshot}
    </button>
  );

  // QR + UPI app + UPI ID. Used in "pay" and in "Show QR / pay again".
  const upiLine = payUpi && (
    <p className="text-xs text-gray-700 mt-2">UPI ID: <span className="font-mono font-medium text-gray-900 break-all">{payUpi}</span>{' '}
      <button type="button" onClick={copyUpi} className="text-primary-600 font-medium hover:underline">{t.copy}</button>
    </p>
  );
  const payDetails = (
    <div>
      {upiLink && (
        <>
          <a href={upiLink} className="block w-full text-center px-4 py-3 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
            {t.payWithApp(fee)}
          </a>
          <p className="text-[11px] text-gray-600 text-center mt-1">{t.opensApps}</p>
        </>
      )}
      {payeeName && (
        <div className="mt-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <p className="text-[11px] text-green-800">✓ {t.payeeShows}</p>
          <p className="text-sm font-bold text-green-900 break-words">{payeeName} <span className="text-[11px] font-normal text-green-800">{t.payeeNote}</span></p>
        </div>
      )}
      {doctor.upiQrCode ? (
        <>
          {upiLink && <p className="text-xs font-semibold text-gray-700 mt-3 mb-2">{t.noAppTitle}</p>}
          <div className={`flex items-start gap-3 ${upiLink ? '' : 'mt-1'}`}>
            <button type="button" onClick={openQr} className="flex-shrink-0 rounded-lg border border-orange-200 bg-white p-1" aria-label={t.enlargeAria}>
              <img src={qrSrc} alt={t.qrAlt} className="w-24 h-24 object-contain" />
            </button>
            <div className="min-w-0 flex-1 text-xs text-gray-600 leading-relaxed">
              {isMobileDevice() ? (
                <>
                  <button type="button" onClick={saveQr} disabled={savingQr} className="w-full px-3 py-2 rounded-lg border border-indigo-200 bg-white text-indigo-700 text-sm font-semibold hover:bg-indigo-50 disabled:opacity-60">
                    {savingQr ? t.savingQr : t.saveQr}
                  </button>
                  <p className="mt-1 text-[11px] text-gray-600">{t.saveSteps}</p>
                </>
              ) : (
                <button type="button" onClick={openQr} className="text-primary-600 font-medium hover:underline">{t.tapEnlarge}</button>
              )}
            </div>
          </div>
          {upiLine}
        </>
      ) : payUpi ? (
        <>
          {madeQrValue && !isMobileDevice() && (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-shrink-0 rounded-lg border border-orange-200 bg-white p-2">
                <Suspense fallback={<div className="w-24 h-24" />}>
                  <MadeQr value={madeQrValue} size={96} level="M" title={t.madeQrAlt(fee)} />
                </Suspense>
              </div>
              <p className="text-xs text-gray-600">{t.scanWithPhone}</p>
            </div>
          )}
          {upiLine}
        </>
      ) : (
        <p className="text-sm text-orange-800">{t.noDetails}</p>
      )}
    </div>
  );

  const qrOverlay = qrOpen && doctor.upiQrCode && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t.qrDialogAria}>
      <button type="button" className="absolute inset-0 bg-black/80" onClick={closeQr} aria-label={t.closeQrAria} />
      <div className="relative bg-white rounded-2xl p-4 max-w-sm w-full text-center">
        <p className="font-semibold text-gray-800">{t.payTo(fee, doctor.name)}</p>
        <img src={qrSrc} alt={t.qrAlt} className="w-full max-w-xs mx-auto my-3 rounded-lg border" />
        {payUpi && <p className="text-xs text-gray-600">UPI ID: <span className="font-mono">{payUpi}</span></p>}
        {payeeName && <p className="text-xs text-green-800 mt-0.5">{t.payeeShows} <strong>{payeeName}</strong></p>}
        <p className="text-[11px] text-gray-500 mt-1">{t.longPress}</p>
        <button type="button" onClick={closeQr} className="mt-3 w-full px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">{t.doneBtn}</button>
      </div>
    </div>
  );

  // ---- A: pay ----
  if (stage === 'pay') {
    return (
      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
        {hiddenFileInput}
        {qrOverlay}
        <p className="text-sm font-semibold text-orange-800">{t.payTitle(fee, doctor.name)}</p>
        <p className="text-[11px] text-orange-700 mb-3">{t.steps}</p>
        {payDetails}
        <div className="border-t border-dashed border-orange-200 my-3" />
        {uploadButton(t.paidUpload)}
        {utrForm}
        <div className="text-center mt-2">
          <button
            type="button" disabled={!!busy}
            onClick={() => run('claim', () => appointmentAPI.notifyPayment(apt._id), t.claimOk)}
            className="text-xs text-gray-600 underline hover:text-gray-800 disabled:opacity-60"
          >
            {busy === 'claim' ? t.sending : t.claim}
          </button>
        </div>
      </div>
    );
  }

  // ---- B / C: waiting for the doctor ----
  return (
    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
      {hiddenFileInput}
      {qrOverlay}
      {stage === 'waiting' ? (
        <>
          <p className="text-sm font-semibold text-yellow-900">{t.waitingTitle}</p>
          <p className="text-xs text-yellow-800 mt-0.5 mb-3">{t.waitingHint}</p>
          {uploadButton(t.addPaymentShot)}
          {utrForm}
        </>
      ) : (
        <div className="flex items-start gap-3">
          {apt.paymentScreenshot && (
            <button type="button" onClick={() => onViewReceipt && onViewReceipt(getUploadUrl(apt.paymentScreenshot))} className="flex-shrink-0" aria-label={t.viewShotAria}>
              <img src={getUploadUrl(apt.paymentScreenshot)} alt="" className="w-12 h-16 object-cover rounded border border-yellow-200 bg-white" />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-yellow-900">{t.sentTitle(!!apt.paymentScreenshot)}</p>
            <p className="text-xs text-yellow-800">
              {apt.paymentClaimedAt ? t.sentAt(timeLabel(apt.paymentClaimedAt)) : ''}{t.waitingConfirm}
            </p>
            {apt.paymentUTR && <p className="text-xs text-gray-600 mt-0.5">{t.upiRef} <span className="font-mono">{apt.paymentUTR}</span></p>}
            <div className="text-xs mt-1 space-x-3">
              {apt.paymentScreenshot && (
                <button type="button" onClick={() => onViewReceipt && onViewReceipt(getUploadUrl(apt.paymentScreenshot))} className="text-primary-600 hover:underline">{t.view}</button>
              )}
              <button type="button" onClick={() => fileRef.current && fileRef.current.click()} disabled={!!busy} className="text-primary-600 hover:underline">
                {busy === 'upload' ? t.uploading : apt.paymentScreenshot ? t.replace : t.addShot}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button type="button" onClick={() => setShowPayAgain((v) => !v)} className="flex-1 px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50">
          💳 {showPayAgain ? t.hideQr : t.showQr}
        </button>
        <button
          type="button" disabled={!!busy}
          onClick={() => run('undo', () => appointmentAPI.undoPaymentClaim(apt._id))}
          className="flex-1 px-2 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          {busy === 'undo' ? '…' : t.notPaid}
        </button>
      </div>
      {showPayAgain && <div className="mt-3 p-3 bg-white rounded-lg border border-orange-100">{payDetails}</div>}

      <div className="mt-3 pt-2 border-t border-dashed border-yellow-200 flex flex-wrap items-center gap-2">
        {remind.can ? (
          <button
            type="button" disabled={!!busy}
            onClick={() => run('remind', () => appointmentAPI.remindPayment(apt._id))}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            {busy === 'remind' ? t.sending : t.remind}
          </button>
        ) : (
          <span className="text-[11px] text-gray-500">
            {t.notified}{remind.at ? t.remindAfter(timeLabel(remind.at)) : ''}
          </span>
        )}
        <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs font-medium hover:bg-green-100">
          {t.support}
        </a>
      </div>
    </div>
  );
}
