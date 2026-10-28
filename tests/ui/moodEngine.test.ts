import { describe, expect, test } from 'bun:test';
import {
  PARTY_MOODS,
  hexToRgba,
  resolveEventVenue,
  deriveCelebrationMood,
} from '../../src/lib/ui/moodEngine';
import { VENUES, VENUE_TYPES } from '../../src/data/venues';
import { EVENT_TYPES } from '../../src/data/defaultData';

/* Every vibe label a venue can stamp onto the mood phrase. */
const TYPE_TO_VIBE_LABEL = {
  lakeside: 'Waterside',
  marina: 'Waterside',
  beach: 'Waterside',
  resort: 'Resort',
  garden: 'Garden',
  rooftop: 'City Night',
  loft: 'City Night',
  banquet: 'City Night',
  convention: 'City Night',
  vineyard: 'Vineyard',
  barn: 'Ranch',
  ballroom: 'Black-Tie',
};

const lakefrontWedding = { type: 'wedding', venueId: 'lakeside-pavilion' };

/* ------------------------------------------------------------------ */
/* hexToRgba                                                           */
/* ------------------------------------------------------------------ */

describe('hexToRgba', () => {
  test('converts #RRGGBB with alpha', () => {
    expect(hexToRgba('#0891B2', 0.12)).toBe('rgba(8, 145, 178, 0.12)');
    expect(hexToRgba('E11D48', 1)).toBe('rgba(225, 29, 72, 1)');
  });

  test('returns the raw input when it is not a 6-digit hex', () => {
    expect(hexToRgba('nope', 0.5)).toBe('nope');
    expect(hexToRgba('#089', 0.5)).toBe('#089');
    expect(hexToRgba('', 0.5)).toBe('');
    expect(hexToRgba(null, 0.5)).toBe('');
  });
});

/* ------------------------------------------------------------------ */
/* resolveEventVenue                                                   */
/* ------------------------------------------------------------------ */

