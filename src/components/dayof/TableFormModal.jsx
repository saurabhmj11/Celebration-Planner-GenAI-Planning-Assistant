import React, { useState, useEffect } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useEventContext } from '../../context/EventContext';
import { X, Armchair, CheckCircle2 } from 'lucide-react';

/** Add a table to the seating chart. */
export const TableFormModal = ({ isOpen, onClose }) => {
  const { addTable } = useEventContext();

  const EMPTY = { name: '', capacity: 8 };
  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setFormData(EMPTY);
    setErrors({});
  }, [isOpen]);

  const panelRef = useModalFocus(isOpen, onClose);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    const cap = Number(formData.capacity);
    if (formData.capacity === '' || !Number.isFinite(cap) || cap < 1 || cap > 50) {
      errs.capacity = 'Capacity: 1-50 seats.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    addTable({ name: formData.name, capacity: formData.capacity });
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
      aria-labelledby="table-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Armchair className="w-5 h-5 text-indigo-100" aria-hidden="true" />
            </div>
            <div>
              <h3 id="table-modal-title" className="font-display font-bold text-lg">
                Add a Table
              </h3>
              <p className="text-xs text-indigo-100">Name it and set its seat count</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close table dialog"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls} htmlFor="table-name">
              Table name
            </label>
            <input
              id="table-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Table 4 — College Friends"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="table-capacity">
              Seats (capacity) <span className="text-rose-500">*</span>
            </label>
            <input
              id="table-capacity"
              type="number"
              min="1"
              max="50"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                errors.capacity ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
              }`}
            />
            {errors.capacity && <p className="text-xs text-rose-500 mt-1">{errors.capacity}</p>}
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
              className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 rounded-xl shadow-md shadow-indigo-500/25 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              Add Table
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
