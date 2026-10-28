import React, { useState, useEffect } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useEventContext } from '../../context/EventContext';
import { RSVP_STATUSES, MEAL_OPTIONS, GUEST_GROUPS } from '../../data/defaultData';
import { X, UserPlus, Mail, Phone, Users, UtensilsCrossed, FileText, CheckCircle2 } from 'lucide-react';

/**
 * Add / edit a guest on the active event's list. Mirrors the VendorFormModal
 * conventions: same dialog a11y hook, same header/body layout, silent on
 * success beyond the context's own toast.
 */
export const GuestFormModal = ({ isOpen, onClose, guestToEdit = null }) => {
  const { addGuest, updateGuest } = useEventContext();

  const isEditing = Boolean(guestToEdit);

  const EMPTY = {
    name: '',
    email: '',
    phone: '',
    group: 'friends',
    rsvp: 'invited',
    plusOnes: 0,
    meal: 'standard',
    notes: '',
  };

  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (guestToEdit) {
      setFormData({
        name: guestToEdit.name || '',
        email: guestToEdit.email || '',
        phone: guestToEdit.phone || '',
        group: guestToEdit.group || 'friends',
        rsvp: guestToEdit.rsvp || 'invited',
        plusOnes: guestToEdit.plusOnes ?? 0,
        meal: guestToEdit.meal || 'standard',
        notes: guestToEdit.notes || '',
      });
    } else {
      setFormData(EMPTY);
    }
    setErrors({});
  }, [guestToEdit, isOpen]);

  // Escape-close + focus trap + focus restore (shared modal a11y hook)
  const panelRef = useModalFocus(isOpen, onClose);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Guest name is required.';
    const plusNum = Number(formData.plusOnes);
    if (formData.plusOnes !== '' && (!Number.isFinite(plusNum) || plusNum < 0 || plusNum > 10)) {
      errs.plusOnes = 'Plus-ones must be between 0 and 10.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...formData,
      plusOnes: Math.max(0, Math.min(10, Number(formData.plusOnes) || 0)),
    };

    if (isEditing) {
      updateGuest(guestToEdit.id, payload);
    } else {
      addGuest(payload);
    }
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
      aria-labelledby="guest-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-brand-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <UserPlus className="w-5 h-5 text-emerald-200" aria-hidden="true" />
            </div>
            <div>
              <h3 id="guest-modal-title" className="font-display font-bold text-lg">
                {isEditing ? 'Edit Guest' : 'Add a Guest'}
              </h3>
              <p className="text-xs text-emerald-100">
                Track RSVPs, plus-ones &amp; meal preferences
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guest dialog"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls} htmlFor="guest-name">
              Guest / Party Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="guest-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Eleanor Vance, or The Hendersons (family of 4)"
              className={`w-full px-4 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                errors.name ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
              }`}
            />
            {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`${labelCls} flex items-center gap-1.5`} htmlFor="guest-email">
                <Mail className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                Email
              </label>
              <input
                id="guest-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="guest@email.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className={`${labelCls} flex items-center gap-1.5`} htmlFor="guest-phone">
                <Phone className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                Phone
              </label>
              <input
                id="guest-phone"
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 018-2834"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`${labelCls} flex items-center gap-1.5`} htmlFor="guest-group">
                <Users className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                Group
              </label>
              <select
                id="guest-group"
                value={formData.group}
                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                className={inputCls}
              >
                {GUEST_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.icon} {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="guest-rsvp">
                RSVP Status
              </label>
              <select
                id="guest-rsvp"
                value={formData.rsvp}
                onChange={(e) => setFormData({ ...formData, rsvp: e.target.value })}
                className={inputCls}
              >
                {RSVP_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="guest-plusones">
                Plus-Ones (extra seats)
              </label>
              <input
                id="guest-plusones"
                type="number"
                min="0"
                max="10"
                value={formData.plusOnes}
                onChange={(e) => setFormData({ ...formData, plusOnes: e.target.value })}
                className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                  errors.plusOnes ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                }`}
              />
              {errors.plusOnes && <p className="text-xs text-rose-500 mt-1">{errors.plusOnes}</p>}
            </div>
            <div>
              <label className={`${labelCls} flex items-center gap-1.5`} htmlFor="guest-meal">
                <UtensilsCrossed className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                Meal Preference
              </label>
              <select
                id="guest-meal"
                value={formData.meal}
                onChange={(e) => setFormData({ ...formData, meal: e.target.value })}
                className={inputCls}
              >
                {MEAL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.icon} {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={`${labelCls} flex items-center gap-1.5`} htmlFor="guest-notes">
              <FileText className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
              Notes (seating, accessibility, kids…)
            </label>
            <textarea
              id="guest-notes"
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Needs aisle-side accessible seating, allergic to nuts…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Action buttons */}
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
              className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-brand-600 hover:from-emerald-700 hover:to-brand-700 rounded-xl shadow-md shadow-emerald-500/25 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              {isEditing ? 'Save Changes' : 'Save Guest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
