// ============================================
// VoiceSearch — "Bol kar batayein" mic for the Home search box
// ============================================
// Uses the browser's built-in speech recognition (Web Speech API): free, no
// packages, Hindi (hi-IN) or English (en-IN). The spoken words are put into
// the search box, and the existing symptom matching takes over — it already
// understands Devanagari ("पेट में दर्द"), which is what hi-IN returns.
//
// PRIVACY (stated honestly in the UI): on most phones the browser sends the
// audio to its own speech service (Google on Chrome, Apple on Safari) to turn
// it into text — the same as the keyboard's mic button. ProMedicoz never
// records, receives or stores the audio.
//
// Only rendered where the API exists (Chrome on Android, Safari on iPhone…);
// elsewhere nothing shows, so nobody sees a broken button.

import { useEffect, useRef, useState } from 'react';
import { trackEvent } from './Analytics';

const HINT_KEY = 'promedicoz_voice_hint_seen';

export function isVoiceSupported() {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

const T = {
  hi: {
    button: 'बोल कर बताएं',
    hint: 'बोल कर बताएं',
    listening: 'बोलिए…',
    example: 'जैसे: "पेट में दर्द है" या "बच्चे को बुखार है"',
    stopsItself: 'रुकने पर अपने-आप बंद हो जाएगा',
    cancel: 'बंद करें',
    retry: '🎤 फिर से बोलें',
    noSpeech: 'कुछ सुनाई नहीं दिया। फिर से बोलें या टाइप करें।',
    blocked: 'माइक की अनुमति नहीं है। ब्राउज़र सेटिंग में माइक चालू करें, या टाइप करें।',
    network: 'आवाज़ पहचानने के लिए इंटरनेट चाहिए। टाइप करके भी खोज सकते हैं।',
    failed: 'आवाज़ पहचान नहीं पाए। फिर से कोशिश करें या टाइप करें।',
    privacy: 'आपके फ़ोन की स्पीच सेवा आवाज़ को टेक्स्ट बनाती है। ProMedicoz आपकी आवाज़ रिकॉर्ड या सेव नहीं करता।',
  },
  en: {
    button: 'Search by voice',
    hint: 'Say it',
    listening: 'Listening…',
    example: 'e.g. "stomach pain and gas" or "my child has fever"',
    stopsItself: 'Stops by itself when you pause',
    cancel: 'Close',
    retry: '🎤 Try again',
    noSpeech: "Didn't catch that. Try again, or type instead.",
    blocked: 'Microphone is blocked. Allow it in your browser settings, or type instead.',
    network: 'Voice search needs internet. You can type instead.',
    failed: "Couldn't recognise that. Try again, or type instead.",
    privacy: "Your phone's speech service turns your voice into text. ProMedicoz doesn't record or store your voice.",
  },
};

// Trim and drop trailing sentence marks the recogniser sometimes adds.
const clean = (s) => String(s || '').replace(/[\s.।?!,]+$/u, '').trim();

// hideHint: hide the first-time "say it" pill (e.g. while the box has text,
// so it never covers the suggestion line).
export default function VoiceSearch({ lang = 'en', onResult, hideHint = false }) {
  const [open, setOpen] = useState(false);
  const [speechLang, setSpeechLang] = useState(lang === 'hi' ? 'hi' : 'en');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | listening | error
  const [error, setError] = useState('');
  const [showHint, setShowHint] = useState(() => {
    try { return !localStorage.getItem(HINT_KEY); } catch { return false; }
  });
  const recRef = useRef(null);
  const gotFinal = useRef(false);
  const t = T[speechLang];

  // Keep the recogniser language in step with the page language.
  useEffect(() => { if (!open) setSpeechLang(lang === 'hi' ? 'hi' : 'en'); }, [lang, open]);

  const stop = () => {
    try { recRef.current?.abort(); } catch { /* already stopped */ }
    recRef.current = null;
  };
  useEffect(() => stop, []);

  const start = (which = speechLang) => {
    stop();
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = which === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    gotFinal.current = false;
    setText(''); setError(''); setStatus('listening');

    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
      }
      setText(clean(final || interim));
      if (final && clean(final)) {
        gotFinal.current = true;
        const said = clean(final);
        trackEvent('voice_search_result', { lang: which, words: said.split(/\s+/).length });
        onResult(said);
        stop();
        setOpen(false);
        setStatus('idle');
      }
    };
    rec.onerror = (e) => {
      const code = e.error || 'failed';
      if (code === 'aborted') return;
      trackEvent('voice_search_error', { error: code });
      setStatus('error');
      setError(code === 'no-speech' ? T[which].noSpeech
        : code === 'not-allowed' || code === 'service-not-allowed' ? T[which].blocked
          : code === 'network' ? T[which].network : T[which].failed);
    };
    rec.onend = () => {
      recRef.current = null;
      if (!gotFinal.current) setStatus((s) => (s === 'listening' ? 'error' : s));
      setError((m) => m || (gotFinal.current ? '' : T[which].noSpeech));
    };
    recRef.current = rec;
    try { rec.start(); } catch { setStatus('error'); setError(T[which].failed); }
  };

  const openSheet = () => {
    setOpen(true);
    if (showHint) { setShowHint(false); try { localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ } }
    trackEvent('voice_search_start', { lang: speechLang });
    start(speechLang);
  };
  const close = () => { stop(); setOpen(false); setStatus('idle'); };
  const switchLang = (l) => { setSpeechLang(l); start(l); };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={t.button}
        title={t.button}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-sm hover:bg-primary-700 active:scale-95 transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm0 0v4m-4 0h8M19 11a7 7 0 01-14 0" />
        </svg>
      </button>
      {showHint && !hideHint && (
        <span className="pointer-events-none absolute right-0 -bottom-6 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold whitespace-nowrap" aria-hidden="true">
          {T[lang === 'hi' ? 'hi' : 'en'].hint} ↑
        </span>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={t.listening}>
          <div className="absolute inset-0 bg-black/50" onClick={close} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl sm:mb-6 px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center animate-fade-in">
            <div className="mx-auto w-10 h-1.5 rounded-full bg-gray-200" aria-hidden="true" />
            <button type="button" onClick={close} aria-label={t.cancel} className="absolute right-4 top-3 w-9 h-9 rounded-full hover:bg-gray-100 text-gray-500 text-xl leading-none">×</button>

            <div className="mt-6 mx-auto relative w-28 h-28 flex items-center justify-center" aria-hidden="true">
              {status === 'listening' && <span className="absolute inset-0 rounded-full bg-primary-200 animate-ping opacity-60" />}
              <span className="absolute inset-3 rounded-full bg-primary-300/70" />
              <span className={`relative w-16 h-16 rounded-full flex items-center justify-center text-white ${status === 'error' ? 'bg-gray-400' : 'bg-primary-600'}`}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm0 0v4m-4 0h8M19 11a7 7 0 01-14 0" />
                </svg>
              </span>
            </div>

            <p className="mt-4 text-lg font-extrabold text-gray-900">{status === 'error' ? '🤔' : t.listening}</p>
            {status !== 'error' && <p className="mt-1 text-sm text-gray-500">{t.example}</p>}

            <div className="mt-4 min-h-[44px] rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-base font-semibold text-gray-800" aria-live="polite">
              {text || (status === 'error' ? <span className="text-sm font-normal text-amber-800">{error}</span> : <span className="text-gray-300">…</span>)}
            </div>

            {status === 'error' && (
              <button type="button" onClick={() => start(speechLang)} className="mt-3 w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700">
                {t.retry}
              </button>
            )}

            <div className="mt-4 inline-flex rounded-full border border-gray-200 p-0.5" role="group" aria-label="Language">
              {[['hi', 'हिंदी'], ['en', 'English']].map(([k, label]) => (
                <button key={k} type="button" aria-pressed={speechLang === k} onClick={() => switchLang(k)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold ${speechLang === k ? 'bg-primary-600 text-white' : 'text-gray-600'}`}>
                  {label}
                </button>
              ))}
            </div>
            {status === 'listening' && <p className="mt-2 text-[11px] text-gray-400">{t.stopsItself}</p>}
            <p className="mt-4 text-[11px] leading-snug text-green-800 bg-green-50 rounded-lg px-3 py-2">🔒 {t.privacy}</p>
          </div>
        </div>
      )}
    </>
  );
}
