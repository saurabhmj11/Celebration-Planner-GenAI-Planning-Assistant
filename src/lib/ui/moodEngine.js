/**
 * Celebration Mood Engine — makes the whole UI adapt to the party being
 * planned AND the venue it will happen at.
 *
 * Three inputs decide the mood, in this precedence:
 *   1. Party type (wedding / birthday / community / anniversary / gala /
 *      babyshower / other) — always present, drives the base palette.
 *   2. Booked venue (resolved by venueId, falling back to venueName) —
 *      overrides the backdrop: the hero renders the venue's photo under a
 *      vibe-tinted scrim (waterside teal, garden emerald, neon rooftop,
 *      vineyard, rustic barn, black-tie ballroom…), and nudges the accent.
 *   3. The user's applied AI Theme (event.themeColor) — the one color they
 *      explicitly chose wins over both for accent tinting.
 *
 * Everything is deterministic and offline-safe (pure functions over the local
 * venue catalog) so tests cover the full matrix. Gradient/glow tokens are
 * literal Tailwind classes so the Tailwind v4 scanner keeps them compiled.
 */

import { VENUES } from '../../data/venues';
import { EVENT_TYPES } from '../../data/defaultData';

/* ------------------------------------------------------------------ */
/* Party-type moods — one per celebration type (no more 'other' gaps)  */
/* ------------------------------------------------------------------ */

export const PARTY_MOODS = {
  wedding: {
    gradient: 'from-rose-950 via-fuchsia-950 to-slate-950',
    glowA: 'bg-rose-500/25',
    glowB: 'bg-amber-500/15',
    accent: '#E11D48', // rose-600
  },
  birthday: {
    gradient: 'from-violet-950 via-brand-950 to-fuchsia-950',
    glowA: 'bg-brand-500/25',
    glowB: 'bg-pink-500/15',
    accent: '#7C3AED', // violet-600
  },
  community: {
    gradient: 'from-emerald-950 via-teal-950 to-slate-950',
    glowA: 'bg-emerald-500/25',
    glowB: 'bg-cyan-500/15',
    accent: '#059669', // emerald-600
  },
  anniversary: {
    gradient: 'from-amber-950 via-rose-950 to-slate-950',
    glowA: 'bg-amber-500/25',
    glowB: 'bg-rose-500/15',
    accent: '#D97706', // amber-600 (golden toast)
  },
  gala: {
    gradient: 'from-slate-950 via-stone-950 to-amber-950',
    glowA: 'bg-amber-400/25',
    glowB: 'bg-yellow-500/15',
    accent: '#B45309', // amber-700 (black-tie gold)
  },
  babyshower: {
    gradient: 'from-cyan-950 via-teal-950 to-rose-950',
    glowA: 'bg-cyan-400/25',
    glowB: 'bg-rose-400/15',
    accent: '#0891B2', // cyan-600 (pastel-watercolor)
  },
  other: {
    gradient: 'from-slate-900 via-brand-950 to-fuchsia-950',
    glowA: 'bg-brand-500/20',
    glowB: 'bg-rose-500/15',
    accent: '#7C3AED',
  },
};

/* ------------------------------------------------------------------ */
/* Venue vibe families — the setting of the party recolors the scene   */
/* ------------------------------------------------------------------ */

const VENUE_VIBES = {
  waterfront: {
    gradient: 'from-cyan-950 via-teal-950 to-slate-950',
    glowA: 'bg-cyan-400/25',
    glowB: 'bg-teal-500/15',
    accent: '#0891B2', // cyan-600
    label: 'Waterside',
  },
  resort: {
    gradient: 'from-teal-950 via-emerald-950 to-slate-950',
    glowA: 'bg-emerald-400/25',
    glowB: 'bg-cyan-500/15',
    accent: '#0D9488', // teal-600
    label: 'Resort',
  },
  garden: {
    gradient: 'from-emerald-950 via-teal-950 to-slate-950',
    glowA: 'bg-emerald-500/25',
    glowB: 'bg-lime-500/15',
    accent: '#059669', // emerald-600
    label: 'Garden',
  },
  cityNight: {
    gradient: 'from-slate-950 via-violet-950 to-fuchsia-950',
    glowA: 'bg-fuchsia-500/25',
    glowB: 'bg-violet-500/15',
    accent: '#7C3AED', // violet-600
    label: 'City Night',
  },
  vineyard: {
    gradient: 'from-purple-950 via-violet-950 to-rose-950',
    glowA: 'bg-fuchsia-500/25',
    glowB: 'bg-purple-500/15',
    accent: '#A21CAF', // fuchsia-700 (grape wine)
    label: 'Vineyard',
  },
  rustic: {
    gradient: 'from-amber-950 via-stone-950 to-slate-950',
    glowA: 'bg-amber-500/25',
    glowB: 'bg-orange-600/15',
    accent: '#D97706', // amber-600
    label: 'Ranch',
  },
  blackTie: {
    gradient: 'from-slate-950 via-stone-950 to-amber-950',
    glowA: 'bg-amber-400/25',
    glowB: 'bg-yellow-500/15',
    accent: '#B45309',
    label: 'Black-Tie',
  },
};

