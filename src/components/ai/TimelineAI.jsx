import React, { useMemo, useState } from 'react';
import { Clock, Plus, CalendarClock, CheckSquare, Square } from 'lucide-react';
import { useEventContext } from '../../context/EventContext';
import { aiAssist } from '../../services/aiAssist';
import { AiButton, AiCard, AiErrorNote, AiSkeleton, AiSourceNote, daysUntil, derivePhase, useAiRequest } from './aiKit';

const PRIORITY_STYLES = {
  high: 'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const friendlyDate = (d) => {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—';
  return new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * AI Timeline Generator — drafts a personalized milestone plan for the runway
 * to the event date; the user picks which tasks land on the real timeline.
 */
export function TimelineAI() {
  const { activeEvent, addTasks } = useEventContext();
  const { status, result, error, run, reset, isIdle, isLoading, isDone } = useAiRequest();
  const [selected, setSelected] = useState(new Set());
  const [addedCount, setAddedCount] = useState(0);

  const eventDate = activeEvent?.date || '';
  const runway = useMemo(() => daysUntil(eventDate), [eventDate]);

  const existingTitles = useMemo(
    () => (activeEvent?.tasks || []).map((t) => String(t.title || '').toLowerCase().trim()),
    [activeEvent?.tasks]
  );

  if (!activeEvent) return null;

  const handleGenerate = async () => {
    setAddedCount(0);
    const res = await run(() =>
      aiAssist.timelinePlan({
        eventType: activeEvent.type || 'other',
        eventDate,
        daysUntilEvent: runway,
        guestCount: activeEvent.guestCount || 0,
        totalBudget: activeEvent.budget || 0,
        tone: activeEvent.description || '',
        existingTaskTitles: existingTitles,
      })
    );
    if (res?.data?.tasks) {
      setSelected(new Set(res.data.tasks.map((_, i) => i)));
    }
  };

  const toggleTask = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleAddSelected = () => {
    const tasks = result?.data?.tasks || [];
    const picked = [];
    tasks.forEach((t, i) => {
      if (!selected.has(i)) return;
      picked.push({
        title: t.title,
        notes: t.description ? `${t.description}\n\n(AI-suggested milestone)` : 'AI-suggested milestone',
        dueDate: t.dueDate,
        priority: t.priority,
        category: t.category,
        phase: derivePhase(t.dueDate, eventDate),
        completed: false,
      });
    });
    // Single bulk state update — one id per task, collision-proof even when
    // they all land in the same millisecond (the old addTask loop minted
    // identical `task-<Date.now()>` ids that duplicated React list keys).
    const added = addTasks(picked);
    setAddedCount(added);
    reset();
  };

  const hasDate = Boolean(eventDate);

  return (
    <AiCard
      id="timeline-ai"
      icon={Clock}
      title="AI Milestone Planner"
      subtitle={hasDate ? `${runway >= 0 ? `${runway} days of runway` : 'Event date has passed'} — draft a full task plan` : 'Set an event date to unlock the planner'}
      actions={isDone && (
        <button
          type="button"
          onClick={reset}
          className="text-xs font-bold text-slate-500 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md px-1"
        >
          Cancel
        </button>
      )}
    >
      <div aria-live="polite">
        {isIdle && (
          <div className="flex flex-wrap items-center gap-3">
            <AiButton onClick={handleGenerate} loading={isLoading} disabled={!hasDate}>
              Generate Milestone Plan
            </AiButton>
            {addedCount > 0 && (
              <span className="text-xs font-bold text-emerald-700">✓ {addedCount} milestones added to your timeline</span>
            )}
            {!hasDate && (
              <span className="text-xs text-slate-500">Add an event date in Event Details first.</span>
            )}
          </div>
        )}

        {isLoading && <AiSkeleton rows={5} />}

        {isDone && result?.data && (
          <div>
            <p className="text-sm font-semibold text-slate-800">{result.data.headline}</p>

            <ul className="mt-3 space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1" role="list">
              {result.data.tasks.map((t, i) => {
                const isSelected = selected.has(i);
                return (
                  <li key={`${t.title}-${i}`}>
                    <button
                      type="button"
                      onClick={() => toggleTask(i)}
                      aria-pressed={isSelected}
                      className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                        isSelected ? 'bg-white border-amber-300 shadow-sm' : 'bg-white/40 border-slate-200 opacity-60'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-xs font-bold text-slate-800">{t.title}</span>
                          <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium}`}>
                            {t.priority}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                            <CalendarClock className="w-3 h-3" aria-hidden="true" />
                            {friendlyDate(t.dueDate)}
                          </span>
                        </span>
                        {t.description && <span className="block text-[11px] text-slate-600 mt-1">{t.description}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <AiButton small onClick={handleAddSelected} disabled={selected.size === 0}>
                <span className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add Selected ({selected.size})
                </span>
              </AiButton>
              <button
                type="button"
                onClick={() => setSelected(new Set((result.data?.tasks || []).map((_, i) => i)))}
                className="text-xs font-bold text-slate-500 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md px-1"
              >
                Select all
              </button>
            </div>

            <AiSourceNote result={result} />
          </div>
        )}

        <AiErrorNote error={error} />
      </div>
    </AiCard>
  );
}
