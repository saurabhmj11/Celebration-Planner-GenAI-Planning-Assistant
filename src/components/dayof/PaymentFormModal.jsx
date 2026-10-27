import React, { useState, useEffect } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useEventContext } from '../../context/EventContext';
import { X, CreditCard, CheckCircle2 } from 'lucide-react';

const KINDS = [
  { id: 'deposit', label: 'Deposit' },
  { id: 'balance', label: 'Balance' },
  { id: 'milestone', label: 'Milestone' },
  { id: 'final', label: 'Final payment' },
];

/** Add / edit a payment milestone on the active event's ledger. */
export const PaymentFormModal = ({ isOpen, onClose, paymentToEdit = null }) => {
  const { activeEvent, addPayment, updatePayment } = useEventContext();
  const isEditing = Boolean(paymentToEdit);

  const EMPTY = {
    label: '',
    vendorName: '',
    amount: '',
    kind: 'deposit',
    dueDate: '',
    notes: '',
  };

  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (paymentToEdit) {
      setFormData({
        label: paymentToEdit.label || '',
        vendorName: paymentToEdit.vendorName || '',
        amount: paymentToEdit.amount ?? '',
        kind: paymentToEdit.kind || 'deposit',
        dueDate: paymentToEdit.dueDate || '',
        notes: paymentToEdit.notes || '',
      });
    } else {
      setFormData({ ...EMPTY, dueDate: activeEvent?.date || '' });
    }
    setErrors({});
  }, [paymentToEdit, isOpen]);

  const panelRef = useModalFocus(isOpen, onClose);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!String(formData.label).trim()) errs.label = 'Describe what this payment is for.';
    const amount = Number(formData.amount);
    if (formData.amount === '' || !Number.isFinite(amount) || amount < 0) errs.amount = 'Enter a valid amount.';
    if (formData.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(formData.dueDate)) errs.dueDate = 'Use a valid date.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      ...formData,
      amount: Math.max(0, Math.round(Number(formData.amount) || 0)),
    };
    if (isEditing) updatePayment(paymentToEdit.id, payload);
    else addPayment(payload);
    onClose();
  };

  const inputCls = 'w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all';
  const labelCls = 'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5';

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <CreditCard className="w-5 h-5 text-emerald-200" aria-hidden="true" />
            </div>
            <div>
              <h3 id="payment-modal-title" className="font-display font-bold text-lg">
                {isEditing ? 'Edit Payment' : 'Add a Payment'}
              </h3>
              <p className="text-xs text-emerald-100">Deposits, balances &amp; due dates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment dialog"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls} htmlFor="payment-label">
              What is this payment for? <span className="text-rose-500">*</span>
            </label>
            <input
              id="payment-label"
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g. Catering — final headcount balance"
              className={`w-full px-4 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                errors.label ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
              }`}
            />
            {errors.label && <p className="text-xs text-rose-500 mt-1">{errors.label}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="payment-vendor">
                Vendor (optional)
              </label>
              <input
                id="payment-vendor"
                type="text"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="e.g. Botanica Flora"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="payment-kind">
                Type
              </label>
              <select
                id="payment-kind"
                value={formData.kind}
                onChange={(e) => setFormData({ ...formData, kind: e.target.value })}
                className={inputCls}
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="payment-amount">
                Amount ($) <span className="text-rose-500">*</span>
              </label>
              <input
                id="payment-amount"
                type="number"
                min="0"
                step="1"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="1650"
                className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                  errors.amount ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                }`}
              />
              {errors.amount && <p className="text-xs text-rose-500 mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="payment-due">
                Due date
              </label>
              <input
                id="payment-due"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className={inputCls}
              />
              {errors.dueDate && <p className="text-xs text-rose-500 mt-1">{errors.dueDate}</p>}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="payment-notes">
              Notes
            </label>
            <textarea
              id="payment-notes"
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Payment terms, reference, what is included…"
              className={`${inputCls} resize-none`}
            />
          </div>

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
              className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-md shadow-emerald-500/25 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              {isEditing ? 'Save Changes' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
