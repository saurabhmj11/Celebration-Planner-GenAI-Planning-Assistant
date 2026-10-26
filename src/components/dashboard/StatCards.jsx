import React, { memo } from 'react';
import { DollarSign, CheckCircle2, Users, Building2 } from 'lucide-react';
import {
  calculateBudgetTotals,
  calculateTimelineStats,
  calculateVendorStats,
} from '../../utils/calculator';
import { formatCurrency } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';

/**
 * Shared stat-card shell — a real <button> so the whole card is keyboard
 * focusable and screen-reader operable (previously a clickable <div>).
 */
const StatCard = ({ onClick, onNavigate, ariaLabel, icon, iconTone, badge, value, label, sublabel, caption, progress, progressTone }) => (
  <button
    type="button"
    onClick={onClick || onNavigate}
    aria-label={ariaLabel}
    className="text-left bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-all cursor-pointer group relative overflow-hidden w-full"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-2.5 rounded-2xl ${iconTone} group-hover:scale-110 transition-transform`} aria-hidden="true">
        {icon}
      </div>
      {badge}
    </div>

    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <h3 className="text-2xl font-display font-extrabold text-slate-900">{value}</h3>
        {sublabel && <span className="text-xs text-slate-500">{sublabel}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{caption}</span>
        <span className="font-semibold text-brand-700 group-hover:text-brand-800">
          Open →
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} progress`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressTone}`}
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
    </div>
  </button>
);

const StatCardsComponent = ({ event, onNavigate }) => {
  if (!event) return null;

  const {
    totalBudget,
    totalSpent,
    totalAllocated,
    remainingBudget,
    spentPct: budgetSpentPct,
    isOverBudget,
    costPerGuest,
  } = calculateBudgetTotals(event);

  const isBudgetWarning = !isOverBudget && totalSpent > totalBudget * 0.85;

  const { totalTasks, completedTasks, progressPct: taskPct } = calculateTimelineStats(event.tasks);
  const { totalVendors, bookedCount: bookedVendors } = calculateVendorStats(event.vendors);

  const vendorPct = totalVendors > 0 ? Math.round((bookedVendors / totalVendors) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* 1. Total Budget & Remaining */}
      <StatCard
        onClick={() => onNavigate('budget')}
        ariaLabel={`Budget planner. ${formatCurrency(totalBudget)} total, ${formatCurrency(totalSpent)} spent, ${formatCurrency(remainingBudget)} remaining. Open budget planner.`}
        icon={<DollarSign className="w-5 h-5" />}
        iconTone="bg-brand-50 text-brand-600"
        badge={
          <StatusBadge variant={isOverBudget ? 'danger' : isBudgetWarning ? 'warning' : 'success'}>
            {isOverBudget ? 'Over Budget' : `${budgetSpentPct}% Spent`}
          </StatusBadge>
        }
        value={formatCurrency(totalBudget)}
        label="Total Budget"
        caption={
          <>
            Spent: {formatCurrency(totalSpent)}
          </>
        }
        progress={budgetSpentPct}
        progressTone={isOverBudget ? 'bg-rose-500' : isBudgetWarning ? 'bg-amber-500' : 'bg-brand-600'}
      />

      {/* 2. Tasks Progress */}
      <StatCard
        onClick={() => onNavigate('timeline')}
        ariaLabel={`Timeline tasks. ${completedTasks} of ${totalTasks} completed. Open timeline.`}
        icon={<CheckCircle2 className="w-5 h-5" />}
        iconTone="bg-brand-50 text-brand-600"
        badge={<StatusBadge variant="info">{taskPct}% Done</StatusBadge>}
        value={`${completedTasks} / ${totalTasks}`}
        sublabel="completed"
        label="Timeline Tasks"
        caption={<>{totalTasks - completedTasks} pending</>}
        progress={taskPct}
        progressTone="bg-brand-600"
      />

      {/* 3. Booked Vendors */}
      <StatCard
        onClick={() => onNavigate('vendors')}
        ariaLabel={`Vendor checklist. ${bookedVendors} of ${totalVendors} vendors booked. Open vendor checklist.`}
        icon={<Building2 className="w-5 h-5" />}
        iconTone="bg-brand-50 text-brand-600"
        badge={
          <StatusBadge variant={bookedVendors === totalVendors && totalVendors > 0 ? 'success' : 'neutral'}>
            {bookedVendors} Booked
          </StatusBadge>
        }
        value={`${bookedVendors} / ${totalVendors}`}
        sublabel="partners"
        label="Vendor Checklist"
        caption={<>{totalVendors - bookedVendors} exploring</>}
        progress={vendorPct}
        progressTone="bg-emerald-500"
      />

      {/* 4. Guests & Per-Guest Investment */}
      <StatCard
        onClick={() => onNavigate('budget')}
        ariaLabel={`Guest count ${event.guestCount || 0}, cost per guest ${formatCurrency(costPerGuest)}. Open budget planner.`}
        icon={<Users className="w-5 h-5" />}
        iconTone="bg-brand-50 text-brand-600"
        badge={<StatusBadge variant="neutral">{formatCurrency(costPerGuest)} / Guest</StatusBadge>}
        value={String(event.guestCount || 0)}
        sublabel="attendees"
        label="Guest Count"
        caption={<>Allocated: {formatCurrency(totalAllocated)}</>}
        progress={100}
        progressTone="bg-brand-400"
      />
    </div>
  );
};

// Memo: recomputes only when the event object identity changes.
export const StatCards = memo(StatCardsComponent);
