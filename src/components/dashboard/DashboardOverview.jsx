import React, { useMemo, memo } from 'react';
import { Wallet, Clock, ArrowRight } from 'lucide-react';
import { useEventContext } from '../../context/EventContext';
import { CountdownBanner } from './CountdownBanner';
import { StatCards } from './StatCards';
import { QuickActionGrid } from './QuickActionGrid';
import { PlanReview } from '../ai/PlanReview';
import { BUDGET_CATEGORIES, EVENT_TYPES } from '../../data/defaultData';
import {
  calculateBudgetTotals,
  calculateCategoryBreakdown,
  getDueDateUrgency,
} from '../../utils/calculator';
import { formatCurrency, formatShortDate, truncateText } from '../../utils/formatters';

/**
 * Polished, reusable empty state.
 */
const EmptyState = ({ icon, title, hint, action }) => (
  <div className="py-8 text-center">
    <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3" aria-hidden="true">
      {icon}
    </div>
    <p className="text-xs font-bold text-slate-600">{title}</p>
    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">{hint}</p>
    {action}
  </div>
);

const DashboardOverviewComponent = ({
  onNavigate,
  onOpenExpenseModal,
  onOpenTaskModal,
  onOpenVendorModal,
  onEditEvent,
  onOpenNewEvent,
}) => {
  const { activeEvent, toggleTaskComplete, events, setActiveEventId } = useEventContext();

  const derived = useMemo(() => {
    if (!activeEvent) return null;

    const expenses = activeEvent.expenses || [];
    const tasks = activeEvent.tasks || [];

    // Urgent or pending tasks sorted by due date
    const pendingTasks = [...tasks]
      .filter((t) => !t.completed)
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
      .slice(0, 4);

    // Budget spent by category
    const categoryTotals = calculateCategoryBreakdown(
      BUDGET_CATEGORIES,
      expenses,
      activeEvent.budget
    ).filter((c) => c.spent > 0 || c.allocated > 0);

    const { totalSpent, totalBudget } = calculateBudgetTotals(activeEvent);

    return { expenses, tasks, pendingTasks, categoryTotals, totalSpent, totalBudget };
  }, [activeEvent]);

  if (!activeEvent || !derived) {
    return (
      <section className="text-center py-16">
        <h2 className="font-display font-bold text-xl text-slate-800">No celebration yet</h2>
        <p className="text-sm text-slate-500 mt-2">
          Create your first wedding, birthday, or community event to get started.
        </p>
        <button
          type="button"
          onClick={onOpenNewEvent}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          + Create Your First Celebration
        </button>
      </section>
    );
  }

  const { tasks, pendingTasks, categoryTotals, totalSpent, totalBudget } = derived;
  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Countdown Banner */}
      <CountdownBanner
        event={activeEvent}
        onEditEvent={onEditEvent}
        onOpenAiStudio={() => onNavigate('ai')}
      />

      {/* 2. Key Metrics Stats Cards */}
      <StatCards event={activeEvent} onNavigate={onNavigate} />

      {/* 3. Quick Actions Grid */}
      <QuickActionGrid
        onAddExpense={onOpenExpenseModal}
        onAddTask={onOpenTaskModal}
        onAddVendor={onOpenVendorModal}
        onOpenAiStudio={() => onNavigate('ai')}
        onOpenPrint={() => onNavigate('print')}
        onEditEvent={onEditEvent}
      />

      {/* 3.5 AI Plan Review — readiness audit */}
      <PlanReview />

      {/* 4. Split Row: Budget Snapshot & Upcoming Milestone Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Category Expense Snapshot */}
        <section
          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between"
          aria-labelledby="budget-dist-heading"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600" aria-hidden="true">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="budget-dist-heading" className="font-display font-bold text-lg text-slate-900">
                    Budget Distribution
                  </h3>
                  <p className="text-xs text-slate-500">Allocation across core categories</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('budget')}
                className="text-xs font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
              >
                Full Planner <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {categoryTotals.length === 0 ? (
              <EmptyState
                icon={<span className="text-xl">💰</span>}
                title="No expense items recorded yet"
                hint="Track your first venue deposit or catering quote to see live budget distribution."
                action={
                  <button
                    type="button"
                    onClick={onOpenExpenseModal}
                    className="mt-3 text-xs font-bold text-brand-700 hover:text-brand-800 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
                  >
                    + Add your first expense
                  </button>
                }
              />
            ) : (
              <ul className="space-y-3.5 mt-2 list-none">
                {categoryTotals.slice(0, 5).map((cat) => {
                  const pct = totalSpent > 0 ? Math.round((cat.spent / totalSpent) * 100) : 0;
                  return (
                    <li key={cat.id}>
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <span aria-hidden="true">{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>
                        <span className="text-slate-900 font-bold">
                          {formatCurrency(cat.spent)}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div
                        className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-1"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${cat.label} share of spending`}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: cat.color || '#8b5cf6' }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Total Spent: <strong className="text-slate-800">{formatCurrency(totalSpent)}</strong>
            </span>
            <span className="font-semibold text-brand-700">
              Budget: {formatCurrency(totalBudget)}
            </span>
          </div>
        </section>

        {/* Right: Upcoming Milestone Tasks */}
        <section
          className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between"
          aria-labelledby="milestones-heading"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600" aria-hidden="true">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="milestones-heading" className="font-display font-bold text-lg text-slate-900">
                    Upcoming Milestones
                  </h3>
                  <p className="text-xs text-slate-500">Priority tasks approaching due dates</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('timeline')}
                className="text-xs font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
              >
                All Tasks ({tasks.length}) <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {pendingTasks.length === 0 ? (
              <EmptyState
                icon={<span className="text-xl">🎉</span>}
                title="All milestone tasks are completed!"
                hint="Everything is on track. Add a new milestone if plans evolve."
                action={
                  <button
                    type="button"
                    onClick={onOpenTaskModal}
                    className="mt-3 text-xs font-bold text-brand-700 hover:text-brand-800 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
                  >
                    + Add a milestone
                  </button>
                }
              />
            ) : (
              <ul className="space-y-2.5 mt-2 list-none">
                {pendingTasks.map((t) => {
                  const urgency = getDueDateUrgency(t.dueDate);
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleTaskComplete(t.id)}
                          aria-label={`Mark task "${t.title}" as complete`}
                          className="w-5 h-5 rounded-lg border-2 border-slate-300 hover:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 flex items-center justify-center transition-colors bg-white shrink-0"
                        >
                          <span className="sr-only">Complete</span>
                        </button>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-slate-800 truncate">{t.title}</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            {urgency ? (
                              <span
                                className={`inline-block rounded-full px-1.5 py-px font-bold ${urgency.color}`}
                              >
                                {urgency.label}
                              </span>
                            ) : (
                              <span>Due: {formatShortDate(t.dueDate)}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 uppercase tracking-wider ${
                          t.priority === 'high'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : t.priority === 'low'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Completed: <strong className="text-slate-800">{completedCount} of {tasks.length}</strong>
            </span>
            <button
              type="button"
              onClick={onOpenTaskModal}
              className="font-bold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
            >
              + Add Milestone
            </button>
          </div>
        </section>
      </div>

      {/* 5. Switch to another event strip */}
      {events.length > 1 && (
        <section
          className="bg-gradient-to-r from-brand-50 via-brand-50/60 to-pink-50 rounded-3xl p-5 border border-brand-100 flex flex-col sm:flex-row items-center justify-between gap-4"
          aria-label="Switch between your celebrations"
        >
          <div className="flex items-center gap-3 text-center sm:text-left">
            <span className="text-2xl" aria-hidden="true">🎉</span>
            <div>
              <p className="text-xs font-bold text-slate-800">
                You are planning {events.length} celebrations
              </p>
              <p className="text-[11px] text-slate-500">
                Switch between your active events or create a new celebration anytime.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {events.map((ev) => {
              const type = EVENT_TYPES.find((t) => t.id === ev.type);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setActiveEventId(ev.id)}
                  aria-pressed={ev.id === activeEvent.id}
                  title={ev.title}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
                    ev.id === activeEvent.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span aria-hidden="true">{type?.icon} </span>
                  {truncateText(ev.title, 22)}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

// Memo: the overview recomputes only when the active event or events change.
export const DashboardOverview = memo(DashboardOverviewComponent);
