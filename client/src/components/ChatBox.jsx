import { useState, useEffect, useRef } from 'react';
import { messageAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function ChatBox({ appointmentId, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef(null);
  const prevCountRef = useRef(0);

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
    // Poll for new messages every 3 seconds (snappier delivery of the other person's replies)
    const interval = setInterval(fetchMessages, 3000);
    return () => { clearInterval(interval); document.body.style.overflow = ''; };
  }, [appointmentId]);

  // Only auto-scroll when the message COUNT grows (a new message arrived or was
  // sent) — not on every 3s poll refresh. And scroll only the message list, not
  // the page, so typing doesn't get yanked around (especially on mobile).
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const c = messagesContainerRef.current;
      if (c) c.scrollTop = c.scrollHeight;
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

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

    try {
      await messageAPI.send(appointmentId, trimmed);
      // Reconcile with the server (replaces the temp message with the real one)
      fetchMessages();
    } catch (error) {
      // Roll back the optimistic message on failure and restore the text
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setText(trimmed);
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:rounded-xl shadow-2xl sm:max-w-md h-full sm:h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-800">Messages</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-center text-gray-500 text-sm">Loading...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender === user?.id || msg.sender === user?._id;
              return (
                <div key={msg._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isMine ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-xs mt-1 ${isMine ? 'text-primary-200' : 'text-gray-400'}`}>
                      {msg.pending ? 'Sending…' : formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            maxLength={1000}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatBox;