/** venue type id → vibe family (every VENUE_TYPES id must map). */
const VENUE_TYPE_VIBE = {
  lakeside: 'waterfront',
  marina: 'waterfront',
  beach: 'waterfront',
  resort: 'resort',
  garden: 'garden',
  rooftop: 'cityNight',
  loft: 'cityNight',
  banquet: 'cityNight',
  convention: 'cityNight',
  vineyard: 'vineyard',
  barn: 'rustic',
  ballroom: 'blackTie',
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** `#RRGGBB` + alpha 0..1 → `rgba(r, g, b, a)`. Falls back to the raw input. */
export function hexToRgba(hex, alpha = 1) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return String(hex || '');
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Find the catalog venue booked on an event — by explicit venueId first,
 * then by matching the saved venue name (case-insensitive), else null.
 */
export function resolveEventVenue(event, venues = VENUES) {
  if (!event || !Array.isArray(venues)) return null;
  if (event.venueId) {
    const byId = venues.find((v) => v.id === event.venueId);
    if (byId) return byId;
  }
  if (event.venueName) {
    const needle = String(event.venueName).toLowerCase().trim();
    return venues.find((v) => v.name.toLowerCase().trim() === needle) || null;
  }
  return null;
}

const DEFAULT_MOOD = {
  typeLabel: 'Celebration',
  typeIcon: '🎉',
  moodPhrase: 'Celebration',
  hasVenue: false,
  venueName: '',
  venueArea: '',
  venueThumb: '',
  heroImage: '',
  gradient: PARTY_MOODS.other.gradient,
  glowA: PARTY_MOODS.other.glowA,
  glowB: PARTY_MOODS.other.glowB,
  accent: PARTY_MOODS.other.accent,
  accentSoft: hexToRgba(PARTY_MOODS.other.accent, 0.12),
  accentFaint: hexToRgba(PARTY_MOODS.other.accent, 0.07),
};

/**
 * Derive the full visual mood for an event.
 * @returns {{
 *   typeLabel, typeIcon, moodPhrase, hasVenue, venueName, venueArea,
 *   venueThumb, heroImage, gradient, glowA, glowB, accent, accentSoft, accentFaint
 * }}
 */
export function deriveCelebrationMood(event, venues = VENUES) {
  if (!event) return DEFAULT_MOOD;

  const typeInfo = EVENT_TYPES.find((t) => t.id === event.type);
  const party = PARTY_MOODS[event.type] || PARTY_MOODS.other;
  const typeLabel = typeInfo?.label || 'Celebration';
  const typeIcon = typeInfo?.icon || '🎉';

  const venue = resolveEventVenue(event, venues);
  const vibe = venue ? VENUE_VIBES[VENUE_TYPE_VIBE[venue.type] || ''] : null;

  // Backdrop: booked venue wins (its photo under a vibe-tinted scrim).
  const gradient = vibe ? vibe.gradient : party.gradient;
  const glowA = vibe ? vibe.glowA : party.glowA;
  const glowB = vibe ? vibe.glowB : party.glowB;

  // Accent: the user's applied AI theme is the one color they hand-picked,
  // so it outranks the vibe, which outranks the party-type default.
  const accent =
    (typeof event.themeColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(event.themeColor) && event.themeColor) ||
    (vibe ? vibe.accent : null) ||
    party.accent;

  const moodPhrase = vibe ? `${vibe.label} ${typeLabel}` : typeLabel;

  return {
    typeLabel,
    typeIcon,
    moodPhrase,
    hasVenue: Boolean(venue),
    venueName: venue?.name || '',
    venueArea: venue?.area || '',
    venueThumb: venue?.images?.[1] || venue?.images?.[0] || '',
    heroImage: venue?.images?.[0] || '',
    gradient,
    glowA,
    glowB,
    accent,
    accentSoft: hexToRgba(accent, 0.12),
    accentFaint: hexToRgba(accent, 0.07),
  };
}
