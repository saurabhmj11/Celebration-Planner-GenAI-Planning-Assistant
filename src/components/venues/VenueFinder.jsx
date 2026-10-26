'use client';

import React, { useState, useMemo, useDeferredValue, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useEventContext } from '@/context/EventContext';
import { VENUES, VENUE_TYPES, DEFAULT_VENUE_BUDGET_SHARE } from '@/data/venues';
import { EVENT_TYPES } from '@/data/defaultData';
import { scoreVenues, parseVenuePreferences } from '@/lib/venues/recommender';
import { aiAssist } from '@/services/aiAssist';
import { formatCurrency } from '@/utils/formatters';
import { AiButton, AiSourceNote, AiErrorNote, useAiRequest } from '@/components/ai/aiKit';
import { VenueCard } from './VenueCard';
import {
  MapPinned,
  Search,
  Sparkles,
  Lightbulb,
  CalendarHeart,
  Users,
  Wallet,
  X,
  BadgeCheck,
} from 'lucide-react';

// Leaflet touches `window` — client-only, with a friendly loading shell.
const VenueMap = dynamic(() => import('./VenueMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-3xl border border-slate-200/80 bg-slate-100 animate-pulse flex items-center justify-center" role="status">
      <p className="text-sm text-slate-400 font-semibold">Loading the venue map…</p>
    </div>
  ),
});

const SHARE_OPTIONS = [
  { value: 0.25, label: '25%' },
  { value: 0.35, label: '35%' },
  { value: 0.5, label: '50%' },
];

const EVENT_TYPE_LABEL = Object.fromEntries(EVENT_TYPES.map((t) => [t.id, t.label]));

/**
 * AI Venue Finder — the "smart venue booking" surface.
 *
 * Live recommendation algorithm ranks 16 curated venues for the active event
 * (type fit, capacity, budget slice, style tags parsed from natural language
 * like "a lakeside hotel resort"), the map shows photo pins with hover
 * previews, and the GenAI layer enriches the shortlist with personalized
 * rationale + negotiation tips. Booking a venue writes location, a vendor row
 * and a budget line into the event in one click.
 */
