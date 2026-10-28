/**
 * Venue recommendation algorithm — pure, deterministic, unit-tested.
 *
 * Hybrid-AI design: this engine computes the ranked shortlist (scores,
 * estimated costs, warnings) that is then ENRICHED by the GenAI layer
 * (personalized rationale + negotiation tips), so the model can never
 * hallucinate a venue that isn't in the curated catalog.
 *
 * Scoring model (weighted multi-factor, each factor normalized 0-100):
 *   eventTypeFit (30%) — curated venue affinity for this celebration type
 *   capacityFit  (22%) — guests vs [min,max] range with falloffs + warnings
 *   budgetFit    (22%) — estimated cost vs the venue budget slice
 *   styleMatch   (16%) — chip/keyword preferences vs venue tags (synonyms!)
 *   ratingBoost  ( 8%) — social proof from curated reviews
 */

export interface Venue {
  id: string;
  name: string;
  type: string;
  area?: string;
  capacity: { min: number; max: number };
  pricing: { base: number; perGuest: number };
  affinity: Record<string, number>;
  rating: number;
  tags: string[];
}

export interface VenueCriteria {
  eventType: string;
  guestCount: number;
  /** Budget slice reserved for the venue (absolute dollars). */
  venueBudget: number;
  /** Explicit style chips, e.g. ['lakeside','resort']. */
  styleTags?: string[];
  /** Free-text wish, e.g. "a lakeside hotel resort near the water". */
  query?: string;
}

export interface ScoredVenue {
  venue: Venue;
  score: number; // 0-100 integer
  estCost: number;
  breakdown: {
    eventTypeFit: number;
    capacityFit: number;
    budgetFit: number;
    styleMatch: number;
    ratingBoost: number;
  };
  reasons: string[];
  warnings: string[];
}

export const VENUE_WEIGHTS = {
  eventTypeFit: 0.3,
  capacityFit: 0.22,
  budgetFit: 0.22,
  styleMatch: 0.16,
  ratingBoost: 0.1,
} as const;

/**
 * Adaptive weights — when the user states an explicit style wish (chips or a
 * natural-language query), preference matching becomes the dominant signal
 * (0.28) and generic event-type affinity steps back (0.22), so a marina can't
 * beat the hotel resort the user literally asked for.
 */
const EXPLICIT_PREF_WEIGHTS = {
  eventTypeFit: 0.22,
  capacityFit: 0.22,
  budgetFit: 0.18,
  styleMatch: 0.28,
  ratingBoost: 0.1,
} as const;

function weightsFor(hasExplicitPrefs: boolean) {
  return hasExplicitPrefs ? EXPLICIT_PREF_WEIGHTS : VENUE_WEIGHTS;
}

/** Service/admin fee added on top of base + per-guest pricing. */
const SERVICE_FEE_RATE = 0.1;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/* ------------------------------------------------------------------ */
/* Cost estimation                                                    */
/* ------------------------------------------------------------------ */

/** Deterministic cost estimate: base fee + per-guest rate + 10% service fee. */
export function estimateVenueCost(venue: Venue, guestCount: number): number {
  const guests = Math.max(0, Math.floor(guestCount || 0));
  const raw = venue.pricing.base + venue.pricing.perGuest * guests;
  return Math.round(raw * (1 + SERVICE_FEE_RATE));
}

/* ------------------------------------------------------------------ */
/* Natural-language preference parsing                                */
/* ------------------------------------------------------------------ */

/**
 * Keyword -> canonical tag synonyms. Lets "near the lake" hit venues tagged
 * lakeside/waterfront/marina/beach, and "hotel resort" hit resort/hotel/spa.
 */
