import React, { useMemo, useState } from 'react';
import { Wallet, Plus, CheckCircle2 } from 'lucide-react';
import { useEventContext } from '../../context/EventContext';
import { BUDGET_CATEGORIES } from '../../data/defaultData';
import { calculateBudgetTotals } from '../../utils/calculator';
import { aiAssist } from '../../services/aiAssist';
import { formatCurrency } from '../../utils/formatters';
import { AiButton, AiCard, AiErrorNote, AiSkeleton, AiSourceNote, mapCategoryToFallback, useAiRequest } from './aiKit';

const money = (n) => formatCurrency(n);

/**
 * AI Budget Copilot — smart allocation plan + savings tips for the active
 * event, applicable as real budget lines in one click.
 */
export function BudgetCopilot() {
  const { activeEvent, addExpense, showToast } = useEventContext();
  const { status, result, error, run, reset, isIdle, isLoading, isDone } = useAiRequest();
  const [applied, setApplied] = useState(false);

  const totals = useMemo(
    () => calculateBudgetTotals(activeEvent),
    [activeEvent]
  );

  const existingNames = useMemo(
    () => new Set((activeEvent?.expenses || []).map((e) => String(e.name || '').toLowerCase().trim())),
    [activeEvent?.expenses]
  );

  if (!activeEvent) return null;

  const handleGenerate = () => run(() =>
    aiAssist.budgetPlan({
      eventType: activeEvent.type || 'other',
      totalBudget: activeEvent.budget || 0,
      guestCount: activeEvent.guestCount || 0,
      spentSoFar: totals.totalSpent || 0,
    })
  );

  const handleApply = () => {
    const allocations = result?.data?.allocations || [];
    let added = 0;
    for (const alloc of allocations) {
      const name = `${alloc.category} (AI plan)`;
      if (existingNames.has(name.toLowerCase())) continue;
      addExpense({
        name,
        category: mapCategoryToFallback(alloc.category, BUDGET_CATEGORIES) || 'miscellaneous',
        allocated: Math.round(((activeEvent.budget || 0) * alloc.percent) / 100),
        spent: 0,
        paid: false,
        date: new Date().toISOString().slice(0, 10),
        notes: alloc.rationale,
      });
      added += 1;
    }
    if (added > 0) {
      showToast(`AI Budget Copilot added ${added} planned expense line${added === 1 ? '' : 's'}! ✨`, 'success');
      setApplied(true);
    } else {
      showToast('All suggested budget lines already exist.', 'info');
    }
  };

  return (
    <AiCard
      id="budget-copilot"
      icon={Wallet}
      title="AI Budget Copilot"
      subtitle={`Smart allocation strategy for your ${money(activeEvent.budget || 0)} budget`}
      actions={isDone && (
        <button
          type="button"
          onClick={() => { reset(); setApplied(false); }}
          className="text-xs font-bold text-slate-500 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md px-1"
        >
          Clear
        </button>
      )}
    >
      <div aria-live="polite">
        {isIdle && (
          <div>
            <p className="text-sm text-slate-600">
              Get a personalized allocation plan — category splits sized to your guest count, your
              event type, and what you've already spent — plus concrete money-saving tactics.
            </p>
            <div className="mt-4">
              <AiButton onClick={handleGenerate} loading={isLoading}>
                Get AI Budget Plan
              </AiButton>
            </div>
          </div>
        )}

        {isLoading && <AiSkeleton rows={4} />}

        {isDone && result?.data && (
          <div>
            <p className="text-sm font-semibold text-slate-800">{result.data.headline}</p>

            <ul className="mt-4 space-y-3">
              {result.data.allocations.map((a) => (
                <li key={a.category} className="bg-white/80 border border-amber-100 rounded-2xl p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">{a.category}</span>
                    <span className="text-xs font-bold text-amber-700 shrink-0">
                      {money(((activeEvent.budget || 0) * a.percent) / 100)} · {a.percent}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden" role="presentation">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400"
                      style={{ width: `${Math.min(100, a.percent * 1.6)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2">{a.rationale}</p>
                </li>
              ))}
            </ul>

            <div className="mt-4 bg-white/80 border border-amber-100 rounded-2xl p-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Saving Tips</p>
              <ul className="space-y-1.5">
                {result.data.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <AiButton small onClick={handleApply}>
                {applied ? <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Added</span> : <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" aria-hidden="true" /> Add as budget lines</span>}
              </AiButton>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-xs font-bold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md px-1"
              >
                Regenerate
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
