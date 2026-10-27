/**
 * Pure photo-model helpers for the Event Photo Memory Wall.
 *
 * Everything here is environment-free (string math only — no DOM, no canvas)
 * so it can run in bun tests and in the browser alike:
 *  - metadata construction + hard caps (photos live inside localStorage)
 *  - data-URL validation/allow-listing (import + upload hardening)
 *  - storage estimation against the ~5MB localStorage budget
 *  - deterministic SVG "inspiration card" seeds for the sample events
 *
 * The only browser-only piece (canvas downscaling) lives in
 * src/services/photoService.js and calls into these helpers for validation.
 */

/** Photo albums = moments of the celebration story. */
export const PHOTO_ALBUMS = [
  { id: 'planning', label: 'Planning & Prep', icon: '📋' },
  { id: 'ceremony', label: 'Ceremony & Highlights', icon: '💍' },
  { id: 'reception', label: 'Party & Reception', icon: '🥂' },
  { id: 'candids', label: 'Candids & Fun', icon: '📸' },
];

export const DEFAULT_PHOTO_ALBUM = 'candids';

/** Hard cap: photos are stored as data URLs inside localStorage (~5MB shared). */
export const MAX_PHOTOS_PER_EVENT = 30;

/** A single downscaled ~720px JPEG lands around 60–180KB; SVG seeds ~2–4KB. */
export const MAX_PHOTO_DATAURL_CHARS = 400_000;

/** Rough localStorage quota (most browsers grant 5MB per origin). */
export const PHOTO_STORAGE_QUOTA_BYTES = 5_000_000;

const MIME_ALLOWLIST = new Set(['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg+xml']);

/** Substrings that must never appear inside an inline SVG data URL. */
const SVG_DENYLIST = [
  '<script',
  'javascript:',
  'onload=',
  'onerror=',
  'onclick=',
  '<foreignobject',
];

/**
 * Validate a photo data URL for safe persistence and <img> rendering.
 * Returns the cleaned data URL, or null when it should be rejected:
 *  - must be a string starting with `data:image/`
 *  - mime must be in the allowlist (jpeg/png/gif/webp/svg+xml)
 *  - SVG payloads are scanned for script/event-handler injection
 *  - length is hard-capped so one photo can never blow the quota
 */
export function validatePhotoDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;

  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 12) return null; // "data:image/x" + content is impossible this short

  const mime = dataUrl.slice(11, commaIdx).split(';')[0].toLowerCase();
  if (!MIME_ALLOWLIST.has(mime)) return null;

  if (dataUrl.length > MAX_PHOTO_DATAURL_CHARS) return null;

  if (mime === 'svg+xml') {
    // Scan BOTH the raw and the percent-decoded forms: browsers decode %xx
    // when parsing the data URL, so an encoded "onload%3D" executes as
    // "onload=" — scanning only the raw string would miss it.
    const bodies = [dataUrl.toLowerCase()];
    try {
      bodies.push(decodeURIComponent(dataUrl).toLowerCase());
    } catch {
      // Malformed percent-encoding — the raw form is still scanned.
    }
    for (const body of bodies) {
      for (const bad of SVG_DENYLIST) {
        if (body.includes(bad)) return null;
      }
    }
  }

  return dataUrl;
}

/**
 * Build photo metadata from a validated data URL.
 * The id is minted by the caller (context) so bulk adds stay collision-proof.
 */
export function makePhotoMeta(dataUrl, { caption = '', album = DEFAULT_PHOTO_ALBUM, favorite = false, createdAt = new Date().toISOString() } = {}) {
  return {
    dataUrl,
    caption: String(caption || '').slice(0, 200),
    album: PHOTO_ALBUMS.some((a) => a.id === album) ? album : DEFAULT_PHOTO_ALBUM,
    favorite: Boolean(favorite),
    createdAt,
  };
}

/**
 * Estimate how much of the localStorage budget photos currently occupy.
 * Accepts the full events array (or one event) so the UI meter can show
 * both the global pressure and a per-event cap indicator.
 */
export function photoStorageEstimate(events) {
  const list = Array.isArray(events) ? events : [events];
  let usedBytes = 0;
  const perEvent = {};

  for (const ev of list || []) {
    if (!ev || typeof ev !== 'object') continue;
    let eventBytes = 0;
    for (const ph of Array.isArray(ev.photos) ? ev.photos : []) {
      const len = typeof ph?.dataUrl === 'string' ? ph.dataUrl.length : 0;
      // base64 inflates by ~4/3 vs the raw bytes it encodes.
      eventBytes += Math.round((len * 3) / 4);
    }
    perEvent[ev.id] = eventBytes;
    usedBytes += eventBytes;
  }

  return {
    usedBytes,
    quotaBytes: PHOTO_STORAGE_QUOTA_BYTES,
    pct: Math.min(100, Math.round((usedBytes / PHOTO_STORAGE_QUOTA_BYTES) * 100)),
    perEvent,
  };
}

