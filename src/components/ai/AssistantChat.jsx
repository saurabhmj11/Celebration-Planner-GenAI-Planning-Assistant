import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X, SendHorizonal, Trash2, MessageCircleHeart } from 'lucide-react';
import { useEventContext } from '../../context/EventContext';
import { VENDOR_CATEGORIES } from '../../data/defaultData';
import {
  calculateBudgetTotals,
  calculateTimelineStats,
  calculateVendorStats,
} from '../../utils/calculator';
import { aiAssist } from '../../services/aiAssist';
import { AI_ACCENT_CLASSES, daysUntil } from './aiKit';

const MAX_HISTORY = 8;
const STARTER_PROMPTS = [
  'How is my budget looking?',
  'What should I do next?',
  'Which vendors am I missing?',
  'Give me decoration ideas',
];

/**
 * Floating AI Assistant — a conversational co-planner that knows the active
 * event (title, date, budget, tasks, vendors) and answers in context, with
 * suggested follow-ups and the same live/offline fallback as every AI panel.
 */
export function AssistantChat() {
  const { activeEvent } = useEventContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', text, source?}
  const [suggestions, setSuggestions] = useState(STARTER_PROMPTS);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const panelRef = useRef(null);

  const context = useMemo(() => {
    if (!activeEvent) return null;
    const totals = calculateBudgetTotals(activeEvent);
    const taskStats = calculateTimelineStats(activeEvent.tasks || []);
    const vendorStats = calculateVendorStats(activeEvent.vendors || []);
    const unbooked = [...new Set(
      (activeEvent.vendors || [])
        .filter((v) => v.status !== 'booked' && v.status !== 'deposit_paid')
        .map((v) => VENDOR_CATEGORIES.find((c) => c.id === v.category)?.label || v.category)
    )];
    return {
      totals,
      taskStats,
      vendorStats,
      unbooked,
      runway: daysUntil(activeEvent.date),
    };
  }, [activeEvent]);

  // Escape closes the panel; focus moves to the input when it opens.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    inputRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Keep the transcript pinned to the newest message.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  const send = useCallback(async (rawText) => {
    const text = (rawText ?? input).trim();
    if (!text || isSending) return;

    const history = messages
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }));

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setSuggestions([]);
    setIsSending(true);

    try {
      const result = await aiAssist.assistantChat({
        eventTitle: activeEvent?.title || undefined,
        eventType: activeEvent?.type || undefined,
        eventDate: activeEvent?.date || undefined,
        daysUntilEvent: context?.runway,
        totalBudget: activeEvent?.budget || undefined,
        spentSoFar: context?.totals.totalSpent || undefined,
        guestCount: activeEvent?.guestCount || undefined,
        taskStats: context ? { total: context.taskStats.totalTasks, completed: context.taskStats.completedTasks } : undefined,
        vendorStats: context ? { total: context.vendorStats.totalVendors, booked: context.vendorStats.bookedCount } : undefined,
        unbookedCategories: context?.unbooked?.slice(0, 20),
        upcomingTaskTitles: (activeEvent?.tasks || [])
          .filter((t) => !t.completed && t.title)
          .slice(0, 5)
          .map((t) => String(t.title).slice(0, 160)),
        history,
        message: text,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: result.data.reply, source: result.source, model: result.model },
      ]);
      if (result.data.suggestions?.length) {
        setSuggestions(result.data.suggestions.slice(0, 3));
      } else {
        setSuggestions(STARTER_PROMPTS);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Sorry — something went wrong on my side. Please try again.', source: 'error' },
      ]);
      setSuggestions(STARTER_PROMPTS);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [input, isSending, messages, activeEvent, context]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSuggestions(STARTER_PROMPTS);
    inputRef.current?.focus();
  };

  const eventLabel = activeEvent?.title
    ? `${activeEvent.title}${context?.runway >= 0 ? ` · ${context.runway}d out` : ''}`
    : 'No active event';

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Close the AI planning assistant' : 'Open the AI planning assistant'}
        aria-expanded={isOpen}
        aria-controls="assistant-chat-panel"
        className={`fixed bottom-6 right-6 z-30 no-print w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${AI_ACCENT_CLASSES.iconWrap}`}
      >
        {isOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Sparkles className="w-6 h-6" aria-hidden="true" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          ref={panelRef}
          id="assistant-chat-panel"
          role="dialog"
          aria-label="AI planning assistant"
          className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 sm:w-[24rem] z-30 no-print rounded-3xl border border-amber-200/80 bg-white shadow-2xl shadow-amber-500/10 overflow-hidden flex flex-col animate-fadeIn max-h-[min(32rem,70vh)]"
        >
          {/* Header */}
          <div className={`px-4 py-3 flex items-center justify-between gap-2 ${AI_ACCENT_CLASSES.card} border-b border-amber-200/70`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 ${AI_ACCENT_CLASSES.iconWrap}`} aria-hidden="true">
                <MessageCircleHeart className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-display font-extrabold text-slate-900 leading-tight">AI Planning Assistant</p>
                <p className="text-[11px] text-slate-600 truncate">{eventLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearChat}
              aria-label="Clear conversation"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 shrink-0"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Transcript */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-3 bg-slate-50/60"
            aria-live="polite"
            aria-label="Conversation"
          >
            {messages.length === 0 && (
              <div className="text-center py-4">
                <Sparkles className="w-6 h-6 mx-auto text-amber-400" aria-hidden="true" />
                <p className="text-xs text-slate-600 mt-2">
                  I know your event's budget, dates, tasks, and vendors — ask me anything.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-brand-600 text-white rounded-br-md'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.role === 'assistant' && m.source === 'local-ai-engine' && (
                    <p className="text-[10px] font-semibold text-amber-600 mt-1.5">offline engine</p>
                  )}
                  {m.role === 'assistant' && m.source === 'live-ai' && (
                    <p className="text-[10px] font-semibold text-emerald-600 mt-1.5">{m.model || 'GLM'} · live</p>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm flex items-center gap-1.5" role="status">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '240ms' }} />
                  <span className="sr-only">The assistant is typing</span>
                </div>
              </div>
            )}
          </div>

          {/* Suggested prompts */}
          {suggestions.length > 0 && !isSending && (
            <div className="px-4 pt-2 pb-1 bg-slate-50/60 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 truncate max-w-full"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="p-3 border-t border-slate-200/80 bg-white flex items-end gap-2">
            <label htmlFor="assistant-input" className="sr-only">Ask the AI planning assistant</label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about budget, vendors, timing…"
              maxLength={1000}
              className="flex-1 resize-none text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 min-h-[38px] max-h-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={isSending || !input.trim()}
              aria-label="Send message"
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-40 ${AI_ACCENT_CLASSES.button}`}
            >
              <SendHorizonal className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
