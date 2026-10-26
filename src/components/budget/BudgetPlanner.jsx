import React, { useState, useMemo } from 'react';
import { useEventContext } from '../../context/EventContext';
import { BUDGET_CATEGORIES } from '../../data/defaultData';
import { calculateBudgetTotals, calculateCategoryBreakdown } from '../../utils/calculator';
import {
  Wallet,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  Edit2,
  Trash2,
  PieChart,
  Check
} from 'lucide-react';

export const BudgetPlanner = ({ onOpenExpenseModal, onEditExpense }) => {
  const { activeEvent, deleteExpense, toggleExpensePaid } = useEventContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // all, paid, pending
  const [sortBy, setSortBy] = useState('date'); // date, spent, name

  const {
    totalBudget,
    totalSpent,
    totalAllocated,
    remainingBudget,
    isOverBudget,
    spentPct
  } = useMemo(() => calculateBudgetTotals(activeEvent), [activeEvent]);

  const expenses = useMemo(() => activeEvent?.expenses || [], [activeEvent?.expenses]);

  // Filtered & Sorted expenses
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((exp) => {
        const matchesSearch =
          exp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;
        const matchesStatus =
          selectedStatus === 'all' ||
          (selectedStatus === 'paid' && exp.paid) ||
          (selectedStatus === 'pending' && !exp.paid);
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'spent') return (b.spent || 0) - (a.spent || 0);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return (b.date || '').localeCompare(a.date || '');
      });
  }, [expenses, searchTerm, selectedCategory, selectedStatus, sortBy]);

  // Category breakdown
  const categoryStats = useMemo(() => {
    return calculateCategoryBreakdown(BUDGET_CATEGORIES, expenses, totalBudget);
  }, [expenses, totalBudget]);

  if (!activeEvent) return null;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900">
              Budget Planner
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
              {expenses.length} Expenses
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage cost allocations, actual payments, and track remaining funds for {activeEvent.title}
          </p>
        </div>

        <button
          onClick={onOpenExpenseModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-brand-500/25 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense Item</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Event Budget</p>
          <h3 className="text-2xl font-display font-black text-slate-900 mt-1">
            ${totalBudget.toLocaleString()}
          </h3>
          <p className="text-[11px] text-slate-500 mt-2">Target celebration ceiling</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Allocated</p>
          <h3 className="text-2xl font-display font-black text-indigo-600 mt-1">
            ${totalAllocated.toLocaleString()}
          </h3>
          <p className="text-[11px] text-slate-500 mt-2">
            {totalBudget > 0 ? `${Math.round((totalAllocated / totalBudget) * 100)}% of total budget` : 'No budget set'}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Actual Spent</p>
          <h3 className="text-2xl font-display font-black text-slate-900 mt-1">
            ${totalSpent.toLocaleString()}
          </h3>
          <p className="text-[11px] text-slate-500 mt-2">{spentPct}% utilized</p>
        </div>

        <div
          className={`rounded-3xl p-5 border shadow-card ${
            isOverBudget
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-wider opacity-75">Remaining Budget</p>
          <h3 className="text-2xl font-display font-black mt-1">
            ${remainingBudget.toLocaleString()}
          </h3>
          <p className="text-[11px] mt-2 font-medium">
            {isOverBudget ? `Exceeded by $${Math.abs(remainingBudget).toLocaleString()}` : 'Available for remaining tasks'}
          </p>
        </div>
      </div>

      {/* Over-budget or Warning Alert */}
      {isOverBudget && (
        <div className="p-4 rounded-2xl bg-rose-500 text-white flex items-center justify-between gap-4 shadow-lg shadow-rose-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Budget Alert: Spending Limit Exceeded</h4>
              <p className="text-xs text-rose-100">
                You have exceeded your total budget of ${totalBudget.toLocaleString()} by ${Math.abs(remainingBudget).toLocaleString()}. Consider adjusting allocations or negotiating vendor quotes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown Cards */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900">
                Category Expense Breakdown
              </h3>
              <p className="text-xs text-slate-500">Distribution of allocated vs actual costs</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {categoryStats.map((cat) => (
            <div
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? 'all' : cat.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20 shadow-sm'
                    : 'border-slate-200/70 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                    {cat.itemCount} items
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 truncate">{cat.label}</h4>
                <div className="mt-2 flex items-baseline justify-between text-xs">
                  <span className="text-slate-900 font-extrabold">${cat.spent.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500">
                    est. ${cat.allocated.toLocaleString()}
                  </span>
                </div>

                {/* Micro progress */}
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(cat.pctOfBudget, 100)}%`,
                      backgroundColor: cat.color || '#8b5cf6',
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search expenses by item name or notes..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent font-medium text-slate-700 outline-none text-xs"
              >
                <option value="all">All Categories</option>
                {BUDGET_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                onClick={() => setSelectedStatus('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedStatus === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedStatus('paid')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedStatus === 'paid' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-600'
                }`}
              >
                Paid
              </button>
              <button
                onClick={() => setSelectedStatus('pending')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedStatus === 'pending' ? 'bg-white shadow-sm text-amber-700' : 'text-slate-600'
                }`}
              >
                Pending
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent font-medium text-slate-700 outline-none text-xs"
              >
                <option value="date">Sort by Date</option>
                <option value="spent">Sort by Amount</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        {filteredExpenses.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Wallet className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No expenses found</p>
            <p className="text-xs text-slate-400">
              {searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all'
                ? 'Try clearing your filters or search term'
                : 'Click "+ Add Expense Item" to begin tracking your budget'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4">Item & Notes</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Allocated</th>
                  <th className="py-3 px-3 text-right">Actual Spent</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredExpenses.map((exp) => {
                  const cat = BUDGET_CATEGORIES.find((c) => c.id === exp.category) || BUDGET_CATEGORIES[0];

                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Paid Toggle Button */}
                      <td className="py-3.5 px-3">
                        <button
                          onClick={() => toggleExpensePaid(exp.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                            exp.paid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {exp.paid ? (
                            <>
                              <Check className="w-3 h-3" /> Paid
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" /> Pending
                            </>
                          )}
                        </button>
                      </td>

                      {/* Name & Notes */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <p className="font-bold text-slate-800">{exp.name}</p>
                        {exp.notes && (
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {exp.notes}
                          </p>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>
                      </td>

                      {/* Allocated */}
                      <td className="py-3.5 px-3 text-right font-medium text-slate-600">
                        ${Number(exp.allocated || 0).toLocaleString()}
                      </td>

                      {/* Actual Spent */}
                      <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                        ${Number(exp.spent || 0).toLocaleString()}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                        {exp.date || '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEditExpense(exp)}
                            title="Edit Expense"
                            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete expense "${exp.name}"?`)) {
                                deleteExpense(exp.id);
                              }
                            }}
                            title="Delete Expense"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
