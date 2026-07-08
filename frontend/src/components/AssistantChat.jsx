// -----------------------------------------------------------------------------
// AssistantChat.jsx — bottom-right floating chat widget, mounted globally
// (see Navbar.jsx) so it's available on every authenticated page.
//
// Behavior branches by role on the BACKEND (see aiController.chat) so this
// component doesn't need to know the rules — it just renders whatever
// `reply` (and, for EOC, `incidents`) comes back.
// -----------------------------------------------------------------------------

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../api/axiosClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import SeverityBadge from './SeverityBadge.jsx';

const DISPATCHER_ROLES = ['eoc', 'admin', 'rescue_team'];

const CITIZEN_SUGGESTIONS = ['Water is entering my house', 'I smell smoke nearby', 'Someone is injured'];
const EOC_SUGGESTIONS = ['Show all unverified flood reports', 'Critical incidents that are active', 'Show resolved reports'];

export default function AssistantChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDispatcher = DISPATCHER_ROLES.includes(user?.role);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      from: 'assistant',
      text: isDispatcher
        ? "Ask me to filter incidents, e.g. \"show all unverified flood reports.\""
        : "I'm the CrisisGrid safety assistant. Tell me what's happening and I'll help — or use the SOS button for immediate danger.",
    },
  ]);
  const [coords, setCoords] = useState(null);
  const scrollRef = useRef(null);

  // Grab the citizen's location once, quietly, so "nearest shelter" can work
  // without an extra step — if permission is denied, we just skip that part.
  useEffect(() => {
    if (isDispatcher || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
      () => setCoords(null),
      { timeout: 5000 }
    );
  }, [isDispatcher]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = useMutation({
    mutationFn: async (text) =>
      (await api.post('/ai/chat', { message: text, ...(coords || {}) })).data,
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { from: 'assistant', text: data.reply, incidents: data.incidents }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { from: 'assistant', text: 'Sorry, something went wrong. Please try again.' }]);
    },
  });

  const handleSend = (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { from: 'user', text: trimmed }]);
    setInput('');
    sendMessage.mutate(trimmed);
  };

  const suggestions = isDispatcher ? EOC_SUGGESTIONS : CITIZEN_SUGGESTIONS;

  return (
    <div className="fixed bottom-5 right-5 z-50 font-body">
      {open && (
        <div className="mb-3 flex h-96 w-80 flex-col overflow-hidden rounded-xl border border-console-border bg-console-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-console-border bg-console-surfaceAlt px-3 py-2">
            <p className="font-display text-sm font-medium text-console-mist">
              {isDispatcher ? 'EOC Assistant' : 'Safety Assistant'}
            </p>
            <button onClick={() => setOpen(false)} className="text-console-muted hover:text-console-mist" aria-label="Close chat">
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                    m.from === 'user'
                      ? 'bg-brand text-white'
                      : 'border border-console-border bg-console-bg text-console-mist'
                  }`}
                >
                  <p>{m.text}</p>
                  {/* EOC search results render as a compact clickable list. */}
                  {m.incidents?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {m.incidents.map((inc) => (
                        <button
                          key={inc._id}
                          onClick={() => navigate('/eoc')}
                          className="flex w-full items-center justify-between gap-2 rounded border border-console-border px-2 py-1 text-left hover:border-brand"
                        >
                          <span className="truncate">{inc.title}</span>
                          <SeverityBadge severity={inc.severity} pulse={false} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sendMessage.isPending && <p className="font-mono text-[10px] text-console-muted">Thinking…</p>}
          </div>

          <div className="border-t border-console-border p-2">
            <div className="mb-2 flex flex-wrap gap-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="rounded border border-console-border px-2 py-0.5 text-[10px] text-console-muted hover:border-brand hover:text-brand"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isDispatcher ? 'Ask about incidents…' : "What's happening?"}
                className="flex-1 rounded-md border border-console-border bg-console-bg px-2 py-1.5 text-xs text-console-mist focus:border-brand"
              />
              <button
                type="submit"
                disabled={sendMessage.isPending}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-white shadow-lg transition hover:bg-brand-dark"
        aria-label="Open assistant chat"
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}