/* ------------------------------------------------------------------ */
/* Deterministic SVG "inspiration card" seeds                          */
/* ------------------------------------------------------------------ */

/**
 * Render a decorative SVG inspiration card as a data URL (pure string math —
 * safe in bun tests). Used to pre-populate the sample events' memory walls
 * with palette-matched art so the gallery never looks empty on first run.
 *
 * @param {{ colors?: string[], motif?: string, label?: string, seed?: number }} opts
 *   colors: 2–4 hex colors (falls back to a warm default palette)
 *   motif:  emoji/character printed large on the card
 *   label:  small caption printed at the bottom of the card
 *   seed:   0–3 variant controlling the decorative layout
 */
export function samplePhotoDataUrl({ colors, motif = '✨', label = '', seed = 0 } = {}) {
  const palette = (Array.isArray(colors) && colors.length >= 2 ? colors : ['#8b5cf6', '#ec4899'])
    .slice(0, 4)
    .map((c) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#8b5cf6'));
  const [c1, c2, c3 = c1, c4 = c2] = palette;

  const deco = seed % 4;
  const dots = Array.from({ length: 7 })
    .map((_, i) => {
      const cx = 80 + ((i * 103 + deco * 57) % 560);
      const cy = 60 + ((i * 71 + deco * 31) % 360);
      const r = 6 + ((i * 13 + deco) % 10);
      const fill = [c3, c4][i % 2];
      const op = 0.12 + ((i * 7) % 10) / 40;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${op.toFixed(2)}"/>`;
    })
    .join('');

  const bandX = deco === 1 ? 540 : deco === 3 ? 40 : 80;
  const band = `<rect x="${bandX}" y="${deco === 2 ? 300 : 120}" width="140" height="140" rx="28" fill="${c3}" opacity="0.16"/>`;

  const safeMotif = String(motif || '✨').replace(/[<>&"']/g, '');
  const safeLabel = String(label || '')
    .replace(/[<>&"']/g, '')
    .slice(0, 48);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>` +
    `</linearGradient></defs>` +
    `<rect width="720" height="480" fill="url(#g)"/>` +
    dots +
    band +
    `<text x="360" y="250" font-size="120" text-anchor="middle">${safeMotif}</text>` +
    (safeLabel
      ? `<rect x="170" y="400" width="380" height="40" rx="20" fill="#ffffff" opacity="0.25"/>` +
        `<text x="360" y="427" font-size="20" fill="#ffffff" text-anchor="middle" font-family="sans-serif">${safeLabel}</text>`
      : '') +
    `<rect x="8" y="8" width="704" height="464" rx="24" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="3"/>` +
    `</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Sample photo sets for the three seeded events — metadata fully formed so
 * INITIAL_EVENTS ships with a living, beautiful memory wall out of the box.
 * Deterministic per event type; ids are stable like the rest of the sample data.
 */
export function samplePhotosFor(eventId, themeColors) {
  const colors = Array.isArray(themeColors) && themeColors.length >= 2 ? themeColors : ['#8b5cf6', '#ec4899'];

  const sets = {
    'event-wedding-01': [
      { motif: '💍', label: 'Save the date', album: 'planning', caption: 'Invitation suite mockup — deckle paper & wax seals' },
      { motif: '🍇', label: 'The vineyard', album: 'ceremony', caption: 'Ceremony terrace at golden hour' },
      { motif: '🥂', label: 'First toast', album: 'reception', caption: 'Long tables under the festoon canopy' },
    ],
    'event-bday-02': [
      { motif: '🕹️', label: 'Arcade night', album: 'planning', caption: 'Retro cabinet placement sketch for the rooftop' },
      { motif: '🎂', label: 'Level 30', album: 'ceremony', caption: 'The neon sign moment — candles lit' },
      { motif: '🌃', label: 'Rooftop glow', album: 'candids', caption: 'City lights + synth beats till late' },
    ],
    'event-comm-03': [
      { motif: '🌱', label: 'Seed paper', album: 'planning', caption: 'Biodegradable badges ready for volunteers' },
      { motif: '🎪', label: 'Meadow setup', album: 'ceremony', caption: '20 pop-up tents going up on the main meadow' },
      { motif: '🤹', label: 'Family fun', album: 'candids', caption: 'Kids eco-workshop — painting plant pots' },
    ],
  };

  const set = sets[eventId] || sets['event-wedding-01'];
  return set.map((s, i) => ({
    id: `ph-${eventId}-${i + 1}`,
    ...makePhotoMeta(samplePhotoDataUrl({ colors, motif: s.motif, label: s.label, seed: i }), {
      caption: s.caption,
      album: s.album,
      favorite: i === 0,
    }),
  }));
}
