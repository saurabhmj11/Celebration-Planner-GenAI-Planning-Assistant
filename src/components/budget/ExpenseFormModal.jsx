import React, { useState, useEffect } from 'react';
import { useEventContext } from '../../context/EventContext';
import { BUDGET_CATEGORIES } from '../../data/defaultData';
import { X, DollarSign, Calendar, Tag, FileText, CheckCircle2 } from 'lucide-react';

export const ExpenseFormModal = ({ isOpen, onClose, expenseToEdit = null }) => {
  const { addExpense, updateExpense } = useEventContext();

  const isEditing = Boolean(expenseToEdit);

  const [formData, setFormData] = useState(() => ({
    name: '',
    category: 'venue',
    allocated: '',
    spent: '',
    paid: false,
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  }));

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (expenseToEdit) {
      setFormData({
        name: expenseToEdit.name || '',
        category: expenseToEdit.category || 'venue',
        allocated: expenseToEdit.allocated !== undefined ? expenseToEdit.allocated : '',
        spent: expenseToEdit.spent !== undefined ? expenseToEdit.spent : '',
        paid: Boolean(expenseToEdit.paid),
        date: expenseToEdit.date || new Date().toISOString().slice(0, 10),
        notes: expenseToEdit.notes || '',
      });
      setErrors({});
    } else {
      setFormData({
        name: '',
        category: 'venue',
        allocated: '',
        spent: '',
        paid: false,
        date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      setErrors({});
    }
  }, [expenseToEdit, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Expense item name is required.';
    if (formData.allocated === '' && formData.spent === '') {
      errs.allocated = 'Enter either an estimated allocation or actual spent amount.';
    }
    if (Number(formData.allocated) < 0) errs.allocated = 'Amount cannot be negative.';
    if (Number(formData.spent) < 0) errs.spent = 'Amount cannot be negative.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...formData,
      allocated: Number(formData.allocated) || 0,
      spent: Number(formData.spent) || 0,
    };

    if (isEditing) {
      updateExpense(expenseToEdit.id, payload);
    } else {
      addExpense(payload);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-brand-700 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <DollarSign className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 id="expense-modal-title" className="font-display font-bold text-lg">
                {isEditing ? 'Edit Expense Item' : 'Add New Expense Item'}
              </h3>
              <p className="text-xs text-brand-100">
                Track allocated budget vs actual payments
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close expense dialog"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Expense Item Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Reception Venue Deposit, Floral Garland, DJ Sound"
              className={`w-full px-4 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                errors.name ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
              }`}
            />
            {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-brand-600" />
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            >
              {BUDGET_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Allocated vs Spent */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Allocated ($)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={formData.allocated}
                onChange={(e) => setFormData({ ...formData, allocated: e.target.value })}
                placeholder="1500"
                className={`w-full px-4 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                  errors.allocated ? 'border-rose-400' : 'border-slate-200'
                }`}
              />
              {errors.allocated && <p className="text-xs text-rose-500 mt-1">{errors.allocated}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Actual Spent ($)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={formData.spent}
                onChange={(e) => setFormData({ ...formData, spent: e.target.value })}
                placeholder="1450"
                className={`w-full px-4 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                  errors.spent ? 'border-rose-400' : 'border-slate-200'
                }`}
              />
              {errors.spent && <p className="text-xs text-rose-500 mt-1">{errors.spent}</p>}
            </div>
          </div>

          {/* Payment Date & Paid Checkbox */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
              />
            </div>

            <div className="pt-5 sm:pt-6">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.paid}
                  onChange={(e) => setFormData({ ...formData, paid: e.target.checked })}
                  className="w-5 h-5 rounded-lg text-brand-600 border-slate-300 focus:ring-brand-500"
                />
                <span className="text-xs font-bold text-slate-700">
                  Mark as Paid / Invoiced
                </span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              Notes / Vendor Reference
            </label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. 50% deposit paid, final due 2 weeks before event"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 rounded-xl shadow-md shadow-brand-500/25 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isEditing ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
