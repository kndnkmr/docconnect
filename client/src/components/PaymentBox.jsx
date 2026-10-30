// ============================================
// PaymentBox — the patient's payment steps on an appointment card
// ============================================
// Every state has a way forward (see utils/paymentFlow.js + server
// controllers/paymentController.js):
//   pay     → Step 1: scan the QR (save it if paying from this phone).
//             Step 2: one "I've paid" button, then (only then) screenshot /
//             skip / UPI reference number. Kept simple on purpose.
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
//   • "Save QR" → then Scan → Gallery in any UPI app.
//   • No tap-to-pay upi:// button: GPay/PhonePe often block it for
//     personal UPI IDs ("suspicious"). Scanning a QR is accepted.
//   • The UPI ID + account-holder name are read from the doctor's QR
//     (utils/upiQr.js), so we can show "Pays: <name>" (often not the
//     doctor's own name) and a copyable UPI ID.
//   • A doctor with only a UPI ID (no QR image) gets a QR drawn on the
//     page with the fee filled in, so step 1 always has a QR.

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
    upiCopied: 'UPI ID copied',
    copyFailed: (id) => 'Could not copy. Please note it down: ' + id,
    chooseFile: 'Choose payment screenshot',
    uploading: 'Uploading…',
    sending: 'Sending…',
    send: 'Send',
    // ---- Step 1: scan the QR (the reliable way) ----
    payTitle: (fee, dr) => `Pay Rs. ${fee || 'as discussed'} to Dr. ${dr}`,
    step1: 'Scan this QR in GPay / PhonePe / Paytm',
    payee: (name) => `Pays: ${name}`,
    payeeNote: "(the doctor's UPI account)",
    saveQr: 'Paying from this phone? ⬇ Save QR',
    savingQr: 'Saving…',
    qrSaved: 'QR saved. Open your UPI app → Scan → 🖼 Gallery → pick it.',
    tapEnlarge: '🔍 Tap to enlarge',
    copyUpiLine: 'Or pay to UPI ID',
    copy: 'Copy',
    madeQrAlt: (fee) => `UPI QR code to pay Rs. ${fee}`,
    scanOnComputer: "Scan with your phone's UPI app. The amount is already filled in.",
    noDetails: "The doctor hasn't added payment details yet. Please ask them in Chat, or contact support below.",
    // enlarge overlay
    qrAlt: 'UPI QR code',
    enlargeAria: 'Enlarge payment QR code',
    qrDialogAria: 'Payment QR code',
    closeQrAria: 'Close QR code',
    payTo: (fee, dr) => `Pay Rs. ${fee} to Dr. ${dr}`,
    longPress: 'Long-press the QR to save it, then pick it in your UPI app\'s "scan from gallery".',
    doneBtn: 'Done',
    // ---- Step 2: tell the doctor ----
    step2: "Tell the doctor you've paid",
    paid: "✅ I've paid",
    paidSub: 'The doctor confirms it and your slot is locked.',
    // proof sheet (opens after "I've paid")
    proofTitle: 'Add your payment screenshot',
    proofSub: 'It helps the doctor confirm faster. Optional.',
    chooseShot: '📎 Choose screenshot',
    skipProof: 'Skip — just tell the doctor',
    claimOk: 'Doctor notified. You can still add a screenshot.',
    noScreenshot: 'No screenshot? Type the UPI reference number',
    utrPlaceholder: 'e.g. 302912345678',
    utrAria: 'UPI reference number',
    utrHelp: 'Find it in your UPI app\'s history: tap the payment → "UPI transaction ID" or "Ref no." It\'s also in your bank\'s SMS. It is 12 digits.',
    // ---- waiting / proof ----
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
    upiCopied: 'UPI ID कॉपी हो गई',
    copyFailed: (id) => 'कॉपी नहीं हो पाया। कृपया इसे लिख लें: ' + id,
    chooseFile: 'पेमेंट का स्क्रीनशॉट चुनें',
    uploading: 'अपलोड हो रहा है…',
    sending: 'भेजा जा रहा है…',
    send: 'भेजें',
    // ---- पहला कदम: QR स्कैन करें ----
    payTitle: (fee, dr) => (fee ? `Dr. ${dr} को Rs. ${fee} भेजें` : `Dr. ${dr} को तय की गई फ़ीस भेजें`),
    step1: 'GPay / PhonePe / Paytm में यह QR स्कैन करें',
    payee: (name) => `पैसे जाएँगे: ${name}`,
    payeeNote: '(डॉक्टर का UPI खाता)',
    saveQr: 'इसी फ़ोन से पेमेंट? ⬇ QR सेव करें',
    savingQr: 'सेव हो रहा है…',
    qrSaved: 'QR सेव हो गया। UPI app खोलें → Scan → 🖼 Gallery → QR चुनें।',
    tapEnlarge: '🔍 बड़ा करने के लिए दबाएँ',
    copyUpiLine: 'या इस UPI ID पर भेजें',
    copy: 'कॉपी करें',
    madeQrAlt: (fee) => `Rs. ${fee} भेजने का UPI QR code`,
    scanOnComputer: 'फ़ोन के UPI app से स्कैन करें। रकम पहले से भरी होगी।',
    noDetails: 'डॉक्टर ने अभी पेमेंट की जानकारी नहीं डाली है। कृपया Chat में उनसे पूछें, या नीचे support से बात करें।',
    qrAlt: 'UPI QR code',
    enlargeAria: 'पेमेंट का QR code बड़ा करें',
    qrDialogAria: 'पेमेंट का QR code',
    closeQrAria: 'QR code बंद करें',
    payTo: (fee, dr) => `Dr. ${dr} को Rs. ${fee} भेजें`,
    longPress: 'QR को दबाकर रखें और सेव करें, फिर अपने UPI app में "scan from gallery" से उसे चुनें।',
    doneBtn: 'ठीक है',
    // ---- दूसरा कदम: डॉक्टर को बताएँ ----
    step2: 'डॉक्टर को बताएँ कि आपने पेमेंट कर दिया',
    paid: '✅ पेमेंट कर दिया',
    paidSub: 'डॉक्टर कन्फ़र्म करेंगे और आपका स्लॉट पक्का हो जाएगा।',
    proofTitle: 'पेमेंट का स्क्रीनशॉट जोड़ें',
    proofSub: 'इससे डॉक्टर जल्दी कन्फ़र्म कर पाते हैं। ज़रूरी नहीं।',
    chooseShot: '📎 स्क्रीनशॉट चुनें',
    skipProof: 'छोड़ें — बस डॉक्टर को बता दें',
    claimOk: 'डॉक्टर को बता दिया गया। आप अभी भी स्क्रीनशॉट जोड़ सकते हैं।',
    noScreenshot: 'स्क्रीनशॉट नहीं है? UPI reference नंबर लिखें',
    utrPlaceholder: 'जैसे 302912345678',
    utrAria: 'UPI reference नंबर',
    utrHelp: 'यह आपके UPI app की history में मिलेगा: पेमेंट पर दबाएँ → "UPI transaction ID" या "Ref no."। बैंक के SMS में भी होता है। यह 12 अंकों का होता है।',
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
  const [showProof, setShowProof] = useState(false); // step 2 sheet after "I've paid"
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
  // No QR image but a UPI ID: we draw a QR (with the fee + patient ID note)
  // so step 1 always has something to scan. (We no longer show a tap-to-pay
  // upi:// button: GPay/PhonePe often block it for personal UPI IDs, and a
  // button that fails is the most confusing thing a patient can hit.)
  const madeQrValue = !doctor.upiQrCode && payUpi
    ? buildUpiLink({ upiId: payUpi, doctorName: doctor.name, amount: fee, patientId: user?.patientId, date: apt.date })
    : '';
  const onPhone = isMobileDevice();

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
    <div className="mt-2">
      <div className="flex gap-2">
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
      <p className="mt-1 text-[11px] text-gray-600 leading-relaxed">{t.utrHelp}</p>
    </div>
  ) : (
    <button type="button" onClick={() => setShowUTR(true)} className="mt-2 text-xs text-primary-600 hover:underline">
      {t.noScreenshot}
    </button>
  );

  // Step 1: the QR to scan (the way that always works). Also used by
  // "Show QR / pay again" while waiting. The doctor's own QR image loads
  // exactly as before (qrSrc = getUploadUrl(doctor.upiQrCode)).
  const hasQr = !!doctor.upiQrCode || !!madeQrValue;
  const payDetails = !hasQr && !payUpi ? (
    <p className="text-sm text-orange-800">{t.noDetails}</p>
  ) : (
    <div className="text-center">
      {doctor.upiQrCode ? (
        <button type="button" onClick={openQr} className="mx-auto block rounded-xl border border-green-200 bg-white p-2" aria-label={t.enlargeAria}>
          <img src={qrSrc} alt={t.qrAlt} className="w-44 h-44 object-contain" />
        </button>
      ) : madeQrValue ? (
        <div className="mx-auto inline-block rounded-xl border border-green-200 bg-white p-3">
          <Suspense fallback={<div className="w-44 h-44" />}>
            <MadeQr value={madeQrValue} size={168} level="M" title={t.madeQrAlt(fee)} />
          </Suspense>
        </div>
      ) : null}
      {payeeName && (
        <p className="mt-2 text-sm text-green-900">
          <strong className="break-words">{t.payee(payeeName)}</strong>{' '}
          <span className="text-[11px] text-green-800">{t.payeeNote}</span>
        </p>
      )}
      {/* Paying from the same phone: you can't scan your own screen. */}
      {onPhone && doctor.upiQrCode && (
        <button type="button" onClick={saveQr} disabled={savingQr} className="mt-3 w-full px-3 py-2.5 rounded-lg border border-green-300 bg-white text-green-800 text-sm font-semibold hover:bg-green-50 disabled:opacity-60">
          {savingQr ? t.savingQr : t.saveQr}
        </button>
      )}
      {!onPhone && hasQr && (
        <p className="mt-2 text-xs text-green-800">
          {t.scanOnComputer}{doctor.upiQrCode && <> · <button type="button" onClick={openQr} className="text-primary-600 font-medium hover:underline">{t.tapEnlarge}</button></>}
        </p>
      )}
      {payUpi && (
        <p className="mt-2 text-[11px] text-gray-600">
          {t.copyUpiLine} <span className="font-mono text-gray-800 break-all">{payUpi}</span>{' '}
          <button type="button" onClick={copyUpi} className="text-primary-600 font-medium hover:underline">{t.copy}</button>
        </p>
      )}
    </div>
  );

  // Step number badge.
  const stepBadge = (n, color) => (
    <span className={`flex-shrink-0 w-6 h-6 rounded-full ${color} text-white text-xs font-bold flex items-center justify-center`}>{n}</span>
  );

  const qrOverlay = qrOpen && doctor.upiQrCode && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t.qrDialogAria}>
      <button type="button" className="absolute inset-0 bg-black/80" onClick={closeQr} aria-label={t.closeQrAria} />
      <div className="relative bg-white rounded-2xl p-4 max-w-sm w-full text-center">
        <p className="font-semibold text-gray-800">{t.payTo(fee, doctor.name)}</p>
        <img src={qrSrc} alt={t.qrAlt} className="w-full max-w-xs mx-auto my-3 rounded-lg border" />
        {payUpi && <p className="text-xs text-gray-600">UPI ID: <span className="font-mono">{payUpi}</span></p>}
        {payeeName && <p className="text-xs text-green-800 mt-0.5"><strong>{t.payee(payeeName)}</strong></p>}
        <p className="text-[11px] text-gray-500 mt-1">{t.longPress}</p>
        <button type="button" onClick={closeQr} className="mt-3 w-full px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">{t.doneBtn}</button>
      </div>
    </div>
  );

  // ---- A: pay — two steps, one main button each ----
  if (stage === 'pay') {
    return (
      <div className="mt-3 space-y-3">
        {hiddenFileInput}
        {qrOverlay}
        <p className="text-base font-bold text-gray-900">{t.payTitle(fee, doctor.name)}</p>

        {/* Step 1: scan */}
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            {stepBadge(1, 'bg-green-600')}
            <p className="text-sm font-semibold text-green-900">{t.step1}</p>
          </div>
          {payDetails}
        </div>

        {/* Step 2: tell the doctor (proof asked only after tapping) */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            {stepBadge(2, 'bg-primary-600')}
            <p className="text-sm font-semibold text-blue-900">{showProof ? t.proofTitle : t.step2}</p>
          </div>
          {!showProof ? (
            <>
              <button
                type="button"
                onClick={() => setShowProof(true)}
                className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg text-base font-bold hover:bg-primary-700"
              >
                {t.paid}
              </button>
              <p className="mt-1.5 text-[11px] text-blue-800 text-center">{t.paidSub}</p>
            </>
          ) : (
            <>
              <p className="text-[11px] text-blue-800 mb-2">{t.proofSub}</p>
              {uploadButton(t.chooseShot)}
              <button
                type="button" disabled={!!busy}
                onClick={() => run('claim', () => appointmentAPI.notifyPayment(apt._id), t.claimOk)}
                className="mt-2 w-full px-4 py-2.5 bg-white border border-gray-300 text-gray-800 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                {busy === 'claim' ? t.sending : t.skipProof}
              </button>
              <div className="mt-1">{utrForm}</div>
            </>
          )}
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
