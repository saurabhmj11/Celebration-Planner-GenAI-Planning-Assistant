import React, { useState, useEffect } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useEventContext } from '../../context/EventContext';
import { GIFT_PRIORITIES, GIFT_STATUSES, normalizeGiftUrl } from '../../lib/gifts/giftModel';
import { X, Gift, Link as LinkIcon } from 'lucide-react';

/**
 * Add / edit a gift registry item. Validation is intentionally light here —
 * the model layer (giftModel + context) re-normalizes everything — but the
 * name is required and the URL must be http(s) before it is even submitted.
 */
export const GiftFormModal = ({ isOpen, onClose, giftToEdit = null }) => {
  const { activeEvent, addGift, updateGift } = useEventContext();

  const isEditing = Boolean(giftToEdit);

  const [formData, setFormData] = useState({
    name: '',
    store: '',
    url: '',
    price: '',
    priority: 'medium',
    status: 'available',
    claimedByName: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (giftToEdit) {
      setFormData({
        name: giftToEdit.name || '',
        store: giftToEdit.store || '',
        url: giftToEdit.url || '',
        price: giftToEdit.price ? String(giftToEdit.price) : '',
        priority: giftToEdit.priority || 'medium',
        status: giftToEdit.status || 'available',
        claimedByName: giftToEdit.claimedByName || '',
        notes: giftToEdit.notes || '',
      });
    } else {
      setFormData({
        name: '',
        store: '',
        url: '',
        price: '',
        priority: 'medium',
        status: 'available',
        claimedByName: '',
        notes: '',
      });
    }
    setErrors({});
  }, [giftToEdit, isOpen]);

  const panelRef = useModalFocus(isOpen, onClose);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Give the gift a name.';
    if (formData.url && !normalizeGiftUrl(formData.url)) {
      errs.url = 'Links must start with http:// or https://';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...formData,
      price: formData.price === '' ? 0 : Number(formData.price),
      claimedByName: formData.status === 'available' ? '' : formData.claimedByName,
    };

    if (isEditing) {
      updateGift(giftToEdit.id, payload);
    } else {
      addGift(payload);
    }
    onClose();
  };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gift-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Gift className="w-5 h-5 text-amber-300" aria-hidden="true" />
            </div>
            <div>
              <h3 id="gift-modal-title" className="font-display font-bold text-lg">
                {isEditing ? 'Edit Registry Item' : 'Add Registry Item'}
              </h3>
              <p className="text-xs text-brand-100">
                {activeEvent ? `Registry for ${activeEvent.title}` : 'Gift registry'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close gift dialog"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="gift-name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Gift Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="gift-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Stand Mixer in Matte Sage"
              className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl outline-none transition-all focus:bg-white focus:ring-2 ${
                errors.name ? 'border-rose-300 focus:ring-rose-400' : 'border-slate-200 focus:ring-brand-500'
              }`}
            />
            {errors.name && <p className="text-xs text-rose-600 mt-1 font-semibold">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="gift-store" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Store / Source
              </label>
              <input
                id="gift-store"
                type="text"
                value={formData.store}
                onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                placeholder="e.g. Culinary Depot"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all focus:bg-white focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label htmlFor="gift-price" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Price (USD)
              </label>
              <input
                id="gift-price"
                type="number"
                min="0"
                step="1"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="e.g. 120"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all focus:bg-white focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Stored in USD — displayed in your chosen currency.</p>
            </div>
          </div>

          <div>
            <label htmlFor="gift-url" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <LinkIcon className="w-3 h-3 inline mr-1" aria-hidden="true" /> Product Link (optional)
            </label>
            <input
              id="gift-url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://…"
              className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl outline-none transition-all focus:bg-white focus:ring-2 ${
                errors.url ? 'border-rose-300 focus:ring-rose-400' : 'border-slate-200 focus:ring-brand-500'
              }`}
            />
            {errors.url && <p className="text-xs text-rose-600 mt-1 font-semibold">{errors.url}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="gift-priority" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                id="gift-priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-brand-500"
              >
                {GIFT_PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gift-status" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                id="gift-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-brand-500"
              >
                {GIFT_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.status !== 'available' && (
            <div>
              <label htmlFor="gift-claimed-by" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Claimed by (name)
              </label>
              <input
                id="gift-claimed-by"
                type="text"
                value={formData.claimedByName}
                onChange={(e) => setFormData({ ...formData, claimedByName: e.target.value })}
                placeholder="e.g. Aunt Mei"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all focus:bg-white focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Tip: use the guest picker on the registry card to link the claim to your guest list.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="gift-notes" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              id="gift-notes"
              rows="2"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Color, size, engraving details…"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all focus:bg-white focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 rounded-xl shadow-lg shadow-brand-500/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {isEditing ? 'Save Changes' : 'Add to Registry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
