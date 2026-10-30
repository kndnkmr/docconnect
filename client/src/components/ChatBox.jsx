import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { messageAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';
import { useLang } from '../context/LangContext';

// ============================================
// Doctor ↔ patient chat (one appointment)
// ============================================
// Phone keyboard fixes (the old box felt "weird" while typing):
//   • 16 px text in the box — iPhone zooms the whole page when you tap a
//     box with smaller text, and often stays zoomed after.
//   • On phones the chat is sized to the VISIBLE area (window.visualViewport).
//     Newer Android Chrome and iPhone lay the keyboard OVER the page instead
//     of shrinking it, so a full-height (100dvh) chat got scrolled up by the
//     browser and the header/messages slid off the top.
//   • The box grows with the text (1 → ~4 lines), and the keyboard stays open
//     when you tap ➤ (the button doesn't steal focus).
//   • Computer: Enter sends, Shift+Enter = new line. Phone: Enter = new line,
//     ➤ sends. Never sends mid-way through Hindi/IME typing.
// Plus: who you're talking to in the header, quick replies (fill the box, you
// still press ➤), long links wrap inside the bubble.

// Fixed UI text only — message text is never translated. Doctors/admins
// always see English.
const TXT = {
  en: {
    title: 'Messages',
    loading: 'Loading...',
    empty: 'No messages yet. Start the conversation!',
    sending: 'Sending…',
    placeholder: 'Type a message...',
    send: 'Send',
    sendFailed: 'Failed to send message',
    close: 'Close chat',
    quickLabel: 'Quick replies',
    quickPatient: ['Running a few minutes late', "I'm ready, please call", 'Thank you, doctor'],
    quickDoctor: ['Joining the call now', 'Please upload your report in the Reports tab', 'Take care, get well soon'],
  },
  hi: {
    title: 'मैसेज',
    loading: 'लोड हो रहा है...',
    empty: 'अभी कोई मैसेज नहीं है। बात शुरू करें!',
    sending: 'भेजा जा रहा है…',
    placeholder: 'मैसेज लिखें...',
    send: 'भेजें',
    sendFailed: 'मैसेज नहीं भेजा जा सका',
    close: 'चैट बंद करें',
    quickLabel: 'झटपट जवाब',
    quickPatient: ['थोड़ी देर हो जाएगी', 'मैं तैयार हूँ, कॉल करें', 'धन्यवाद डॉक्टर'],
    quickDoctor: [],
  },
};

const MAX_BOX_PX = 120; // ~4 lines at 16 px

function ChatBox({ appointmentId, appointment, onClose }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const isDoctorSide = user?.role === 'doctor' || user?.role === 'admin';
  const hi = lang === 'hi' && !isDoctorSide;
  const t = TXT[hi ? 'hi' : 'en'];
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const prevCountRef = useRef(0);

  // ---- Who you're talking to ----
  const other = appointment
    ? (isDoctorSide
      ? [appointment.patient?.name, appointment.bookedFor === 'family' && appointment.familyMemberName ? `for ${appointment.familyMemberName}` : ''].filter(Boolean).join(' ')
      : appointment.doctor?.name ? `Dr. ${appointment.doctor.name}` : '')
    : '';
  const when = appointment
    ? [
      appointment.date && new Date(appointment.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }),
      (appointment.timeSlot || '').split(' - ')[0],
      { video: '📹', phone: '📞', audio: '📞', 'in-person': '🏥' }[appointment.consultationType] || '',
    ].filter(Boolean).join(' · ')
    : '';

  // ---- Phone: fit the chat into the space above the keyboard ----
  const [isSmall, setIsSmall] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  const [vv, setVv] = useState(null); // { h, top } of the visible area
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onMq = () => setIsSmall(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq);
    const v = window.visualViewport;
    const update = () => { if (v) setVv({ h: Math.round(v.height), top: Math.round(v.offsetTop) }); };
    update();
    if (v) { v.addEventListener('resize', update); v.addEventListener('scroll', update); }
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onMq) : mq.removeListener(onMq);
      if (v) { v.removeEventListener('resize', update); v.removeEventListener('scroll', update); }
    };
  }, []);

  const scrollToBottom = () => {
    const c = messagesContainerRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  };
  // Keyboard opened/closed (visible height changed): keep the latest message in view.
  useLayoutEffect(() => { scrollToBottom(); }, [vv && vv.h]);

  const fetchMessages = async () => {
    try {
      const response = await messageAPI.getMessages(appointmentId);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Prevent body scroll when chat is open
    document.body.style.overflow = 'hidden';
    // Poll as a fallback in case the socket connection drops or is blocked -
    // new messages normally arrive instantly via the 'new-message' socket
    // event below, so this only needs to be a safety net now.
    const interval = setInterval(fetchMessages, 15000);
    return () => { clearInterval(interval); document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  // ---- Realtime: join this appointment's room and listen for new messages ----
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return; // not logged in / no token — polling above still covers it

    socket.emit('join-appointment', appointmentId);

    const myId = user?._id || user?.id;
    const handleNewMessage = (msg) => {
      if (msg.appointment !== appointmentId) return;
      // Our own sent messages are reconciled via fetchMessages() right after
      // sending (see handleSend) — only append messages from the other side.
      if (msg.sender === myId) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev; // already have it
        return [...prev, msg];
      });
    };

    socket.on('new-message', handleNewMessage);
    return () => {
      socket.emit('leave-appointment', appointmentId);
      socket.off('new-message', handleNewMessage);
    };
  }, [appointmentId, user]);

  // Only auto-scroll when the message COUNT grows (a new message arrived or was
  // sent) — not on every poll refresh. And scroll only the message list, not
  // the page, so typing doesn't get yanked around (especially on mobile).
  useEffect(() => {
    if (messages.length > prevCountRef.current) scrollToBottom();
    prevCountRef.current = messages.length;
  }, [messages]);

  // Grow the box with the text (up to ~4 lines, then it scrolls).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_BOX_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_BOX_PX ? 'auto' : 'hidden';
  }, [text]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const keepKeyboard = document.activeElement === inputRef.current;

    // Optimistic: show the message instantly with a temporary id
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      sender: user?._id || user?.id,
      text: trimmed,
      createdAt: new Date().toISOString(),
      pending: true
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setText('');
    setSending(true);
    if (keepKeyboard) inputRef.current.focus();

    try {
      await messageAPI.send(appointmentId, trimmed);
      // Reconcile with the server (replaces the temp message with the real one)
      fetchMessages();
    } catch (error) {
      // Roll back the optimistic message on failure and restore the text
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setText(trimmed);
      toast.error(error.response?.data?.message || t.sendFailed);
    } finally {
      setSending(false);
    }
  };

  // Computer: Enter sends, Shift+Enter = new line. Phones (touch): Enter is a
  // new line, ➤ sends. Never during IME composition (Hindi keyboards etc.).
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    handleSend();
  };

  const quick = isDoctorSide ? TXT.en.quickDoctor : t.quickPatient;
  const pickQuick = (q) => setText(q);

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
    });
  };

  // Phone: exactly the visible area (above the keyboard). Computer: centred card.
  const phoneBox = isSmall && vv ? { top: vv.top, height: vv.h } : null;

  return (
    <div
      className={phoneBox ? 'fixed left-0 right-0 z-[60] flex' : 'fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4'}
      style={phoneBox || undefined}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative bg-white w-full shadow-2xl flex flex-col ${phoneBox ? 'h-full' : 'h-[100dvh] sm:h-[70dvh] sm:max-w-md sm:rounded-xl'}`}
        role="dialog" aria-modal="true" aria-label={other ? `${t.title}: ${other}` : t.title}
      >
        {/* Header: who + when */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-800 truncate">{other || t.title}</h3>
            {when && <p className="text-xs text-gray-500 truncate">{when}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={t.close} className="w-10 h-10 -mr-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
          {loading ? (
            <p className="text-center text-gray-500 text-sm">{t.loading}</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">{t.empty}</p>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender === user?.id || msg.sender === user?._id;
              return (
                <div key={msg._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] min-w-0 rounded-2xl px-3 py-2 ${isMine ? 'bg-primary-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'}`}>
                    <p className="text-[15px] leading-snug whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.text}</p>
                    <p className={`text-[11px] mt-1 ${isMine ? 'text-primary-200' : 'text-gray-400'}`}>
                      {msg.pending ? t.sending : formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick replies — only while the box is empty; tap = fill, ➤ sends */}
        {!loading && !text && quick.length > 0 && (
          <div className="px-3 pt-2 flex gap-2 overflow-x-auto" role="group" aria-label={t.quickLabel} style={{ scrollbarWidth: 'none' }}>
            {quick.map((q) => (
              <button key={q} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickQuick(q)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full border border-primary-200 bg-primary-50 text-primary-800 text-sm hover:bg-primary-100">
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSend} className="px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.placeholder}
            maxLength={1000}
            enterKeyHint="enter"
            aria-label={t.placeholder}
            // 16 px: stops iPhone zooming the page when the box is tapped.
            className="flex-1 min-w-0 resize-none px-4 py-2.5 border border-gray-300 rounded-3xl text-[16px] leading-6 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
          <button
            type="submit"
            // Don't take focus from the box, so the phone keyboard stays open.
            onMouseDown={(e) => e.preventDefault()}
            disabled={sending || !text.trim()}
            aria-label={t.send}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatBox;