describe('resolveEventVenue', () => {
  test('resolves by explicit venueId first', () => {
    const v = resolveEventVenue(lakefrontWedding);
    expect(v?.id).toBe('lakeside-pavilion');
  });

  test('falls back to case-insensitive venueName match', () => {
    const v = resolveEventVenue({
      type: 'wedding',
      venueName: '  lakeside SERENITY pavilion ',
    });
    expect(v?.id).toBe('lakeside-pavilion');
  });

  test('venueId wins when both id and name are set but disagree', () => {
    const v = resolveEventVenue({
      type: 'wedding',
      venueId: 'aurora-rooftop',
      venueName: 'Lakeside Serenity Pavilion',
    });
    expect(v?.id).toBe('aurora-rooftop');
  });

  test('a stale venueId still resolves via the saved name', () => {
    const v = resolveEventVenue({
      type: 'wedding',
      venueId: 'no-longer-in-catalog',
      venueName: 'The Heritage Grand Ballroom',
    });
    expect(v?.id).toBe('heritage-ballroom');
  });

  test('returns null for unknown, empty, or missing inputs', () => {
    expect(resolveEventVenue(null)).toBeNull();
    expect(resolveEventVenue({ type: 'wedding' })).toBeNull();
    expect(
      resolveEventVenue({ type: 'wedding', venueName: 'Nowhere Known' })
    ).toBeNull();
    expect(resolveEventVenue({ type: 'wedding', venueId: 'ghost-id' })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* deriveCelebrationMood — party type drives the base look              */
/* ------------------------------------------------------------------ */

describe('deriveCelebrationMood — party types', () => {
  test('null event falls back to the neutral default mood', () => {
    const mood = deriveCelebrationMood(null);
    expect(mood.typeLabel).toBe('Celebration');
    expect(mood.typeIcon).toBe('🎉');
    expect(mood.hasVenue).toBe(false);
    expect(mood.heroImage).toBe('');
    expect(mood.gradient).toBe(PARTY_MOODS.other.gradient);
    expect(mood.accent).toBe(PARTY_MOODS.other.accent);
  });

  test('every catalog event type gets its own party gradient', () => {
    const seen = new Map();
    for (const t of EVENT_TYPES) {
      const mood = deriveCelebrationMood({ type: t.id });
      expect(mood.gradient).toBe(PARTY_MOODS[t.id].gradient);
      expect(mood.accent).toBe(PARTY_MOODS[t.id].accent);
      expect(mood.typeLabel).toBe(t.label);
      expect(mood.typeIcon).toBe(t.icon);
      expect(mood.moodPhrase).toBe(t.label); // no venue → phrase is just the type
      seen.set(t.id, mood.gradient);
    }
    expect(seen.size).toBe(EVENT_TYPES.length);
  });

  test('unknown party type falls back to the "other" mood', () => {
    const mood = deriveCelebrationMood({ type: 'quinceanera' });
    expect(mood.gradient).toBe(PARTY_MOODS.other.gradient);
    expect(mood.typeLabel).toBe('Celebration');
    expect(mood.moodPhrase).toBe('Celebration');
  });

  test('without a venue there is no backdrop photo or vibe', () => {
    const mood = deriveCelebrationMood({ type: 'birthday' });
    expect(mood.hasVenue).toBe(false);
    expect(mood.venueName).toBe('');
    expect(mood.heroImage).toBe('');
    expect(mood.venueThumb).toBe('');
  });

  test('gradient tokens are literal Tailwind classes (JIT compile safety)', () => {
    const mood = deriveCelebrationMood({ type: 'wedding' });
    expect(mood.gradient.startsWith('from-')).toBe(true);
    expect(mood.gradient).toContain(' via-');
    expect(mood.gradient).toContain(' to-');
  });
});

/* ------------------------------------------------------------------ */
/* deriveCelebrationMood — the booked venue recolors the scene          */
/* ------------------------------------------------------------------ */

describe('deriveCelebrationMood — venue vibe overrides', () => {
  test('booked venue wins over party gradient and injects its photo', () => {
    const mood = deriveCelebrationMood(lakefrontWedding);
    const lake = VENUES.find((v) => v.id === 'lakeside-pavilion')!;
    expect(mood.hasVenue).toBe(true);
    expect(mood.gradient).toBe('from-cyan-950 via-teal-950 to-slate-950'); // waterfront, not rose wedding
    expect(mood.glowA).toBe('bg-cyan-400/25');
    expect(mood.moodPhrase).toBe('Waterside Wedding');
    expect(mood.heroImage).toBe(lake.images[0]);
    expect(mood.venueThumb).toBe(lake.images[1]);
    expect(mood.venueName).toBe('Lakeside Serenity Pavilion');
    expect(mood.venueArea).toBe(lake.area);
    // waterfront vibe accent outranks the party-type default
    expect(mood.accent).toBe('#0891B2');
  });

  test('a barn wedding swaps in the rustic ranch vibe', () => {
    const mood = deriveCelebrationMood({ type: 'wedding', venueId: 'hill-country-ranch' });
    expect(mood.gradient).toBe('from-amber-950 via-stone-950 to-slate-950');
    expect(mood.moodPhrase).toBe('Ranch Wedding');
    expect(mood.accent).toBe('#D97706');
  });

  test('a ballroom gala goes black-tie', () => {
    const mood = deriveCelebrationMood({ type: 'gala', venueId: 'heritage-ballroom' });
    expect(mood.gradient).toBe('from-slate-950 via-stone-950 to-amber-950');
    expect(mood.moodPhrase).toBe('Black-Tie Charity Gala / Corporate');
  });

  test('every venue type in the catalog maps to a vibe family', () => {
    expect(VENUE_TYPES.length).toBe(12);
    for (const vt of VENUE_TYPES) {
      const syntheticVenue = {
        id: `synthetic-${vt.id}`,
        name: `Synthetic ${vt.label}`,
        type: vt.id,
        area: 'Test area',
        images: [],
      };
      const mood = deriveCelebrationMood(
        { type: 'birthday', venueId: syntheticVenue.id },
        [syntheticVenue]
      );
      expect(mood.hasVenue).toBe(true);
      // A mapped vibe always rewrites the phrase away from the bare type label.
      expect(mood.moodPhrase).toBe(`${TYPE_TO_VIBE_LABEL[vt.id]} Birthday Party`);
      // image-less venues degrade gracefully (no crash, empty backdrop)
      expect(mood.heroImage).toBe('');
      expect(mood.venueThumb).toBe('');
    }
  });

  test('all 16 catalog venues derive cleanly with correct imagery', () => {
    for (const v of VENUES) {
      const mood = deriveCelebrationMood({ type: 'wedding', venueId: v.id });
      expect(mood.hasVenue).toBe(true);
      expect(mood.heroImage).toBe(v.images[0]);
      expect(mood.venueThumb).toBe(v.images[1]);
      expect(mood.moodPhrase.startsWith(`${TYPE_TO_VIBE_LABEL[v.type]} `)).toBe(true);
    }
  });

  test('a venue with an unmapped type id keeps the party gradient', () => {
    const oddVenue = { id: 'odd-1', name: 'Odd Space', type: 'space-station', images: [] };
    const mood = deriveCelebrationMood({ type: 'wedding', venueId: 'odd-1' }, [oddVenue]);
    expect(mood.hasVenue).toBe(true);
    expect(mood.moodPhrase).toBe('Wedding'); // vibe lookup failed → bare type
    expect(mood.gradient).toBe(PARTY_MOODS.wedding.gradient);
    expect(mood.accent).toBe(PARTY_MOODS.wedding.accent);
  });
});

/* ------------------------------------------------------------------ */
/* deriveCelebrationMood — applied AI theme is the user's pick          */
/* ------------------------------------------------------------------ */

describe('deriveCelebrationMood — theme accent precedence', () => {
  test('the applied AI theme color outranks venue and party accents', () => {
    const mood = deriveCelebrationMood({ ...lakefrontWedding, themeColor: '#123456' });
    expect(mood.accent).toBe('#123456');
    // …but the venue still owns the backdrop
    expect(mood.gradient).toBe('from-cyan-950 via-teal-950 to-slate-950');
    expect(mood.accentSoft).toBe('rgba(18, 52, 86, 0.12)');
    expect(mood.accentFaint).toBe('rgba(18, 52, 86, 0.07)');
  });

  test('malformed theme colors are ignored, not trusted', () => {
    for (const bad of ['red', '#12345', '#1234567', '123456', '#12G45Z']) {
      const mood = deriveCelebrationMood({ ...lakefrontWedding, themeColor: bad });
      expect(mood.accent).toBe('#0891B2'); // falls back to the waterfront vibe
    }
  });

  test('accent soft/faint tints always track the winning accent', () => {
    const party = deriveCelebrationMood({ type: 'anniversary' });
    expect(party.accent).toBe('#D97706');
    expect(party.accentSoft).toBe('rgba(217, 119, 6, 0.12)');
    expect(party.accentFaint).toBe('rgba(217, 119, 6, 0.07)');
  });
});