const SYNONYMS: Record<string, string[]> = {
  lake: ["lakeside", "lakefront", "waterfront", "marina", "beach", "boat", "waterside"],
  water: ["waterfront", "lakeside", "marina", "beach", "pool"],
  resort: ["resort", "hotel"],
  hotel: ["hotel", "resort"],
  spa: ["resort", "spa", "hotel"],
  garden: ["garden", "botanical", "conservatory", "floral", "glasshouse"],
  greenhouse: ["conservatory", "glasshouse", "garden"],
  rooftop: ["rooftop", "skyline", "cityview"],
  skyline: ["rooftop", "skyline", "cityview"],
  city: ["rooftop", "cityview", "skyline", "nightlife"],
  beach: ["beach", "cabana", "sand"],
  sand: ["beach"],
  barn: ["barn", "rustic", "countryside"],
  ranch: ["ranch", "barn", "rustic", "countryside"],
  rustic: ["rustic", "barn", "countryside"],
  vineyard: ["vineyard", "wine"],
  wine: ["vineyard", "wine"],
  ballroom: ["ballroom", "elegant", "banquet", "luxury"],
  banquet: ["banquet", "ballroom", "dinner"],
  dance: ["nightlife", "banquet", "ballroom"],
  dj: ["nightlife", "rooftop", "loft"],
  neon: ["nightlife", "rooftop", "loft", "modern"],
  party: ["nightlife", "beach", "loft", "rooftop"],
  outdoor: ["outdoor", "lakeside", "garden", "beach", "ranch", "vineyard", "pavilion", "barn", "marina"],
  outside: ["outdoor", "lakeside", "garden", "beach", "ranch", "vineyard", "pavilion", "barn", "marina"],
  indoor: ["indoor", "ballroom", "banquet", "loft", "convention", "conservatory"],
  inside: ["indoor", "ballroom", "banquet", "loft", "convention", "conservatory"],
  luxury: ["luxury", "resort", "ballroom", "marina"],
  elegant: ["elegant", "ballroom", "conservatory", "luxury"],
  fancy: ["luxury", "ballroom", "elegant", "resort"],
  cheap: ["budget"],
  affordable: ["budget", "community"],
  budget: ["budget", "community"],
  community: ["community", "park", "pavilion", "budget"],
  family: ["family", "community", "park", "budget"],
  kids: ["family", "community", "casual", "beach"],
  romantic: ["romantic", "sunset", "floral", "vineyard", "string-lights"],
  sunset: ["sunset", "lakeside", "marina", "rooftop", "vineyard"],
  cozy: ["cozy", "intimate", "loft"],
  small: ["cozy", "intimate", "loft"],
  intimate: ["intimate", "cozy", "loft"],
  big: ["large", "convention"],
  large: ["large", "convention", "ballroom"],
  huge: ["large", "convention"],
  convention: ["convention", "large", "stage"],
  expo: ["convention", "large"],
  fundraiser: ["convention", "gala", "stage", "ballroom"],
  accessible: ["accessible", "indoor"],
};

const STOP_WORDS = new Set([
  "a", "an", "the", "for", "near", "close", "to", "with", "and", "or", "of", "at",
  "in", "on", "by", "want", "wanted", "like", "would", "love", "some", "any",
  "need", "must", "should", "something", "venue", "venues", "place",
  "location", "around", "is", "it", "that", "which", "be", "please", "find",
]);

/** Parse a free-text wish into preference concepts (with synonym expansion). */
export function parseVenuePreferences(
  query: string,
  venues: Venue[] = []
): { tags: string[]; concepts: string[][]; guestHint?: number; budgetHint?: number } {
  const allTags = new Set<string>();
  venues.forEach((v) => v.tags.forEach((t) => allTags.add(t)));

  const normalized = String(query || "").toLowerCase();
  const flatTags = new Set<string>();
  const concepts: string[][] = [];

  // Number extraction: "120 guests" / "under $5000"
  let guestHint: number | undefined;
  const guestMatch = normalized.match(/(\d{1,6})\s*(guests|people|attendees|persons)/);
  if (guestMatch) guestHint = clamp(parseInt(guestMatch[1], 10), 1, 100000);
  let budgetHint: number | undefined;
  const budgetMatch = normalized.match(/\$\s?(\d{1,9}(?:,\d{3})*)|(\d{4,9})\s*(?:dollar|budget)/);
  if (budgetMatch) {
    const raw = (budgetMatch[1] || budgetMatch[2] || "").replace(/,/g, "");
    budgetHint = clamp(parseInt(raw, 10) || 0, 0, 100000000);
  }

  const words = normalized.replace(/[^a-z0-9$\s-]/g, " ").split(/\s+/).filter(Boolean);
  for (const word of words) {
    const w = word.replace(/(es|s)$/, ""); // light stem: "gardens" -> "garden"
    if (STOP_WORDS.has(word) || w.length < 3) continue;

    // One CONCEPT per keyword: the keyword's synonym family — a venue
    // satisfies the concept when it carries ANY of these tags.
    const concept = new Set<string>();
    if (allTags.has(word)) concept.add(word);
    else if (allTags.has(w)) concept.add(w);
    const syns = SYNONYMS[word] ?? SYNONYMS[w];
    if (syns) syns.forEach((s) => concept.add(s));

    if (concept.size > 0) {
      concepts.push([...concept]);
      concept.forEach((t) => flatTags.add(t));
    }
  }

  return { tags: [...flatTags], concepts, guestHint, budgetHint };
}

