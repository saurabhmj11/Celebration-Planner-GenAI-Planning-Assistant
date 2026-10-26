'use client';

import React from 'react';
import {
  Star,
  MapPin,
  Users,
  CheckCircle2,
  TriangleAlert,
  Sparkles,
  Handshake,
  Info,
  BadgeCheck,
  MapPinned,
} from 'lucide-react';

/**
 * One venue result card.
 *
 * - Hover reveals the venue's photo gallery overlay with quick facts and
 *   actions (the user's "hover shows venue images" requirement).
 * - The algorithm's score breakdown is rendered as a tiny bar chart so every
 *   recommendation is explainable, not a black box.
 * - When AI insights were fetched, the GenAI rationale + negotiation tip show
 *   in an amber AI panel.
 */

const FACTOR_LABELS = [
  ['eventTypeFit', 'Event fit'],
  ['capacityFit', 'Capacity'],
  ['budgetFit', 'Budget'],
  ['styleMatch', 'Style'],
  ['ratingBoost', 'Rating'],
];

const scoreTone = (score) => {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 70) return 'bg-amber-500';
  return 'bg-slate-500';
};

export function VenueCard({
  scored,
  rank = 0,
  aiInsight = null,
  isBooked = false,
  isSelected = false,
  isAiLoading = false,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onBook,
  formatCost,
}) {
  const { venue, score, estCost, breakdown, reasons, warnings } = scored;
  const perGuest = Math.round(estCost / Math.max(1, venue.capacity.max));

  return (
    <article
      aria-labelledby={`venue-${venue.id}-name`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className={`group relative bg-white rounded-3xl border overflow-hidden shadow-card transition-all hover:shadow-xl ${
        isSelected ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/30' : 'border-slate-200/80'
      }`}
    >
      {/* Photo + hover gallery overlay */}
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
        <img
          src={venue.images[0]}
          alt={`${venue.name} — ${venue.type} venue`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className={`text-white text-xs font-extrabold px-2.5 py-1 rounded-full shadow-md ${scoreTone(score)}`}
            title="Algorithm match score (0-100)"
          >
            {Math.round(score)}% match
          </span>
          {rank === 0 && (
            <span className="text-[11px] font-bold text-amber-950 bg-gradient-to-r from-amber-300 to-amber-200 px-2.5 py-1 rounded-full shadow-md border border-amber-400/60">
              🏆 Best match
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur px-2 py-1 rounded-full shadow-sm">
          <Star className="w-3 h-3 text-amber-500 fill-amber-500" aria-hidden="true" />
          <span className="text-[11px] font-bold text-slate-800">
            {venue.rating.toFixed(1)}
            <span className="text-slate-400 font-medium"> ({venue.reviews})</span>
          </span>
        </div>
        {isBooked && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-emerald-600/95 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md">
            <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Booked for this event
          </div>
        )}

        {/* Hover overlay — the venue image gallery + quick facts (desktop hover; tap-visible via focus) */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-slate-900/30 p-4 flex flex-col justify-end gap-3">
          <div className="flex gap-2" aria-label={`${venue.name} gallery`}>
            {venue.images.map((img, i) => (
              <img
                key={img}
                src={img}
                alt={`${venue.name} photo ${i + 1}`}
                className="h-16 w-24 sm:h-[74px] sm:w-36 object-cover rounded-xl border border-white/30 shadow-lg"
              />
            ))}
          </div>
          <div className="text-white">
            <p className="text-sm font-bold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-fuchsia-300" aria-hidden="true" />
              {venue.area}
            </p>
            <p className="text-xs text-slate-200 mt-1 flex flex-wrap gap-x-3">
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3" aria-hidden="true" />
                {venue.capacity.min}–{venue.capacity.max} guests
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-extrabold text-amber-300">≈ {formatCost(estCost)}</span> est.
              </span>
              <span className="text-slate-300">≈ {formatCost(perGuest)}/guest max</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelect(venue.id)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <MapPinned className="w-3.5 h-3.5" aria-hidden="true" />
              Show on map
            </button>
            <button
              type="button"
              onClick={() => onBook(scored)}
              disabled={isBooked}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-brand-500 to-fuchsia-600 hover:from-brand-600 hover:to-fuchsia-700 rounded-xl px-3 py-1.5 shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              {isBooked ? 'Already booked' : 'Book for this event'}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={`venue-${venue.id}-name`} className="font-display font-extrabold text-slate-900 text-base leading-snug truncate">
              {venue.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-brand-500 shrink-0" aria-hidden="true" />
              <span className="truncate">{venue.area}</span>
            </p>
          </div>
          <span className="shrink-0 text-xl" role="img" aria-label="venue type">
            {VENUE_TYPE_EMOJI[venue.type] || '📍'}
          </span>
        </div>

        <p className="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-2">{venue.description}</p>

        {/* Algorithm reasons */}
        {reasons.length > 0 && (
          <ul className="mt-3 space-y-1">
            {reasons.map((r) => (
              <li key={r} className="flex items-start gap-1.5 text-xs text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" aria-hidden="true" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}

        {warnings.length > 0 && (
          <ul className="mt-2 space-y-1">
            {warnings.map((w) => (
              <li key={w} className="flex items-start gap-1.5 text-xs text-amber-700 font-medium">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Score transparency — factor bars */}
        <div className="mt-3.5 pt-3 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            How this match was scored
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {FACTOR_LABELS.map(([key, label]) => (
              <div key={key} title={`${label}: ${breakdown[key]}/100`}>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreTone(breakdown[key])}`}
                    style={{ width: `${breakdown[key]}%` }}
                  />
                </div>
                <p className="text-[9px] font-semibold text-slate-400 mt-0.5 text-center">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* GenAI insight */}
        {aiInsight && (
          <div className="mt-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/70 border border-amber-200/80 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-extrabold text-amber-700 uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              AI venue scout
            </p>
            <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">{aiInsight.whyItFits}</p>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed flex items-start gap-1.5">
              <Handshake className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-px" aria-hidden="true" />
              <span>{aiInsight.negotiationTip}</span>
            </p>
            {aiInsight.costSuggestion && (
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" aria-hidden="true" />
                <span>{aiInsight.costSuggestion}</span>
              </p>
            )}
          </div>
        )}
        {isAiLoading && (
          <div className="mt-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 p-3 animate-pulse" aria-label="AI is analyzing this venue">
            <div className="h-2 bg-amber-200/70 rounded-full w-2/3" />
            <div className="h-2 bg-amber-200/50 rounded-full w-full mt-2" />
          </div>
        )}

        {/* Footer — cost + actions */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-extrabold text-slate-900 font-display leading-none">
              {formatCost(estCost)}
            </p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">
              est. total · base {formatCost(venue.pricing.base)} + {formatCost(venue.pricing.perGuest)}/guest + 10% fee
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(venue.id)}
              aria-pressed={isSelected}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              title="Show on map"
              aria-label={`Show ${venue.name} on map`}
            >
              <MapPinned className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onBook(scored)}
              disabled={isBooked}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 disabled:from-emerald-600 disabled:to-emerald-600 disabled:cursor-not-allowed rounded-xl px-3.5 py-2 shadow-md shadow-brand-500/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {isBooked ? (
                <>
                  <BadgeCheck className="w-4 h-4" aria-hidden="true" />
                  Booked
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Book venue
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

const VENUE_TYPE_EMOJI = {
  lakeside: '🌊',
  resort: '🏝️',
  garden: '🌿',
  rooftop: '🌆',
  beach: '🏖️',
  barn: '🌾',
  vineyard: '🍇',
  ballroom: '🏛️',
  banquet: '🎊',
  loft: '🎨',
  marina: '⛵',
  convention: '🎪',
};
