import { useEffect, useRef } from 'react';

// Jitsi Meet - free, no API key, video call embedded in your site
function VideoCall({ appointmentId, userName, onClose }) {
  const jitsiContainerRef = useRef(null);
  const apiRef = useRef(null);

  // Parse appointmentId and consultationType (passed as "id|type")
  const [aptId, consultationType] = appointmentId.includes('|')
    ? appointmentId.split('|')
    : [appointmentId, 'video'];

  const isAudioOnly = consultationType === 'phone';

  // Create a unique room name per appointment
  const roomName = `promedicoz-${aptId}`;

  useEffect(() => {
    // Hide all overlays and prevent scroll during video call
    document.body.style.overflow = 'hidden';

    // Load Jitsi external API script
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => initJitsi();
    document.body.appendChild(script);

    return () => {
      document.body.style.overflow = '';
      if (apiRef.current) {
        apiRef.current.dispose();
      }
      document.body.removeChild(script);
    };
  }, []);

  const initJitsi = () => {
    if (!window.JitsiMeetExternalAPI) return;

    const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName: roomName,
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: userName || 'User'
      },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: isAudioOnly,
        disableDeepLinking: true,
        prejoinPageEnabled: false,
        lobbyModeEnabled: false,
        enableLobbyChat: false,
        hideLobbyButton: true,
        defaultLanguage: 'en',
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'desktop', 'chat',
          'raisehand', 'hangup', 'fullscreen'
        ],
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: '#1e40af',
      }
    });

    api.addEventListener('readyToClose', () => {
      onClose();
    });

    apiRef.current = api;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
        <span className="text-white text-sm font-medium">ProMedicoz {isAudioOnly ? 'Audio' : 'Video'} Consultation</span>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
        >
          End Call
        </button>
      </div>

      {/* Jitsi container */}
      <div ref={jitsiContainerRef} className="flex-1" />
    </div>
  );
}

export default VideoCall;
