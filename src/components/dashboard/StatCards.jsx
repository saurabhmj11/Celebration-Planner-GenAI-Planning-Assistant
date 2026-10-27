import React, { memo } from 'react';
import { DollarSign, CheckCircle2, UsersRound, Building2 } from 'lucide-react';
import {
  calculateBudgetTotals,
  calculateTimelineStats,
  calculateVendorStats,
  calculateGuestStats,
} from '../../utils/calculator';
import { formatCurrency } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import { useCelebrationMood } from '../../hooks/useCelebrationMood';

/**
 * Shared stat-card shell — a real <button> so the whole card is keyboard
 * focusable and screen-reader operable (previously a clickable <div>).
 */
const StatCard = ({ onClick, onNavigate, ariaLabel, icon, badge, value, label, sublabel, caption, progress, progressTone, progressColor, accent, accentSoft }) => (
  <button
    type="button"
    onClick={onClick || onNavigate}
    aria-label={ariaLabel}
    className="text-left bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-all cursor-pointer group relative overflow-hidden w-full"
  >
    <div className="flex items-center justify-between mb-4">
      {/* Icon tile tinted by the celebration mood (party + venue + theme). */}
      <div
        className="p-2.5 rounded-2xl group-hover:scale-110 transition-transform"
        style={{ backgroundColor: accentSoft, color: accent }}
        aria-hidden="true"
      >
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
        <span className="font-semibold group-hover:opacity-80" style={{ color: accent }}>
          Open →
        </span>
      </div>

      {/* Progress bar — semantic tones (over-budget/warning) stay put;
          neutral fills take on the celebration accent. */}
      <div
        className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} progress`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressColor ? '' : progressTone}`}
          style={{
            width: `${Math.min(Math.max(progress, 0), 100)}%`,
            ...(progressColor ? { backgroundColor: progressColor } : null),
          }}
        />
      </div>
    </div>
  </button>
);

const StatCardsComponent = ({ event, onNavigate }) => {
  const mood = useCelebrationMood();

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

  const guestStats = calculateGuestStats(event.guests);
  const costPerAttending =
    guestStats.attendingHeadcount > 0 ? totalAllocated / guestStats.attendingHeadcount : costPerGuest;

  const vendorPct = totalVendors > 0 ? Math.round((bookedVendors / totalVendors) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* 1. Total Budget & Remaining */}
      <StatCard
        onClick={() => onNavigate('budget')}
        ariaLabel={`Budget planner. ${formatCurrency(totalBudget)} total, ${formatCurrency(totalSpent)} spent, ${formatCurrency(remainingBudget)} remaining. Open budget planner.`}
        icon={<DollarSign className="w-5 h-5" />}
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
        progressTone={isOverBudget ? 'bg-rose-500' : isBudgetWarning ? 'bg-amber-500' : ''}
        progressColor={!isOverBudget && !isBudgetWarning ? mood.accent : undefined}
        accent={mood.accent}
        accentSoft={mood.accentSoft}
      />

      {/* 2. Tasks Progress */}
      <StatCard
        onClick={() => onNavigate('timeline')}
        ariaLabel={`Timeline tasks. ${completedTasks} of ${totalTasks} completed. Open timeline.`}
        icon={<CheckCircle2 className="w-5 h-5" />}
        badge={<StatusBadge variant="info">{taskPct}% Done</StatusBadge>}
        value={`${completedTasks} / ${totalTasks}`}
        sublabel="completed"
        label="Timeline Tasks"
        caption={<>{totalTasks - completedTasks} pending</>}
        progress={taskPct}
        progressColor={mood.accent}
        accent={mood.accent}
        accentSoft={mood.accentSoft}
      />

      {/* 3. Booked Vendors */}
      <StatCard
        onClick={() => onNavigate('vendors')}
        ariaLabel={`Vendor checklist. ${bookedVendors} of ${totalVendors} vendors booked. Open vendor checklist.`}
        icon={<Building2 className="w-5 h-5" />}
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
        accent={mood.accent}
        accentSoft={mood.accentSoft}
      />

      {/* 4. Live Headcount & Per-Seat Investment — RSVPs flow into the budget */}
      <StatCard
        onClick={() => onNavigate('guests')}
        ariaLabel={`Live headcount ${guestStats.attendingHeadcount} of ${guestStats.totalGuests} guests confirmed, ${guestStats.pending} awaiting reply, cost per attending seat ${formatCurrency(costPerAttending)}. Open guest list.`}
        icon={<UsersRound className="w-5 h-5" />}
        badge={
          <StatusBadge variant={guestStats.pending > 0 ? 'warning' : 'success'}>
            {guestStats.pending > 0 ? `${guestStats.pending} Awaiting` : 'All replied'}
          </StatusBadge>
        }
        value={String(guestStats.attendingHeadcount)}
        sublabel={`of ${guestStats.totalGuests} invited`}
        label="Live Headcount"
        caption={
          <>
            {formatCurrency(costPerAttending)} / seat · {guestStats.responseRate}% replied
          </>
        }
        progress={guestStats.totalGuests > 0 ? (guestStats.attendingHeadcount / guestStats.totalGuests) * 100 : 0}
        progressColor={mood.accent}
        accent={mood.accent}
        accentSoft={mood.accentSoft}
      />
    </div>
  );
};

// Memo: recomputes only when the event object identity changes.
export const StatCards = memo(StatCardsComponent);
