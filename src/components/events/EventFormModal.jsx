import React, { useState, useEffect, useMemo } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useEventContext } from '../../context/EventContext';
import { EVENT_TYPES, BUDGET_CATEGORIES } from '../../data/defaultData';
import { VENUES, VENUE_TYPES } from '../../data/venues';
import { topVenueSuggestions, estimateVenueCost } from '../../lib/venues/recommender';
import { buildStarterTasks } from '../../lib/planning/starterPlan';
import { formatCurrency, formatShortDate } from '../../utils/formatters';
import { makeId } from '../../utils/ids';
import { aiAssist } from '../../services/aiAssist';
import { mapCategoryToFallback, derivePhase } from '../../components/ai/aiKit';
import { X, Calendar, MapPin, Users, DollarSign, Clock, Sparkles, FileText, CheckCircle, MapPinned, AlertTriangle, Info, RefreshCw, Wand2, Loader2 } from 'lucide-react';

/** Share of the total budget assumed bookable for the venue. */
const VENUE_BUDGET_SHARE = 0.35;

/** One-tap intake examples — tuned to show off date/budget/guest/type detection. */
const INTAKE_EXAMPLES = [
  "Ava's fairy-themed 7th birthday for ~20 kids on June 14 at Willow Park, $3,000 budget",
  'Backyard wedding for 120 guests in September, $30k budget, rustic garden vibe',
  'Charity gala for 200 at the downtown Hilton, black-tie, $50,000 budget, 7pm',
];

/** Tiny chip shown next to any form field the AI intake filled. */
const AiTag = () => (
  <span
    title="Filled by the AI intake prompter"
    className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-brand-100 to-fuchsia-100 border border-brand-200 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-brand-700"
  >
    <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
    AI
  </span>
);

/** Match-badge tone — mirrors the AI Venue Finder tab card for consistency. */
const scoreTone = (s) => (s >= 85 ? 'bg-emerald-500' : s >= 70 ? 'bg-amber-500' : 'bg-slate-500');

const inputBase =
  'w-full h-11 px-4 text-sm bg-slate-50 border rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-400';
const inputTone = (hasError) =>
  hasError ? 'border-rose-400 bg-rose-50/60 focus:ring-rose-400' : 'border-slate-200';