export const VenueFinder = () => {
  const {
    activeEvent,
    updateEvent,
    addVendor,
    addExpense,
    showToast,
    triggerConfetti,
  } = useEventContext();

  const [styleTags, setStyleTags] = useState([]);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [share, setShare] = useState(DEFAULT_VENUE_BUDGET_SHARE);
  const [selectedId, setSelectedId] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const ai = useAiRequest();

  const eventType = activeEvent?.type || 'other';
  const typeLabel = EVENT_TYPE_LABEL[eventType] || 'celebration';
  const guests = Number(activeEvent?.guestCount) || 50;
  const totalBudget = Number(activeEvent?.budget) || 5000;
  const venueBudget = Math.round(totalBudget * share);

  /* ---- Live ranking (deterministic recommendation algorithm) ---- */
  const scored = useMemo(
    () =>
      scoreVenues(VENUES, {
        eventType,
        guestCount: guests,
        venueBudget,
        styleTags,
        query: deferredQuery,
      }),
    [eventType, guests, venueBudget, styleTags, deferredQuery]
  );

  /* ---- Natural-language preference parsing ("near the lake" -> lakeside) ---- */
  const parsedPrefs = useMemo(() => parseVenuePreferences(deferredQuery, VENUES), [deferredQuery]);
  const activePrefs = useMemo(
    () => new Set([...styleTags, ...parsedPrefs.tags]),
    [styleTags, parsedPrefs]
  );
  const matchedIds = activePrefs.size
    ? new Set(VENUES.filter((v) => v.tags.some((t) => activePrefs.has(t))).map((v) => v.id))
    : null;

  const selectedVenue = useMemo(
    () => scored.find((s) => s.venue.id === selectedId) || null,
    [scored, selectedId]
  );
  const bookedVenueId = activeEvent?.venueId || null;

  /* ---- AI insight enrichment on the algorithm's top 5 ---- */
  const aiCandidates = useMemo(() => scored.slice(0, 5), [scored]);

  const aiInsightById = useMemo(() => {
    const map = {};
    (ai.result?.data?.venues || []).forEach((v) => {
      map[v.id] = v;
    });
    return map;
  }, [ai.result]);

  const runAiInsights = useCallback(() => {
    ai.run(() =>
      aiAssist.venueRecommend({
        eventType,
        eventTitle: activeEvent?.title,
        eventDate: activeEvent?.date,
        guestCount: guests,
        venueBudget,
        preferences: [...styleTags, ...parsedPrefs.tags].slice(0, 8),
        query: deferredQuery || undefined,
        candidates: aiCandidates.map(({ venue, score, estCost }) => ({
          id: venue.id,
          name: venue.name,
          type: venue.type,
          area: venue.area,
          tags: venue.tags,
          capacityMax: venue.capacity.max,
          rating: venue.rating,
          score,
          estCost,
        })),
      })
    );
  }, [ai, eventType, activeEvent, guests, venueBudget, styleTags, parsedPrefs, deferredQuery, aiCandidates]);

  /* ---- Booking: venue + budget line + vendor row in one click ---- */
  const handleBook = useCallback(
    ({ venue, estCost }) => {
      if (!activeEvent) return;
      updateEvent(activeEvent.id, {
        location: `${venue.name} — ${venue.area}`,
        venueId: venue.id,
        venueName: venue.name,
        venueEstCost: estCost,
      });
      addVendor({
        name: venue.name,
        category: 'venue',
        contactPerson: 'Events office',
        phone: venue.contact.phone,
        email: venue.contact.email,
        cost: estCost,
        status: 'researching',
        rating: Math.round(venue.rating * 10) / 10,
        notes: `Found via AI Venue Finder (${venue.type} venue, ${Math.round(
          scored.find((s) => s.venue.id === venue.id)?.score || 0
        )}% match). Est. total ${formatCurrency(estCost)}.`,
      });
      addExpense({
        name: `Venue: ${venue.name}`,
        category: 'venue',
        allocated: estCost,
        spent: 0,
        paid: false,
        notes: 'Auto-added when booking the venue from the AI Venue Finder.',
      });
      triggerConfetti();
      showToast(`"${venue.name}" booked into your plan — vendor + budget line added!`, 'success');
    },
    [activeEvent, updateEvent, addVendor, addExpense, triggerConfetti, showToast, scored]
  );

  const toggleTag = (tag) => {
    setStyleTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const clearPreferences = () => {
    setStyleTags([]);
    setQuery('');
  };

  const hasPrefs = styleTags.length > 0 || deferredQuery.trim().length > 0;
  const visibleCount = matchedIds ? matchedIds.size : VENUES.length;

  return (
    <div className="space-y-6">
      {/* ---------------- Header ---------------- */}
      <section
        aria-labelledby="venue-finder-title"
        className="relative overflow-hidden rounded-3xl border border-brand-200/70 bg-gradient-to-br from-brand-50 via-white to-fuchsia-50/60 shadow-card p-6"
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/25 shrink-0" aria-hidden="true">
              <MapPinned className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <h2 id="venue-finder-title" className="font-display font-extrabold text-xl text-slate-900 leading-tight">
                AI Venue Finder
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                16 curated venues ranked live for your{' '}
                <strong className="text-brand-700">{activeEvent?.title || 'celebration'}</strong>
                {activeEvent && (
                  <span className="text-slate-500">
                    {' '}
                    ({typeLabel.toLowerCase()} · {guests} guests)
                  </span>
                )}
                . Hover any photo for the gallery, or open the map to browse pins by the water.
              </p>
            </div>
          </div>
          <AiButton onClick={runAiInsights} loading={ai.isLoading} disabled={ai.isLoading}>
            {ai.isDone ? 'Refresh AI insights' : 'Get AI insights'}
          </AiButton>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarHeart className="w-3.5 h-3.5 text-brand-500" aria-hidden="true" />
            {typeLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-brand-500" aria-hidden="true" />
            {guests} guests
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-brand-500" aria-hidden="true" />
            venue slice: <span className="text-slate-800">{formatCurrency(venueBudget)}</span> of{' '}
            {formatCurrency(totalBudget)}
          </span>
          {bookedVenueId && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
              Current venue: {activeEvent?.venueName}
            </span>
          )}
        </div>
      </section>

      {/* ---------------- Preference bar ---------------- */}
      <section aria-labelledby="venue-prefs-title" className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-5">
        <h3 id="venue-prefs-title" className="text-sm font-bold text-slate-800 font-display">
          Describe your dream setting
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Pick a vibe below or type it naturally — e.g. “a lakeside hotel resort near the water”.
        </p>

        {/* Venue-type chips */}
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Venue style preferences">
          {VENUE_TYPES.map((t) => {
            const active = styleTags.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTag(t.id)}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  active
                    ? 'bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white border-transparent shadow-md shadow-brand-500/25'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:bg-brand-50/60'
                }`}
              >
                <span aria-hidden="true">{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Natural-language search */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "lakeside resort with sunset views for the reception"'
              aria-label="Describe your ideal venue in words"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
          </div>
          {hasPrefs && (
            <button
              type="button"
              onClick={clearPreferences}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-2xl px-3.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Clear preferences
            </button>
          )}
        </div>

        {/* Parsed preference pills — transparency for the NL parser */}
        {activePrefs.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-live="polite">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Interpreted as
            </span>
            {[...activePrefs].map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Venue budget slice */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Venue share of budget
          </span>
          {SHARE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={share === opt.value}
              onClick={() => setShare(opt.value)}
              className={`text-xs font-bold px-3 py-1 rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                share === opt.value
                  ? 'bg-slate-900 text-white border-transparent'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {opt.label}
              <span className="ml-1 font-semibold text-[11px] opacity-80">
                ({formatCurrency(Math.round(totalBudget * opt.value))})
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ---------------- AI insight banner ---------------- */}
      {ai.isLoading && (
        <section className="rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/60 p-5 shadow-card" role="status">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
            <Sparkles className="w-4 h-4 animate-pulse" aria-hidden="true" />
            AI venue scout is analyzing your top 5 matches…
          </p>
        </section>
      )}

      {ai.result && (
        <section
          aria-labelledby="ai-venue-summary"
          className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50/50 to-rose-50/40 shadow-card p-5"
        >
          <div className="flex items-start gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-rose-400 text-white flex items-center justify-center shrink-0 shadow-md" aria-hidden="true">
              <Sparkles className="w-5 h-5" />
            </span>
            <p id="ai-venue-summary" className="text-sm text-slate-800 font-semibold leading-relaxed flex-1">
              {ai.result.data.summary}
            </p>
          </div>
          {ai.result.data.tips?.length > 0 && (
            <ul className="mt-3 grid sm:grid-cols-3 gap-2">
              {ai.result.data.tips.slice(0, 3).map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-1.5 text-xs text-slate-700 bg-white/70 border border-amber-200/60 rounded-2xl px-3 py-2 leading-relaxed"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-px" aria-hidden="true" />
                  {tip}
                </li>
              ))}
            </ul>
          )}
          <AiSourceNote result={ai.result} />
        </section>
      )}

      {ai.isIdle && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500 px-1" aria-live="polite">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          Tap <strong className="text-slate-700">Get AI insights</strong> to have the GenAI venue scout write a
          personalized rationale and negotiation tips for the top 5 matches.
        </p>
      )}
      <AiErrorNote error={ai.error} />

      {/* ---------------- Cards + map ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Map — first on mobile, sticky sidebar on desktop */}
        <div className="lg:col-span-2 order-1 lg:order-2 lg:sticky lg:top-28">
          <div className="h-72 sm:h-80 lg:h-[500px]" role="complementary" aria-label="Venue map">
            <VenueMap
              scoredVenues={scored}
              matchedIds={matchedIds}
              selectedId={selectedId}
              highlightedId={highlightedId}
              focus={selectedVenue ? selectedVenue.venue.coords : null}
              onSelect={setSelectedId}
              formatCost={formatCurrency}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400 text-center font-medium" aria-live="polite">
            Showing {visibleCount} of {VENUES.length} venues on the map
            {matchedIds ? ' matching your preferences' : ' — all ranked for your event'}
          </p>
        </div>

        {/* Ranked cards */}
        <div className="lg:col-span-3 order-2 lg:order-1 grid grid-cols-1 md:grid-cols-2 gap-5">
          {scored.map((s, i) => (
            <VenueCard
              key={s.venue.id}
              scored={s}
              rank={i}
              aiInsight={aiInsightById[s.venue.id] || null}
              isAiLoading={ai.isLoading}
              isBooked={s.venue.id === bookedVenueId}
              isSelected={s.venue.id === selectedId}
              onSelect={setSelectedId}
              onHoverStart={() => setHighlightedId(s.venue.id)}
              onHoverEnd={() => setHighlightedId(null)}
              onBook={handleBook}
              formatCost={formatCurrency}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