/* ------------------------------------------------------------------ */
/* Factor scorers                                                     */
/* ------------------------------------------------------------------ */

export function scoreEventTypeFit(venue: Venue, eventType: string): number {
  const affinity = venue.affinity?.[eventType] ?? venue.affinity?.other ?? 0.5;
  return clamp(affinity * 100, 0, 100);
}

export function scoreCapacityFit(venue: Venue, guestCount: number): { fit: number; warning?: string } {
  const guests = Math.max(0, Math.floor(guestCount || 0));
  const { min, max } = venue.capacity;

  if (guests > max) {
    // Over max capacity — heavily penalized, grows with the overflow.
    const overflow = (guests - max) / max;
    return {
      fit: clamp(Math.round(35 - 35 * overflow), 0, 35),
      warning: `Only seats ${max} guests — ${guests - max} over capacity`,
    };
  }

  if (guests < min) {
    // Under the comfortable minimum — the venue will feel empty.
    const fill = guests / min; // 0..1
    return {
      fit: clamp(Math.round(40 + 45 * fill), 0, 85),
      warning: guests < min / 2 ? `Designed for ${min}+ guests — may feel empty` : undefined,
    };
  }

  // In range — full marks when utilizing >= 35% of max capacity.
  const utilization = guests / max;
  return {
    fit: clamp(Math.round(100 - Math.max(0, 0.35 - utilization) * 120), 70, 100),
  };
}

export function scoreBudgetFit(venue: Venue, guestCount: number, venueBudget: number): { fit: number; warning?: string } {
  if (venueBudget <= 0) return { fit: 50 };
  const est = estimateVenueCost(venue, guestCount);
  const ratio = est / venueBudget;

  if (ratio <= 1) {
    // Under budget: spending 70-100% of the venue slice is the sweet spot.
    const fit = 100 - Math.max(0, 0.7 - ratio) * 45;
    return { fit: clamp(Math.round(fit), 55, 100) };
  }

  // Over budget: gentle falloff — 25% over still scores ~60.
  const fit = 100 - (ratio - 1) * 160;
  return {
    fit: clamp(Math.round(fit), 0, 100),
    warning: `Estimate is ${Math.round((ratio - 1) * 100)}% over your venue budget`,
  };
}

/**
 * Concept-level style matching. Each preference concept is a keyword's
 * synonym family ("hotel" -> [hotel, resort]); a venue satisfies the concept
 * when it carries ANY of those tags. Fully satisfying every concept scores
 * 100, ignoring every concept scores 40 — an explicit miss on something the
 * user asked for (e.g. a marina when they wanted a HOTEL resort) costs.
 */
export function scoreStyleMatch(venue: Venue, preferredTags: string[], concepts: string[][] = []): number {
  const conceptList = concepts.length
    ? concepts
    : preferredTags.map((t) => [t]);
  if (!conceptList.length) return 60; // neutral when the user has no preference
  const venueTags = new Set(venue.tags);
  let satisfied = 0;
  for (const concept of conceptList) {
    if (concept.some((t) => venueTags.has(t))) satisfied += 1;
  }
  return clamp(Math.round(40 + 60 * (satisfied / conceptList.length)), 40, 100);
}