const labelBase =
  'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5';

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
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  // When the celebration TYPE changes on an edit, offer to rebuild the timeline
  // (default on — the plan should follow the celebration type).
  const [rebuildTimeline, setRebuildTimeline] = useState(true);

  // --- AI intake prompter state (create mode only) ---
  const [intakePrompt, setIntakePrompt] = useState('');
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeError, setIntakeError] = useState('');
  const [intakeResult, setIntakeResult] = useState(null); // { data, source, model }
  const [aiFields, setAiFields] = useState(() => new Set());
  const [applyIntakePlan, setApplyIntakePlan] = useState(true);

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
      setSelectedVenueId(eventToEdit.venueId || null);
      setErrors({});
      setRebuildTimeline(true);
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
      setSelectedVenueId(null);
      setErrors({});
      setRebuildTimeline(true);
      // Fresh intake state for every new-event session.
      setIntakePrompt('');
      setIntakeLoading(false);
      setIntakeError('');
      setIntakeResult(null);
      setAiFields(new Set());
      setApplyIntakePlan(true);
    }
  }, [eventToEdit, isOpen]);

  // Live AI-style venue suggestions driven by the recommendation algorithm —
  // they reshuffle as the user changes celebration type, guests or budget.
  const guests = Math.max(1, Number(formData.guestCount) || 1);
  const totalBudget = Math.max(0, Number(formData.budget) || 0);
  const venueBudgetSlice = Math.round(totalBudget * VENUE_BUDGET_SHARE);

  const venueSuggestions = useMemo(
    () =>
      topVenueSuggestions(
        VENUES,
        {
          eventType: formData.type,
          guestCount: guests,
          venueBudget: venueBudgetSlice,
        },
        3
      ),
    [formData.type, guests, venueBudgetSlice]
  );

  const typeLabel =
    EVENT_TYPES.find((t) => t.id === formData.type)?.label.toLowerCase() || 'celebration';

  const applyVenueSuggestion = (scored) => {
    setSelectedVenueId(scored.venue.id);
    setFormData((prev) => ({
      ...prev,
      location: `${scored.venue.name} — ${scored.venue.area}`,
    }));
    // Picking a match resolves the location error immediately.
    setErrors((prev) => (prev.location ? { ...prev, location: undefined } : prev));
  };

  // Escape-close + focus trap + focus restore (shared modal a11y hook)
  const panelRef = useModalFocus(isOpen, onClose);

  if (!isOpen) return null;

  /** Update one form field and drop its "AI filled" chip the moment a human edits it. */
  const setField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setAiFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  /** Run the free-form description through the AI intake: detect → fill form → draft plan. */
  const handleRunIntake = async () => {
    const prompt = intakePrompt.trim();
    if (prompt.length < 8) {
      setIntakeError('Describe your celebration in a sentence or two (at least 8 characters).');
      return;
    }
    setIntakeLoading(true);
    setIntakeError('');
    try {
      const result = await aiAssist.eventIntake({
        prompt,
        today: new Date().toISOString().slice(0, 10),
      });
      const d = result?.data;
      if (!d || !d.title) {
        throw new Error('empty');
      }
      setIntakeResult(result);
      setApplyIntakePlan(true);

      const filled = new Set(['title']);
      setFormData((prev) => {
        const next = { ...prev, title: d.title };
        if (d.eventType) {
          next.type = d.eventType;
          filled.add('type');
        }
        if (d.date) {
          next.date = d.date;
          filled.add('date');
        }
        if (d.time) {
          next.time = d.time;
          filled.add('time');
        }
        if (typeof d.budget === 'number' && d.budget > 0) {
          next.budget = d.budget;
          filled.add('budget');
        }
        if (typeof d.guestCount === 'number' && d.guestCount > 0) {
          next.guestCount = d.guestCount;
          filled.add('guestCount');
        }
        if (d.locationHint && (!prev.location || aiFields.has('location'))) {
          next.location = d.locationHint;
          filled.add('location');
          setSelectedVenueId(null);
        }
        if (!prev.description && d.summary) {
          next.description = d.summary;
          filled.add('description');
        }
        return next;
      });
      setAiFields(filled);
      // Anything the AI just filled can no longer be invalid.
      setErrors((prev) => {
        const next = { ...prev };
        filled.forEach((f) => delete next[f]);
        return next;
      });
    } catch (_err) {
      setIntakeResult(null);
      setIntakeError(
        'The AI engine could not read that description. Try rephrasing with more detail, or fill the form manually.'
      );
    } finally {
      setIntakeLoading(false);
    }
  };

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

    // Venue metadata travels with the plan in BOTH modes:
    //  - picked a match  -> venueId/Name/EstCost saved (est re-priced for the new guest count)
    //  - typed own venue -> any stale venue fields are cleared so nothing drifts out of sync
    const chosen = selectedVenueId ? VENUES.find((v) => v.id === selectedVenueId) : null;
    const venueFields = chosen
      ? {
          venueId: chosen.id,
          venueName: chosen.name,
          venueEstCost: estimateVenueCost(chosen, guests),
        }
      : { venueId: undefined, venueName: undefined, venueEstCost: undefined };

    if (isEditing) {
      // Re-typed celebration? Rebuild the timeline milestones so the plan
      // always matches the event type (user can opt out in the note above).
      const timelineFields =
        typeChanged && rebuildTimeline
          ? { tasks: buildStarterTasks({ type: formData.type, date: formData.date }) }
          : {};
      updateEvent(eventToEdit.id, { ...formData, ...venueFields, ...timelineFields });
    } else {
      // New celebration: if the AI intake drafted a plan and the user kept it,
      // seed the timeline + budget from what the agent understood — otherwise
      // fall back to the type-aware starter checklist.
      const intake = applyIntakePlan ? intakeResult?.data : null;
      const milestones = intake?.milestones || [];
      const budgetLines = intake?.budgetLines || [];

      const tasks =
        milestones.length >= 3
          ? milestones.map((m) => ({
              id: makeId('task'),
              title: m.title,
              notes: m.description
                ? `${m.description}\n\n(AI intake milestone drafted from your description — edit freely or regenerate with AI in the Timeline tab.)`
                : 'AI intake milestone drafted from your description — edit freely or regenerate with AI in the Timeline tab.',
              dueDate: m.dueDate,
              priority: m.priority || 'medium',
              category: m.category || 'other',
              phase: derivePhase(m.dueDate, formData.date),
              completed: false,
            }))
          : buildStarterTasks({ type: formData.type, date: formData.date });

      const expenses =
        budgetLines.length >= 3
          ? budgetLines.map((l) => ({
              id: makeId('exp'),
              name: `${l.category} (AI plan)`,
              category: mapCategoryToFallback(l.category, BUDGET_CATEGORIES) || 'miscellaneous',
              allocated: Math.round((Number(formData.budget) * l.percent) / 100),
              spent: 0,
              paid: false,
              date: new Date().toISOString().slice(0, 10),
              notes: `AI intake plan — ${l.percent}% of your ${formatCurrency(Number(formData.budget) || 0)} budget, drafted from your description.`,
            }))
          : [];

      addEvent({
        ...formData,
        ...venueFields,
        tasks,
        ...(expenses.length > 0 ? { expenses } : {}),
      });
    }
    onClose();
  };

  // Editing and the date moved? Existing timeline tasks keep their original dates —
  // tell the user how to re-align them before they save.
  const dateChanged = isEditing && eventToEdit && formData.date && formData.date !== eventToEdit.date;
  const typeChanged = isEditing && eventToEdit && formData.type && formData.type !== eventToEdit.type;
  const existingTaskCount = eventToEdit?.tasks?.length || 0;

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn"
    >
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
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
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {/* AI Intake Prompter — describe it, the agent detects + drafts the plan */}
          {!isEditing && (
            <section
              aria-labelledby="intake-prompt-title"
              className="rounded-3xl border border-brand-200/80 bg-gradient-to-br from-brand-50/90 via-white to-fuchsia-50/70 p-4 md:p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4
                    id="intake-prompt-title"
                    className="flex items-center gap-2 font-display font-bold text-brand-900"
                  >
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-sm"
                      aria-hidden="true"
                    >
                      <Wand2 className="w-4 h-4" />
                    </span>
                    Describe it — the AI fills this form
                  </h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-brand-800/80">
                    One or two sentences: who, what, when, where, budget, vibe. The agent detects the
                    details and drafts a tailored plan — everything stays editable.
                  </p>
                </div>
              </div>

              <label htmlFor="intake-prompt" className="sr-only">
                Describe your celebration for the AI to detect
              </label>
              <textarea
                id="intake-prompt"
                rows={3}
                value={intakePrompt}
                onChange={(e) => setIntakePrompt(e.target.value)}
                placeholder="e.g. Ava's fairy-themed 7th birthday for ~20 kids on June 14 at Willow Park, $3,000 budget, sparkly garden vibe…"
                aria-describedby={intakeError ? 'intake-prompt-error' : 'intake-prompt-hint'}
                aria-invalid={Boolean(intakeError)}
                className="mt-3 w-full px-4 py-2.5 text-sm bg-white/90 border border-brand-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none placeholder:text-slate-400"
              />

              <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-hidden="true">
                {INTAKE_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => {
                      setIntakePrompt(ex);
                      setIntakeError('');
                    }}
                    className="max-w-full truncate rounded-full border border-brand-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-brand-700 hover:border-brand-400 hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {ex.length > 46 ? `${ex.slice(0, 46)}…` : ex}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRunIntake}
                  disabled={intakeLoading}
                  className="h-10 inline-flex items-center gap-2 px-5 text-sm font-bold text-white bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 rounded-xl shadow-lg shadow-brand-500/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-wait"
                >
                  {intakeLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      Reading your description…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      Detect &amp; Draft Plan
                    </>
                  )}
                </button>
                <span
                  id="intake-prompt-hint"
                  className="text-[10px] font-medium text-slate-500"
                  aria-live="polite"
                >
                  {intakeLoading
                    ? 'The agent is detecting your event type, date, budget and guests…'
                    : 'Powered by the live GLM engine — falls back to the offline detector automatically.'}
                </span>
              </div>

              {intakeError && (
                <p
                  id="intake-prompt-error"
                  role="alert"
                  className="mt-2 flex items-start gap-1.5 text-xs font-medium text-rose-600"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                  {intakeError}
                </p>
              )}

              {/* Detection result — confirmation + tailored plan preview */}
              {intakeResult?.data && !intakeLoading && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-white/95 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-relaxed text-slate-700">{intakeResult.data.summary}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            intakeResult.data.confidence === 'high'
                              ? 'bg-emerald-100 text-emerald-800'
                              : intakeResult.data.confidence === 'medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {intakeResult.data.confidence} confidence
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                          <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
                          {intakeResult.source === 'live-ai'
                            ? `Live AI · ${intakeResult.model || 'GLM'}`
                            : 'Offline detector'}
                        </span>
                        {intakeResult.data.milestones.length > 0 && (
                          <span className="rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                            {intakeResult.data.milestones.length} tailored milestones
                          </span>
                        )}
                        {intakeResult.data.budgetLines.length >= 3 && (
                          <span className="rounded-full bg-fuchsia-50 border border-fuchsia-200 px-2 py-0.5 text-[10px] font-bold text-fuchsia-800">
                            {intakeResult.data.budgetLines.length} budget lines
                          </span>
                        )}
                      </div>

                      {(intakeResult.data.milestones.length > 0 ||
                        intakeResult.data.budgetLines.length >= 3) && (
                        <label className="mt-2.5 flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={applyIntakePlan}
                            onChange={(e) => setApplyIntakePlan(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="text-xs font-semibold text-slate-700">
                            Build my plan from this draft
                            <span className="font-normal text-slate-500">
                              {' '}(adds{' '}
                              {intakeResult.data.milestones.length > 0
                                ? `${intakeResult.data.milestones.length} milestones`
                                : 'the type starter checklist'}
                              {intakeResult.data.budgetLines.length >= 3
                                ? ` + ${intakeResult.data.budgetLines.length} planned budget lines`
                                : ''}
                              )
                            </span>
                          </span>
                        </label>
                      )}

                      {intakeResult.data.suggestions?.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {intakeResult.data.suggestions.slice(0, 3).map((s) => (
                            <li
                              key={s}
                              className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-600"
                            >
                              <span className="mt-1.5 h-1 w-1 rounded-full bg-brand-400 shrink-0" aria-hidden="true" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Event Type Grid Selection */}
          <div>
            <span id="event-type-label" className={labelBase}>
              Celebration Type {aiFields.has('type') && <AiTag />}
            </span>
            <div
              className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
              role="group"
              aria-labelledby="event-type-label"
            >
              {EVENT_TYPES.map((t) => {
                const isSelected = formData.type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setField('type', t.id)}
                    className={`flex items-center gap-2.5 min-h-14 px-3 py-2 rounded-2xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/80 ring-2 ring-brand-500/30 text-brand-900 font-semibold shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50/80'
                    }`}
                  >
                    <span className="text-xl shrink-0" aria-hidden="true">{t.icon}</span>
                    <span className="text-xs leading-snug">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="event-title" className={labelBase}>
              Event Title <span className="text-rose-500" aria-hidden="true">*</span>{' '}
              {aiFields.has('title') && <AiTag />}
            </label>
            <input
              id="event-title"
              type="text"
              value={formData.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. Liam & Maya's Sunset Garden Wedding"
              aria-required="true"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'event-title-error' : undefined}
              className={`${inputBase} ${inputTone(errors.title)}`}
            />
            {errors.title && (
              <p id="event-title-error" role="alert" className="text-xs text-rose-500 mt-1">
                {errors.title}
              </p>
            )}
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-date" className={`${labelBase} flex items-center gap-1.5`}>
                <Calendar className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                Date <span className="text-rose-500" aria-hidden="true">*</span>
                {aiFields.has('date') && <AiTag />}
              </label>
              <input
                id="event-date"
                type="date"
                value={formData.date}
                onChange={(e) => setField('date', e.target.value)}
                aria-required="true"
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? 'event-date-error' : undefined}
                className={`${inputBase} ${inputTone(errors.date)}`}
              />
              {errors.date && (
                <p id="event-date-error" role="alert" className="text-xs text-rose-500 mt-1">
                  {errors.date}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="event-time" className={`${labelBase} flex items-center gap-1.5`}>
                <Clock className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                Time {aiFields.has('time') && <AiTag />}
                <span className="ml-0.5 text-[10px] font-semibold normal-case tracking-normal text-slate-400">
                  optional
                </span>
              </label>
              <input
                id="event-time"
                type="time"
                value={formData.time}
                onChange={(e) => setField('time', e.target.value)}
                className={`${inputBase} ${inputTone(false)}`}
              />
            </div>
          </div>

          {/* Guest Count & Budget Row — feeds the AI venue ranking below */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-guests" className={`${labelBase} flex items-center gap-1.5`}>
                <Users className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                Estimated Guests <span className="text-rose-500" aria-hidden="true">*</span>
                {aiFields.has('guestCount') && <AiTag />}
              </label>
              <input
                id="event-guests"
                type="number"
                min="1"
                value={formData.guestCount}
                onChange={(e) => setField('guestCount', e.target.value)}
                placeholder="50"
                aria-required="true"
                aria-invalid={Boolean(errors.guestCount)}
                aria-describedby={errors.guestCount ? 'event-guests-error' : undefined}
                className={`${inputBase} ${inputTone(errors.guestCount)}`}
              />
              {errors.guestCount && (
                <p id="event-guests-error" role="alert" className="text-xs text-rose-500 mt-1">
                  {errors.guestCount}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="event-budget" className={`${labelBase} flex items-center gap-1.5`}>
                <DollarSign className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                Total Budget <span className="text-rose-500" aria-hidden="true">*</span>
                {aiFields.has('budget') && <AiTag />}
              </label>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 pointer-events-none"
                >
                  $
                </span>
                <input
                  id="event-budget"
                  type="number"
                  min="0"
                  step="50"
                  value={formData.budget}
                  onChange={(e) => setField('budget', e.target.value)}
                  placeholder="10000"
                  aria-required="true"
                  aria-invalid={Boolean(errors.budget)}
                  aria-describedby={errors.budget ? 'event-budget-error' : undefined}
                  className={`${inputBase} pl-8 ${inputTone(errors.budget)}`}
                />
              </div>
              {errors.budget && (
                <p id="event-budget-error" role="alert" className="text-xs text-rose-500 mt-1">
                  {errors.budget}
                </p>
              )}
            </div>
          </div>

          {/* Location / Venue */}
          <div>
            <label htmlFor="event-location" className={`${labelBase} flex items-center gap-1.5`}>
              <MapPin className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
              Location / Venue <span className="text-rose-500" aria-hidden="true">*</span>
              {aiFields.has('location') && <AiTag />}
            </label>
            <input
              id="event-location"
              type="text"
              value={formData.location}
              onChange={(e) => {
                if (selectedVenueId) setSelectedVenueId(null);
                setField('location', e.target.value);
              }}
              placeholder="e.g. Grand Vista Vineyard Estate"
              aria-required="true"
              aria-invalid={Boolean(errors.location)}
              aria-describedby={errors.location ? 'event-location-error' : undefined}
              className={`${inputBase} ${inputTone(errors.location)}`}
            />
            {errors.location && (
              <p id="event-location-error" role="alert" className="text-xs text-rose-500 mt-1">
                {errors.location}
              </p>
            )}
          </div>

          {/* AI venue suggestions — live from the recommendation algorithm */}
          <section
            aria-labelledby="venue-matches-title"
            className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/70 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p
                id="venue-matches-title"
                className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900 uppercase tracking-wider"
              >
                <MapPinned className="w-4 h-4 text-amber-600" aria-hidden="true" />
                Smart Venue Matches
              </p>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                AI-ranked live
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed font-medium text-amber-800">
              Ranked for a {typeLabel} with {guests} guests on about{' '}
              {formatCurrency(venueBudgetSlice)} for the venue ({Math.round(VENUE_BUDGET_SHARE * 100)}% of
              budget). Matches re-rank as you adjust the details above.
            </p>

            <div
              className="mt-3 grid gap-2.5 sm:grid-cols-3"
              role="group"
              aria-label="AI venue suggestions"
            >
              {venueSuggestions.map(({ venue, score, estCost, warnings }) => {
                const chosen = selectedVenueId === venue.id;
                const typeMeta = VENUE_TYPES.find((t) => t.id === venue.type);
                const warning = warnings[0];
                return (
                  <button
                    key={venue.id}
                    type="button"
                    aria-pressed={chosen}
                    aria-label={`${venue.name}, ${Math.round(score)} percent match, estimated ${formatCurrency(estCost)}`}
                    onClick={() => applyVenueSuggestion({ venue, estCost })}
                    title={warning || `${venue.name} — ${venue.area}`}
                    className={`group text-left rounded-2xl border bg-white overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                      chosen
                        ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-md'
                        : 'border-slate-200/80 hover:border-amber-300'
                    }`}
                  >
                    <div className="relative h-20 sm:h-24 overflow-hidden">
                      <img
                        src={venue.images[0]}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span
                        className={`absolute top-1.5 left-1.5 text-[10px] font-extrabold text-white rounded-full px-2 py-0.5 shadow ${scoreTone(score)}`}
                      >
                        {Math.round(score)}% match
                      </span>
                      {warning && (
                        <span
                          className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-1.5 py-0.5 text-[9px] font-bold text-white shadow"
                          aria-label={`Warning: ${warning}`}
                        >
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                          check fit
                        </span>
                      )}
                      {chosen && (
                        <span className="absolute inset-0 bg-emerald-600/25 flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-white drop-shadow" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-bold text-slate-800 leading-snug line-clamp-2 min-h-[2.1rem]">
                        {venue.name}
                      </p>
                      <p className="mt-1 text-[11px] font-extrabold text-emerald-700">
                        ≈{formatCurrency(estCost)}
                      </p>
                      <p className="text-[10px] font-medium text-slate-500">
                        {venue.capacity.min}–{venue.capacity.max} guests
                        {typeMeta ? ` · ${typeMeta.icon} ${typeMeta.label}` : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] font-medium text-amber-800 mt-3">
              {selectedVenueId
                ? 'Match applied to Location above — edit any detail before saving, and the estimated venue cost is stored with your event.'
                : 'Pick a match to auto-fill the Location, or type your own venue — matches re-rank live as guests and budget change.'}
            </p>
          </section>

          {/* Description & Notes */}
          <div>
            <label htmlFor="event-vision" className={`${labelBase} flex items-center gap-1.5`}>
              <FileText className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
              Celebration Vision & Special Notes {aiFields.has('description') && <AiTag />}
            </label>
            <textarea
              id="event-vision"
              rows={3}
              value={formData.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Describe your atmosphere, vibe, dress code, or specific desires..."
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none placeholder:text-slate-400"
            />
          </div>

          {/* Timeline guidance + starter-task hints */}
          {typeChanged && (
            <div
              role="note"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
            >
              <p className="flex items-start gap-2.5 text-xs leading-relaxed text-amber-900">
                <RefreshCw className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-bold">Celebration type changed.</span> Your timeline still
                  reflects the previous type — rebuild it so milestones match your new celebration.
                </span>
              </p>
              <label className="mt-2.5 flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rebuildTimeline}
                  onChange={(e) => setRebuildTimeline(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-semibold text-amber-900">
                  Rebuild timeline milestones for this type
                  {existingTaskCount > 0 ? (
                    <span className="font-normal text-amber-800">
                      {' '}(replaces {existingTaskCount} existing task{existingTaskCount === 1 ? '' : 's'} with a fresh checklist)
                    </span>
                  ) : null}
                </span>
              </label>
            </div>
          )}
          {dateChanged && !typeChanged && (
            <div
              role="note"
              className="flex items-start gap-2.5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3"
            >
              <Info className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-sky-800">
                <span className="font-bold">Date change detected.</span> Existing timeline tasks keep
                their original dates — after saving, open{' '}
                <span className="font-semibold">Timeline &amp; Tasks → Milestone Planner</span> to let AI
                re-generate dated tasks for the new schedule, or shift them manually.
              </p>
            </div>
          )}
          {!isEditing && formData.date && (() => {
            const intake = applyIntakePlan ? intakeResult?.data : null;
            const milestoneCount = intake?.milestones?.length || 0;
            const lineCount = intake?.budgetLines?.length || 0;
            const planFromIntake = milestoneCount >= 3;
            return (
              <div
                role="note"
                className="flex items-start gap-2.5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3"
              >
                <Info className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-sky-800">
                  {planFromIntake ? (
                    <>
                      On save, the <span className="font-bold">AI-drafted plan from your description</span> is
                      added: <span className="font-bold">{milestoneCount} tailored milestones</span> dated up to{' '}
                      {formatShortDate(formData.date)}
                      {lineCount >= 3 ? (
                        <>
                          {' '}+ <span className="font-bold">{lineCount} planned budget lines</span> totalling
                          your {formatCurrency(Number(formData.budget) || 0)} budget
                        </>
                      ) : null}
                      . Edit anything freely afterwards.
                    </>
                  ) : (
                    <>
                      On save, a <span className="font-bold">starter {EVENT_TYPES.find((t) => t.id === formData.type)?.label.toLowerCase() || 'celebration'} checklist</span> is
                      added to your timeline, dated for {formatShortDate(formData.date)} — edit it freely or let
                      AI regenerate a richer plan in the Timeline tab.
                    </>
                  )}
                </p>
              </div>
            );
          })()}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-11 px-7 text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 rounded-xl shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
              {isEditing ? 'Save Changes' : 'Create Celebration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
