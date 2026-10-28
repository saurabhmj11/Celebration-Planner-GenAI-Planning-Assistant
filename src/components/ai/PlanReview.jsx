import React, { useMemo } from 'react';
import { ShieldCheck, AlertTriangle, ArrowRightCircle, CheckCircle2 } from 'lucide-react';
import { useEventContext } from '../../context/EventContext';
import { VENDOR_CATEGORIES } from '../../data/defaultData';
import {
  calculateBudgetTotals,
  calculateTimelineStats,
  calculateVendorStats,
} from '../../utils/calculator';
import { aiAssist } from '../../services/aiAssist';
import { AiButton, AiCard, AiErrorNote, AiSkeleton, AiSourceNote, daysUntil, useAiRequest } from './aiKit';

const SCORE_COLORS = {
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  risk: 'text-rose-600',
};

function scoreTone(score) {
  return score >= 70 ? SCORE_COLORS.good : score >= 40 ? SCORE_COLORS.warn : SCORE_COLORS.risk;
}

/** Compact SVG readiness ring. */
function ScoreRing({ score }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, score));
  const tone = scoreTone(score);
  return (
    <div className="relative w-20 h-20 shrink-0" role="img" aria-label={`Readiness score ${score} out of 100`}>
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200" />
        <circle
          cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * filled) / 100}
          className={score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-rose-500'}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display font-black text-lg leading-none ${tone}`}>{score}</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">score</span>
      </div>
    </div>
  );
}

/**
 * AI Plan Review — a readiness audit of the whole event (budget discipline,
 * runway, vendor lock-in, task completion) with prioritized next actions.
 */
export function PlanReview() {
  const { activeEvent } = useEventContext();
  const { status, result, error, run, isLoading, isIdle, isDone } = useAiRequest();

  const context = useMemo(() => {
    if (!activeEvent) return null;
    const totals = calculateBudgetTotals(activeEvent);
    const taskStats = calculateTimelineStats(activeEvent.tasks || []);
    const vendorStats = calculateVendorStats(activeEvent.vendors || []);
    const runway = daysUntil(activeEvent.date);
    const upcoming = (activeEvent.tasks || [])
      .filter((t) => !t.completed && t.dueDate)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
      .slice(0, 5)
      .map((t) => ({ title: t.title, dueDate: t.dueDate }));
    const unbooked = [...new Set(
      (activeEvent.vendors || [])
        .filter((v) => v.status !== 'booked' && v.status !== 'deposit_paid')
        .map((v) => VENDOR_CATEGORIES.find((c) => c.id === v.category)?.label || v.category)
    )];
    return { totals, taskStats, vendorStats, runway, upcoming, unbooked };
  }, [activeEvent]);

  if (!activeEvent || !context) return null;

  const handleRun = () => run(() =>
    aiAssist.planReview({
      eventType: activeEvent.type || 'other',
      eventTitle: activeEvent.title || 'Untitled celebration',
      eventDate: activeEvent.date || new Date().toISOString().slice(0, 10),
      daysUntilEvent: context.runway,
      totalBudget: activeEvent.budget || 0,
      spentSoFar: context.totals.totalSpent || 0,
      guestCount: activeEvent.guestCount || 0,
      taskStats: { total: context.taskStats.totalTasks, completed: context.taskStats.completedTasks },
      vendorStats: { total: context.vendorStats.totalVendors, booked: context.vendorStats.bookedCount },
      upcomingTasks: context.upcoming,
      unbookedCategories: context.unbooked,
    })
  );

  return (
    <AiCard
      id="plan-review"
      icon={ShieldCheck}
      title="AI Plan Review"
      subtitle="Readiness audit of budget, runway, vendors & tasks"
      actions={
        <AiButton small onClick={handleRun} loading={isLoading}>
          {isDone ? 'Refresh' : 'Run Review'}
        </AiButton>
      }
    >
      <div aria-live="polite">
        {isIdle && (
          <p className="text-sm text-slate-600">
            Get an honest readiness score for <span className="font-semibold text-slate-800">{activeEvent.title}</span> —
            strengths, risks you haven't spotted, and the next actions that matter most.
          </p>
        )}

        {isLoading && <AiSkeleton rows={4} />}

        {isDone && result?.data && (
          <div>
            <div className="flex items-start gap-4">
              <ScoreRing score={result.data.score} />
              <p className="text-xs text-slate-700 flex-1 min-w-0">{result.data.summary}</p>
            </div>

            <div className="mt-4 grid gap-2.5">
              {result.data.strengths.length > 0 && (
                <ul className="space-y-1.5">
                  {result.data.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
              {result.data.risks.length > 0 && (
                <ul className="space-y-1.5">
                  {result.data.risks.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-700">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
              {result.data.nextActions.length > 0 && (
                <ol className="space-y-1.5 bg-white/80 border border-amber-100 rounded-2xl p-3">
                  {result.data.nextActions.map((a, i) => (
                    <li key={i} className="flex gap-2 text-xs font-medium text-slate-800">
                      <ArrowRightCircle className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <AiSourceNote result={result} />
          </div>
        )}

        <AiErrorNote error={error} />
      </div>
    </AiCard>
  );
}
