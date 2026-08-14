import { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { appointmentAPI } from '../services/api';

// Daily.co - embedded video/audio call, no login/sign-in for doctor or patient.
// The backend issues a private room URL + join token, so clicking "Join Call"
// drops the user straight into the call.
function VideoCall({ appointmentId, onClose }) {
  const containerRef = useRef(null);
  const callFrameRef = useRef(null);
  const joinedRef = useRef(false); // becomes true only after we actually join
  const [status, setStatus] = useState('connecting'); // connecting | joined | error
  const [errorMsg, setErrorMsg] = useState('');

  // appointmentId is passed as "id|type" (type = video or phone)
  const [aptId, consultationType] = appointmentId.includes('|')
    ? appointmentId.split('|')
    : [appointmentId, 'video'];
  const isAudioOnly = consultationType === 'phone';

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
          showLeaveButton: true,
          iframeStyle: { width: '100%', height: '100%', border: '0' }
        });
        callFrameRef.current = frame;

        // Only close the overlay when the user leaves AFTER having joined.
        // (Daily can emit 'left-meeting' on a failed join — we don't want to
        // silently close in that case; we show an error instead.)
        frame.on('left-meeting', () => {
          if (joinedRef.current) onClose();
        });
        frame.on('joined-meeting', () => {
          joinedRef.current = true;
          if (!cancelled) setStatus('joined');
        });
        frame.on('error', (ev) => {
          console.error('Daily call error:', ev);
          if (!cancelled) {
            setStatus('error');
            setErrorMsg((ev && ev.errorMsg) || 'The call ran into a problem. Please try again.');
          }
        });

        // 4. Join (camera off for phone/audio consultations)
        await frame.join({ url: roomUrl, token, startVideoOff: isAudioOnly });
      } catch (e) {
        console.error('Start call failed:', e);
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(
            e?.response?.data?.message ||
              e?.message ||
              'Could not start the call. Please check your camera/microphone permissions and try again.'
          );
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      document.body.style.overflow = '';
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
          onClick={onClose}
          className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
        >
          End Call
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

      {/* Daily call container */}
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}

export default VideoCall;
