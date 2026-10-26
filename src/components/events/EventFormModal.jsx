import React, { useState, useEffect } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useEventContext } from '../../context/EventContext';
import { EVENT_TYPES } from '../../data/defaultData';
import { X, Calendar, MapPin, Users, DollarSign, Clock, Sparkles, FileText, CheckCircle } from 'lucide-react';

export const EventFormModal = ({ isOpen, onClose, eventToEdit = null }) => {
  const { addEvent, updateEvent } = useEventContext();

  const isEditing = Boolean(eventToEdit);

  const [formData, setFormData] = useState({
    title: '',
    type: 'wedding',
    date: '',
    time: '18:00',
    location: '',
    guestCount: 50,
    budget: 8000,
    description: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (eventToEdit) {
      setFormData({
        title: eventToEdit.title || '',
        type: eventToEdit.type || 'wedding',
        date: eventToEdit.date || '',
        time: eventToEdit.time || '18:00',
        location: eventToEdit.location || '',
        guestCount: eventToEdit.guestCount || 50,
        budget: eventToEdit.budget || 5000,
        description: eventToEdit.description || '',
        notes: eventToEdit.notes || '',
      });
      setErrors({});
    } else {
      // Default new event values
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 45);
      setFormData({
        title: '',
        type: 'wedding',
        date: defaultDate.toISOString().slice(0, 10),
        time: '17:00',
        location: '',
        guestCount: 75,
        budget: 10000,
        description: '',
        notes: '',
      });
      setErrors({});
    }
  }, [eventToEdit, isOpen]);

  // Escape-close + focus trap + focus restore (shared modal a11y hook)
  const panelRef = useModalFocus(isOpen, onClose);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!formData.title.trim()) errs.title = 'Event title is required.';
    if (!formData.date) errs.date = 'Event date is required.';
    if (!formData.location.trim()) errs.location = 'Location or venue name is required.';
    if (Number(formData.guestCount) <= 0) errs.guestCount = 'Guest count must be at least 1.';
    if (Number(formData.budget) < 0) errs.budget = 'Budget cannot be negative.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing) {
      updateEvent(eventToEdit.id, formData);
    } else {
      addEvent(formData);
    }
    onClose();
  };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-brand-700 via-brand-600 to-fuchsia-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 id="event-modal-title" className="font-display font-bold text-xl">
                {isEditing ? 'Edit Celebration Details' : 'Create New Celebration'}
              </h3>
              <p className="text-xs text-brand-100">
                {isEditing ? 'Update your event details and budget goals' : 'Start organizing your dream celebration in minutes'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close celebration dialog"
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {/* Event Type Grid Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Celebration Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {EVENT_TYPES.map((t) => {
                const isSelected = formData.type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t.id })}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/80 ring-2 ring-brand-500/30 text-brand-900 font-semibold shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50/80'
                    }`}
                  >
                    <span className="text-xl">{t.icon}</span>
                    <span className="text-xs">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Event Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Liam & Maya's Sunset Garden Wedding"
              className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                errors.title ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
              }`}
            />
            {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title}</p>}
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={`w-full px-4 py-2.5 text-sm bg-slate-50 border rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                  errors.date ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                }`}
              />
              {errors.date && <p className="text-xs text-rose-500 mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-600" />
                Time
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Location / Venue */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-brand-600" />
              Location / Venue <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Grand Vista Vineyard Estate, 120 Napa Valley Way"
              className={`w-full px-4 py-3 text-sm bg-slate-50 border rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                errors.location ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
              }`}
            />
            {errors.location && <p className="text-xs text-rose-500 mt-1">{errors.location}</p>}
          </div>

          {/* Guest Count & Budget Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-600" />
                Estimated Guests <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.guestCount}
                onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })}
                placeholder="50"
                className={`w-full px-4 py-2.5 text-sm bg-slate-50 border rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                  errors.guestCount ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                }`}
              />
              {errors.guestCount && <p className="text-xs text-rose-500 mt-1">{errors.guestCount}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-brand-600" />
                Total Budget ($) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                placeholder="10000"
                className={`w-full px-4 py-2.5 text-sm bg-slate-50 border rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all ${
                  errors.budget ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                }`}
              />
              {errors.budget && <p className="text-xs text-rose-500 mt-1">{errors.budget}</p>}
            </div>
          </div>

          {/* Description & Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              Celebration Vision & Special Notes
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your atmosphere, vibe, dress code, or specific desires..."
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-7 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 rounded-xl shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {isEditing ? 'Save Changes' : 'Create Celebration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
