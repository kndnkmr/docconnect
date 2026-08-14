import { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { appointmentAPI } from '../services/api';

// Daily.co - embedded video/audio call, no login/sign-in for doctor or patient.
// The backend issues a private room URL + join token, so clicking "Join Call"
// drops the user straight into the call.
function VideoCall({ appointmentId, onClose }) {
  const containerRef = useRef(null);
  const callFrameRef = useRef(null);
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
        // 1. Ask our backend for the room URL + join token
        const res = await appointmentAPI.getVideoToken(aptId);
        const { roomUrl, token } = res.data;
        if (cancelled || !containerRef.current) return;

        // 2. Build the Daily call UI inside our container
        const frame = DailyIframe.createFrame(containerRef.current, {
          showLeaveButton: true,
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: '0'
          }
        });
        callFrameRef.current = frame;

        // When the user leaves the call, close the overlay
        frame.on('left-meeting', () => onClose());
        frame.on('error', () => {
          setStatus('error');
          setErrorMsg('The call ran into a problem. Please try again.');
        });

        // 3. Join (camera off for phone/audio consultations)
        await frame.join({ url: roomUrl, token, startVideoOff: isAudioOnly });
        if (!cancelled) setStatus('joined');
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(
            e.response?.data?.message || 'Could not start the call. Please try again.'
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
        <div className="text-red-300 text-center py-4 text-sm">{errorMsg}</div>
      )}

      {/* Daily call container */}
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}

export default VideoCall;
