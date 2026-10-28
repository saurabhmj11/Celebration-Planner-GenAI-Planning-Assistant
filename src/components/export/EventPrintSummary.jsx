import React, { useRef } from 'react';
import { useEventContext } from '../../context/EventContext';
import { EVENT_TYPES } from '../../data/defaultData';
import { calculateBudgetTotals, calculateTimelineStats } from '../../utils/calculator';
import { formatCurrency } from '../../utils/formatters';
import {
  Printer,
  Download,
  Upload
} from 'lucide-react';

export const EventPrintSummary = () => {
  const { activeEvent, exportEventsData, importEventsData, showToast } = useEventContext();
  const fileInputRef = useRef(null);
  const generatedDate = activeEvent?.date || 'Current Session';

  if (!activeEvent) return null;

  const expenses = activeEvent.expenses || [];
  const tasks = activeEvent.tasks || [];
  const vendors = activeEvent.vendors || [];

  const { totalBudget, totalSpent, remainingBudget } = calculateBudgetTotals(activeEvent);
  const { completedTasks } = calculateTimelineStats(tasks);

  const typeConfig = EVENT_TYPES.find((t) => t.id === activeEvent.type) || EVENT_TYPES[0];

  const handlePrint = () => {
    window.print();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        const res = importEventsData(content);
        if (!res.success) {
          showToast(`Import error: ${res.error}`, 'error');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="no-print bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900">
            Celebration Summary Sheet & Export
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Generate printable briefing sheets for event staff, wedding coordinators, or export backups
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>

          <button
            onClick={exportEventsData}
            className="px-4 py-2 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl transition-all flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON</span>
          </button>

          <label className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import JSON</span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Printable Sheet Content Container */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-card space-y-8 text-slate-800 print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{typeConfig.icon}</span>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {typeConfig.label} Master Plan
              </span>
            </div>
            <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">
              {activeEvent.title}
            </h1>
            {activeEvent.themeName && (
              <p className="text-sm font-semibold text-brand-700 mt-1">
                Theme: {activeEvent.themeName} {activeEvent.themeTagline ? `— ${activeEvent.themeTagline}` : ''}
              </p>
            )}
          </div>

          <div className="text-left sm:text-right text-xs text-slate-500 space-y-1">
            <p>
              Generated on: <strong>{generatedDate}</strong>
            </p>
            <p className="font-mono text-[11px]">Celebration & Event Planner</p>
          </div>
        </div>

        {/* Key Event Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Event Date & Time
            </span>
            <p className="font-bold text-slate-900 mt-0.5">
              {activeEvent.date} {activeEvent.time ? `at ${activeEvent.time}` : ''}
            </p>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Venue Location
            </span>
            <p className="font-bold text-slate-900 mt-0.5 truncate">{activeEvent.location}</p>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Guest Count
            </span>
            <p className="font-bold text-slate-900 mt-0.5">{activeEvent.guestCount} Guests</p>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Budget Status
            </span>
            <p className="font-bold text-slate-900 mt-0.5">
              {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
            </p>
          </div>
        </div>

        {/* 1. Budget Summary Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-base font-display font-extrabold text-slate-900 uppercase tracking-wider">
              Budget & Expense Summary
            </h3>
            <span className="text-xs font-bold text-slate-600">
              Remaining: {formatCurrency(remainingBudget)}
            </span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2">Item Name</th>
                <th className="py-2">Category</th>
                <th className="py-2 text-right">Allocated</th>
                <th className="py-2 text-right">Actual Spent</th>
                <th className="py-2 text-right">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((exp) => (
                <tr key={exp.id} className="py-2">
                  <td className="py-2 font-medium text-slate-800">{exp.name}</td>
                  <td className="py-2 text-slate-500 capitalize">{exp.category}</td>
                  <td className="py-2 text-right text-slate-600">
                    {formatCurrency(exp.allocated)}
                  </td>
                  <td className="py-2 text-right font-bold text-slate-900">
                    {formatCurrency(exp.spent)}
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        exp.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {exp.paid ? 'PAID' : 'PENDING'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold text-xs">
                <td colSpan={3} className="py-2.5 uppercase">
                  Total Spending
                </td>
                <td className="py-2.5 text-right font-extrabold text-slate-900">
                  {formatCurrency(totalSpent)}
                </td>
                <td className="py-2.5 text-right text-slate-500">
                  {totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}%` : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 2. Timeline & Milestones List */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-base font-display font-extrabold text-slate-900 uppercase tracking-wider">
              Timeline & Checklist
            </h3>
            <span className="text-xs text-slate-500">
              {completedTasks} of {tasks.length} tasks completed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  task.completed ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={task.completed ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                    {task.completed ? '✓' : '○'}
                  </span>
                  <span className={`truncate font-medium ${task.completed ? 'line-through' : 'text-slate-800'}`}>
                    {task.title}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                  {task.dueDate || 'No date'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Vendor Contacts Directory */}
        <div className="space-y-3 pt-4">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-base font-display font-extrabold text-slate-900 uppercase tracking-wider">
              Vendor Contacts & Directory
            </h3>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2">Vendor Name</th>
                <th className="py-2">Category</th>
                <th className="py-2">Contact Person</th>
                <th className="py-2">Phone / Email</th>
                <th className="py-2 text-right">Cost</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="py-2">
                  <td className="py-2 font-bold text-slate-800">{vendor.name}</td>
                  <td className="py-2 text-slate-500 capitalize">{vendor.category}</td>
                  <td className="py-2 text-slate-600">{vendor.contactPerson || '—'}</td>
                  <td className="py-2 text-slate-600">
                    {vendor.phone || ''} {vendor.email ? `(${vendor.email})` : ''}
                  </td>
                  <td className="py-2 text-right font-medium text-slate-900">
                    {formatCurrency(vendor.cost)}
                  </td>
                  <td className="py-2 text-right">
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {vendor.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Notes */}
        {activeEvent.notes && (
          <div className="pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-1">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] block">
              Event Notes & Vision
            </span>
            <p className="whitespace-pre-line leading-relaxed">{activeEvent.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};