export function scoreRatingBoost(venue: Venue): number {
  return clamp(Math.round(((venue.rating - 3.5) / 1.5) * 100), 0, 100);
}

/* ------------------------------------------------------------------ */
/* Composite scorer                                                   */
/* ------------------------------------------------------------------ */

function humanizeFactor(venue: Venue, breakdown: ScoredVenue["breakdown"], estCost: number, venueBudget: number): string[] {
  const reasons: string[] = [];
  if (breakdown.eventTypeFit >= 80) reasons.push("Purpose-built for this celebration type");
  if (breakdown.capacityFit >= 95) reasons.push(`Comfortable fit for the guest list (up to ${venue.capacity.max})`);
  if (breakdown.budgetFit >= 90 && venueBudget > 0 && estCost <= venueBudget) {
    reasons.push(`Estimated ${Math.round((estCost / venueBudget) * 100)}% of the venue budget — safely inside it`);
  }
  if (breakdown.styleMatch > 60) reasons.push("Matches the style preferences you picked");
  if (breakdown.ratingBoost >= 80) reasons.push(`Guest favorite — ${venue.rating.toFixed(1)}★ rating`);
  return reasons.slice(0, 3);
}

/** Score every venue against the criteria; returns a descending-ranked list. */
export function scoreVenues(catalog: Venue[], criteria: VenueCriteria): ScoredVenue[] {
  const guests = clamp(Math.floor(criteria.guestCount || 0), 0, 100000);
  const venueBudget = Math.max(0, criteria.venueBudget || 0);

  const parsed = parseVenuePreferences(criteria.query || "", catalog);
  const preferredTags = [...new Set([...(criteria.styleTags || []), ...parsed.tags])];
  // Preference concepts: explicit chips (single-tag) + parsed keyword families,
  // deduplicated so repeating a word doesn't double-count.
  const seen = new Set<string>();
  const concepts: string[][] = [];
  (criteria.styleTags || []).forEach((t) => {
    if (!seen.has(t)) {
      seen.add(t);
      concepts.push([t]);
    }
  });
  parsed.concepts.forEach((c) => {
    const key = [...c].sort().join("|");
    if (!seen.has(key)) {
      seen.add(key);
      concepts.push(c);
    }
  });

  const scored = catalog.map((venue) => {
    const eventTypeFit = scoreEventTypeFit(venue, criteria.eventType);
    const capacity = scoreCapacityFit(venue, guests);
    const budget = scoreBudgetFit(venue, guests, venueBudget);
    const styleMatch = scoreStyleMatch(venue, preferredTags, concepts);
    const ratingBoost = scoreRatingBoost(venue);
    const estCost = estimateVenueCost(venue, guests);

    const weights = weightsFor(concepts.length > 0);
    const composite =
      eventTypeFit * weights.eventTypeFit +
      capacity.fit * weights.capacityFit +
      budget.fit * weights.budgetFit +
      styleMatch * weights.styleMatch +
      ratingBoost * weights.ratingBoost;

    const breakdown = {
      eventTypeFit,
      capacityFit: capacity.fit,
      budgetFit: budget.fit,
      styleMatch,
      ratingBoost,
    };

    const warnings: string[] = [];
    if (capacity.warning) warnings.push(capacity.warning);
    if (budget.warning) warnings.push(budget.warning);

    return {
      venue,
      estCost,
      score: clamp(Math.round(composite), 0, 100),
      breakdown,
      reasons: humanizeFactor(venue, breakdown, estCost, venueBudget),
      warnings,
    } satisfies ScoredVenue;
  });

  // Descending score; tie-break on rating then cheaper cost for stability.
  scored.sort((a, b) => b.score - a.score || b.venue.rating - a.venue.rating || a.estCost - b.estCost);
  return scored;
}

/** Top-N helper used by the booking modal's inline suggestions. */
export function topVenueSuggestions(
  catalog: Venue[],
  criteria: VenueCriteria,
  n = 3
): ScoredVenue[] {
  return scoreVenues(catalog, criteria).slice(0, n);
}
