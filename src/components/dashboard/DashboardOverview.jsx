import React from 'react';
import { useEventContext } from '../../context/EventContext';
import { CountdownBanner } from './CountdownBanner';
import { StatCards } from './StatCards';
import { QuickActionGrid } from './QuickActionGrid';
import { BUDGET_CATEGORIES } from '../../data/defaultData';
import { calculateBudgetTotals, calculateCategoryBreakdown } from '../../utils/calculator';
import { CheckCircle2, Clock, Calendar, ArrowRight, Wallet } from 'lucide-react';

export const DashboardOverview = ({
  onNavigate,
  onOpenExpenseModal,
  onOpenTaskModal,
  onOpenVendorModal,
  onEditEvent,
}) => {
  const { activeEvent, toggleTaskComplete, events, setActiveEventId } = useEventContext();

  if (!activeEvent) return null;

  const expenses = activeEvent.expenses || [];
  const tasks = activeEvent.tasks || [];

  // Urgent or pending tasks sorted by due date
  const pendingTasks = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    .slice(0, 4);

  // Budget spent by category
  const categoryTotals = calculateCategoryBreakdown(
    BUDGET_CATEGORIES,
    expenses,
    activeEvent.budget
  ).filter((c) => c.spent > 0 || c.allocated > 0);

  const { totalSpent } = calculateBudgetTotals(activeEvent);

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

      {/* 4. Split Row: Budget Snapshot & Upcoming Milestone Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Category Expense Snapshot */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">
                    Budget Distribution
                  </h3>
                  <p className="text-xs text-slate-500">Allocation across core categories</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('budget')}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                Full Planner <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {categoryTotals.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No expense items recorded yet. Click "+ Add Expense" to begin.
              </div>
            ) : (
              <div className="space-y-3.5 mt-2">
                {categoryTotals.slice(0, 5).map((cat) => {
                  const pct = totalSpent > 0 ? Math.round((cat.spent / totalSpent) * 100) : 0;
                  return (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>
                        <span className="text-slate-900 font-bold">
                          ${cat.spent.toLocaleString()}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: cat.color || '#8b5cf6',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Total Spent: <strong>${totalSpent.toLocaleString()}</strong>
            </span>
            <span className="font-semibold text-brand-600">
              Budget: ${Number(activeEvent.budget || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Right: Upcoming Milestone Tasks */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">
                    Upcoming Milestones
                  </h3>
                  <p className="text-xs text-slate-500">Priority tasks approaching due dates</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('timeline')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                All Tasks ({tasks.length}) <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                All milestone tasks are completed! Enjoy your celebration planning. 🎉
              </div>
            ) : (
              <div className="space-y-2.5 mt-2">
                {pendingTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => toggleTaskComplete(t.id)}
                        className="w-5 h-5 rounded-lg border-2 border-slate-300 hover:border-brand-500 flex items-center justify-center transition-colors bg-white shrink-0"
                      >
                        {t.completed && <CheckCircle2 className="w-4 h-4 text-brand-600" />}
                      </button>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-800 truncate">{t.title}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          Due: {t.dueDate || 'No date set'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 uppercase tracking-wider ${
                        t.priority === 'high'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : t.priority === 'low'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Completed:{' '}
              <strong>
                {tasks.filter((t) => t.completed).length} of {tasks.length}
              </strong>
            </span>
            <button
              onClick={onOpenTaskModal}
              className="font-bold text-indigo-600 hover:text-indigo-700"
            >
              + Add Milestone
            </button>
          </div>
        </div>
      </div>

      {/* 5. Switch to another event strip */}
      {events.length > 1 && (
        <div className="bg-gradient-to-r from-brand-50 via-indigo-50 to-pink-50 rounded-3xl p-5 border border-brand-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-xs font-bold text-slate-800">
                You are planning {events.length} celebrations
              </p>
              <p className="text-[11px] text-slate-500">
                Switch between your active events or create a new celebration anytime.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setActiveEventId(ev.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  ev.id === activeEvent.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {ev.title.slice(0, 20)}...
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
