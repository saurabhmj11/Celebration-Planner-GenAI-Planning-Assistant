import React, { useState, useEffect } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useEventContext } from '../../context/EventContext';
import { X, CalendarClock, CheckCircle2 } from 'lucide-react';

/** Add / edit one run-sheet cue line. */
export const RunSheetItemModal = ({ isOpen, onClose, itemToEdit = null }) => {
  const { activeEvent, addRunSheetItem, updateRunSheetItem } = useEventContext();
  const isEditing = Boolean(itemToEdit);

  const EMPTY = { time: '', durationMin: 30, activity: '', owner: '', notes: '' };
  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (itemToEdit) {
      setFormData({
        time: itemToEdit.time || '',
        durationMin: itemToEdit.durationMin ?? 30,
        activity: itemToEdit.activity || '',
        owner: itemToEdit.owner || '',
        notes: itemToEdit.notes || '',
      });
    } else {
      setFormData({ ...EMPTY, time: activeEvent?.time || '' });
    }
    setErrors({});
  }, [itemToEdit, isOpen]);

  const panelRef = useModalFocus(isOpen, onClose);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!String(formData.activity).trim()) errs.activity = 'What happens at this cue?';
    if (formData.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(formData.time)) errs.time = 'Use a 24h time like 18:30.';
    const dur = Number(formData.durationMin);
    if (formData.durationMin === '' || !Number.isFinite(dur) || dur < 5 || dur > 240) {
      errs.durationMin = 'Duration: 5-240 minutes.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = { ...formData, durationMin: Math.max(5, Math.min(240, Math.round(Number(formData.durationMin) || 15))) };
    if (isEditing) updateRunSheetItem(itemToEdit.id, payload);
    else addRunSheetItem(payload);
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
      aria-labelledby="runitem-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-5 bg-gradient-to-r from-rose-500 to-orange-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <CalendarClock className="w-5 h-5 text-rose-100" aria-hidden="true" />
            </div>
            <div>
              <h3 id="runitem-modal-title" className="font-display font-bold text-lg">
                {isEditing ? 'Edit Cue' : 'Add a Run-Sheet Cue'}
              </h3>
              <p className="text-xs text-rose-100">One line on the day-of clock</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close run-sheet cue dialog"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="runitem-time">
                Time (24h)
              </label>
              <input
                id="runitem-time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                  errors.time ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                }`}
              />
              {errors.time && <p className="text-xs text-rose-500 mt-1">{errors.time}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="runitem-duration">
                Duration (min)
              </label>
              <input
                id="runitem-duration"
                type="number"
                min="5"
                max="240"
                step="5"
                value={formData.durationMin}
                onChange={(e) => setFormData({ ...formData, durationMin: e.target.value })}
                className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                  errors.durationMin ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                }`}
              />
              {errors.durationMin && <p className="text-xs text-rose-500 mt-1">{errors.durationMin}</p>}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="runitem-activity">
              Activity <span className="text-rose-500">*</span>
            </label>
            <input
              id="runitem-activity"
              type="text"
              value={formData.activity}
              onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
              placeholder="e.g. Doors open — welcome cocktails"
              className={`w-full px-4 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                errors.activity ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
              }`}
            />
            {errors.activity && <p className="text-xs text-rose-500 mt-1">{errors.activity}</p>}
          </div>

          <div>
            <label className={labelCls} htmlFor="runitem-owner">
              Owner (who runs it)
            </label>
            <input
              id="runitem-owner"
              type="text"
              value={formData.owner}
              onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
              placeholder="e.g. Catering, DJ, Venue Team, Host"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="runitem-notes">
              Operational notes
            </label>
            <textarea
              id="runitem-notes"
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Cues, contacts, things to remember in the moment…"
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
              className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 rounded-xl shadow-md shadow-rose-500/25 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              {isEditing ? 'Save Changes' : 'Add Cue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
