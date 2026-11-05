import { useEffect, useRef, useState } from 'react';
import { Bot, ExternalLink, Send, Sparkles, X } from 'lucide-react';
import { sendAIMessage } from '../services/aiService.js';

const SUGGESTED = [
  'How do I find dangerous asteroids?',
  'Explain the 3D Solar System view',
  'What do Red, Yellow, Green colors mean?',
  'What is miss distance and AU?',
  'How often does data refresh from NASA?',
];

function TypingDots() {
  return (
    <span className="ai-typing-dots" aria-label="AI is typing">
      <span />
      <span />
      <span />
    </span>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';

  const escapedContent = msg.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const formattedContent = escapedContent
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#10b981;text-decoration:underline">$1</a>'
    )
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  return (
    <div
      className={`flex gap-2.5 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      } mb-3`}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
          <Bot className="h-3.5 w-3.5 text-emerald-400" />
        </div>
      )}

      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'rounded-tr-sm bg-blood-red/80 text-white'
            : 'rounded-tl-sm bg-[#111827] border border-white/8 text-slate-200'
        }`}
        dangerouslySetInnerHTML={{
          __html: formattedContent,
        }}
      />
    </div>
  );
}

export default function AIAssistant({ open, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "👋 Hi! I'm **ASTRA AI**, your guide to this asteroid tracking platform.\n\nI can help you navigate the 3D Solar System, understand asteroid threat levels, find dangerous asteroids, explain NASA data, and answer general questions.\n\nWhat would you like to explore? 🚀",
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiModel, setAiModel] = useState(null);
  const [aiSource, setAiSource] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text || input).trim();

    if (!content || loading) return;

    setInput('');

    const newMessages = [
      ...messages,
      { role: 'user', content },
    ];

    setMessages(newMessages);
    setLoading(true);

    try {
      const result = await sendAIMessage(newMessages);

      const replyText =
        typeof result === 'string' ? result : result.text;

      const source =
        typeof result === 'object' ? result.source : 'unknown';

      const model =
        typeof result === 'object' ? result.model : null;

      if (model) setAiModel(model);

      setAiSource(source);

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: replyText },
      ]);
    } catch (error) {
      console.error('ASTRA AI error:', error);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '⚠️ Something went wrong. Please check your connection and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) return null;

  const isLive = aiSource === 'gemini';

  return (
    <div
      className="ai-panel-overlay"
      onClick={(e) =>
        e.target === e.currentTarget && onClose()
      }
    >
      <aside
        className="ai-panel"
        role="dialog"
        aria-label="ASTRA AI Assistant"
        aria-modal="true"
      >
        {/* Header */}
        <div className="ai-panel-header">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </div>

            <div>
              <p className="text-sm font-bold text-white leading-none">
                ASTRA AI
              </p>

              <p
                className="text-[10px] mt-0.5"
                style={{
                  color: isLive ? '#34d399' : '#94a3b8',
                }}
              >
                {isLive
                  ? `Gemini ${aiModel || '1.5 Flash'} · Live`
                  : aiSource === 'fallback'
                  ? 'Offline · Built-in Knowledge'
                  : 'Connecting to Gemini…'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="ai-panel-close"
            aria-label="Close AI assistant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Setup notice */}
        {!isLive && aiSource !== 'fallback' && (
          <div className="ai-key-notice">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400" />

            <span>
              Add your Gemini API key as{' '}
              <code className="text-xs bg-black/40 px-1 rounded">
                GEMINI_API_KEY
              </code>{' '}
              in your backend .env file.{' '}

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-amber-300 underline hover:text-amber-200"
              >
                Get key
                <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="ai-messages">
          {messages.map((m, i) => (
            <Message key={i} msg={m} />
          ))}

          {loading && (
            <div className="flex gap-2.5 mb-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                <Bot className="h-3.5 w-3.5 text-emerald-400" />
              </div>

              <div className="rounded-2xl rounded-tl-sm bg-[#111827] border border-white/8 px-3.5 py-3">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested questions */}
        {messages.length === 1 && !loading && (
          <div className="ai-suggestions">
            <p className="mb-2 text-[10px] text-slate-500 uppercase tracking-widest">
              Suggested questions
            </p>

            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="ai-suggestion-chip"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="ai-input-row">
          <textarea
            ref={inputRef}
            className="ai-input"
            placeholder="Ask anything — ASTRA or general questions…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            aria-label="Message input"
          />

          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="ai-send-btn"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Footer */}
        <p className="ai-footer">
          {isLive ? (
            <>
              Powered by{' '}
              <span className="text-emerald-400">
                {aiModel || 'Gemini'}
              </span>{' '}
              · secure server proxy
            </>
          ) : (
            <>
              Built-in knowledge ·{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-500 hover:underline"
              >
                Enable Gemini
              </a>
            </>
          )}
        </p>
      </aside>
    </div>
  );
}