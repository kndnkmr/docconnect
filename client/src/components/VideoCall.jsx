import { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { appointmentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Turn a raw error into ONE clear, user-friendly message (no confusing stacking).
function friendlyError(raw) {
  const msg = (raw || '').toString().toLowerCase();
  if (msg.includes('permission') || msg.includes('camera') || msg.includes('microphone') || msg.includes('notallowed')) {
    return 'Camera/microphone access is blocked. Please allow it from the icon in your browser address bar, then try again.';
  }
  if (msg.includes('payment')) {
    return 'The video service is temporarily unavailable. Please contact support.';
  }
  if (msg.includes('time slot') || msg.includes('booked time')) {
    return raw; // already a clear message from our backend (slot window)
  }
  if (msg.includes('network') || msg.includes('connection')) {
    return 'Network problem — please check your internet connection and try again.';
  }
  // Fall back to the backend message if it looks human-readable, else a generic line.
  if (raw && raw.length > 0 && raw.length < 160) return raw;
  return 'Could not start the call. Please try again in a moment.';
}

// Daily.co - embedded video/audio call, no login/sign-in for doctor or patient.
// The backend issues a private room URL + join token, so clicking "Join Call"
// drops the user straight into the call.
function VideoCall({ appointmentId, onClose }) {
  const { isDoctor } = useAuth();
  const containerRef = useRef(null);
  const callFrameRef = useRef(null);
  const joinedRef = useRef(false); // becomes true only after we actually join
  const callLogIdRef = useRef(null); // analytics log id (doctor side only)
  const logEndedRef = useRef(false); // guards against finalizing the log twice
  const [status, setStatus] = useState('connecting'); // connecting | joined | error
  const [errorMsg, setErrorMsg] = useState('');

  // End Call: the doctor (moderator) ends it for EVERYONE by ejecting the other
  // participant first; the patient just leaves for themselves.
  const handleEndCall = async () => {
    const frame = callFrameRef.current;
    if (frame && isDoctor) {
      try {
        await frame.updateParticipants({ '*': { eject: true } }); // remove the patient
      } catch (_) { /* ignore — we still close below */ }
    }
    onClose();
  };

  // appointmentId is passed as "id|type" (type = video or phone)
  const [aptId, consultationType] = appointmentId.includes('|')
    ? appointmentId.split('|')
    : [appointmentId, 'video'];
  const isAudioOnly = consultationType === 'phone';

  // Finalize the analytics call log once (only the doctor has a logId).
  const finalizeCallLog = () => {
    if (callLogIdRef.current && !logEndedRef.current) {
      logEndedRef.current = true;
      appointmentAPI.endCallLog(aptId, callLogIdRef.current).catch(() => {});
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    let cancelled = false;

    const start = async () => {
      try {
        // 1. Get the room URL + join token from our backend
        const res = await appointmentAPI.getVideoToken(aptId);
        const { roomUrl, token } = res.data;
        if (cancelled || !containerRef.current) return;

        // 2. Destroy any leftover Daily instance (prevents "duplicate instance"
        //    errors when a previous call wasn't fully cleaned up).
        const existing = DailyIframe.getCallInstance();
        if (existing) {
          try { await existing.destroy(); } catch (_) { /* ignore */ }
        }
        if (cancelled || !containerRef.current) return;

        // 3. Build the Daily call UI inside our container
        const frame = DailyIframe.createFrame(containerRef.current, {
          showLeaveButton: false, // use our single header "End Call" instead
          iframeStyle: { width: '100%', height: '100%', border: '0' }
        });
        callFrameRef.current = frame;

        // Only close the overlay when the user leaves AFTER having joined.
        // (Daily can emit 'left-meeting' on a failed join — we don't want to
        // silently close in that case; we show an error instead.)
        frame.on('left-meeting', () => {
          finalizeCallLog();
          if (joinedRef.current) onClose();
        });
        frame.on('joined-meeting', () => {
          joinedRef.current = true;
          if (!cancelled) setStatus('joined');
          // Log the connection (backend returns a logId only for the doctor)
          appointmentAPI.startCallLog(aptId)
            .then((r) => { callLogIdRef.current = r.data.logId; })
            .catch(() => {});
        });
        frame.on('error', (ev) => {
          console.error('Daily call error:', ev);
          if (!cancelled) {
            setStatus('error');
            setErrorMsg(friendlyError(ev && ev.errorMsg));
          }
        });

        // 4. Join (camera off for phone/audio consultations)
        await frame.join({ url: roomUrl, token, startVideoOff: isAudioOnly });
      } catch (e) {
        console.error('Start call failed:', e);
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(friendlyError(e?.response?.data?.message || e?.message));
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      document.body.style.overflow = '';
      finalizeCallLog();
      if (callFrameRef.current) {
        try { callFrameRef.current.destroy(); } catch (_) { /* ignore */ }
        callFrameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
        <span className="text-white text-sm font-medium">
          ProMedicoz {isAudioOnly ? 'Audio' : 'Video'} Consultation
        </span>
        <button
          onClick={handleEndCall}
          className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
        >
          {isDoctor ? 'End Call for All' : 'Leave Call'}
        </button>
      </div>

      {/* Status messages */}
      {status === 'connecting' && (
        <div className="text-white text-center py-4 text-sm">Connecting to the call…</div>
      )}
      {status === 'error' && (
        <div className="text-red-300 text-center py-4 text-sm px-4">
          {errorMsg}
          <div className="mt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Daily call container (hidden while showing our own error, to avoid stacked messages) */}
      <div ref={containerRef} className={`flex-1 ${status === 'error' ? 'hidden' : ''}`} />
    </div>
  );
}

export default VideoCall;
