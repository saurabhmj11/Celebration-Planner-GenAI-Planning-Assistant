import React from 'react';
import { DollarSign, CheckCircle2, Users, Building2 } from 'lucide-react';
import {
  calculateBudgetTotals,
  calculateTimelineStats,
  calculateVendorStats
} from '../../utils/calculator';

export const StatCards = ({ event, onNavigate }) => {
  if (!event) return null;

  const {
    totalBudget,
    totalSpent,
    totalAllocated,
    remainingBudget,
    spentPct: budgetSpentPct,
    isOverBudget,
    costPerGuest
  } = calculateBudgetTotals(event);

  const isBudgetWarning = !isOverBudget && totalSpent > totalBudget * 0.85;

  const { totalTasks, completedTasks, progressPct: taskPct } = calculateTimelineStats(event.tasks);
  const { totalVendors, bookedCount: bookedVendors } = calculateVendorStats(event.vendors);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* 1. Total Budget & Remaining Card */}
      <div
        onClick={() => onNavigate('budget')}
        className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all cursor-pointer group relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="p-2.5 rounded-2xl bg-brand-50 text-brand-600 group-hover:scale-110 transition-transform">
            <DollarSign className="w-5 h-5" />
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              isOverBudget
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : isBudgetWarning
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {isOverBudget ? 'Over Budget' : `${budgetSpentPct}% Spent`}
          </span>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Budget</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-display font-extrabold text-slate-900">
              ${totalBudget.toLocaleString()}
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Spent: ${totalSpent.toLocaleString()}</span>
            <span
              className={`font-semibold ${
                isOverBudget ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              Remaining: ${remainingBudget.toLocaleString()}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverBudget ? 'bg-rose-500' : isBudgetWarning ? 'bg-amber-500' : 'bg-brand-600'
              }`}
              style={{ width: `${Math.min(budgetSpentPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Tasks Progress Card */}
      <div
        onClick={() => onNavigate('timeline')}
        className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            {taskPct}% Done
          </span>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Timeline Tasks</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-display font-extrabold text-slate-900">
              {completedTasks} / {totalTasks}
            </h3>
            <span className="text-xs text-slate-500">completed</span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{totalTasks - completedTasks} pending</span>
            <span className="font-semibold text-indigo-600">View Timeline →</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${taskPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Booked Vendors Card */}
      <div
        onClick={() => onNavigate('vendors')}
        className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
            <Building2 className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {bookedVendors} Booked
          </span>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vendor Checklist</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-display font-extrabold text-slate-900">
              {bookedVendors} / {totalVendors}
            </h3>
            <span className="text-xs text-slate-500">partners</span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{totalVendors - bookedVendors} exploring</span>
            <span className="font-semibold text-rose-600">Review Vendors →</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-500"
              style={{ width: totalVendors > 0 ? `${(bookedVendors / totalVendors) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* 4. Guests & Per-Guest Investment */}
      <div
        onClick={() => onNavigate('budget')}
        className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            ${costPerGuest} / Guest
          </span>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Guest Count</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-display font-extrabold text-slate-900">
              {event.guestCount || 0}
            </h3>
            <span className="text-xs text-slate-500">attendees</span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Allocated: ${totalAllocated.toLocaleString()}</span>
            <span className="font-semibold text-amber-600">Smart Budget →</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
