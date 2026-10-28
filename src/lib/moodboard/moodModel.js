/**
 * Mood board model — pure, unit-testable.
 *
 * A mood board is an ordered grid of inspiration tiles:
 *   - color  : a hex swatch (validated #rrggbb — invalid hex is dropped)
 *   - image  : a remote http(s) picture URL (never data:, never javascript:)
 *   - note   : a short text/keyword tile (fonts, flowers, "fairy lights"…)
 *
 * Tiles are cheap, tiny strings so the whole board persists inside the event
 * without touching the photo-wall storage budget.
 */

export const TILE_TYPES = [
  { id: 'color', label: 'Color swatch', icon: '🎨', hint: 'Hex color like #C46851' },
  { id: 'image', label: 'Image link', icon: '🖼️', hint: 'http(s) image URL' },
  { id: 'note', label: 'Idea note', icon: '💡', hint: 'Fonts, flowers, vibe words…' },
];

const TILE_TYPE_IDS = new Set(TILE_TYPES.map((t) => t.id));

/** Board size guard — keeps a runaway import from bloating storage. */
export const MAX_TILES = 24;

const cleanText = (v, max) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Strict hex check — mood tiles must render with a real color. */
export function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

/** Only http(s) image URLs pass — blocks javascript:, data:, etc. */
export function normalizeImageUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim().slice(0, 1000);
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch (_err) {
    return '';
  }
}

/**
 * Coerce a raw tile into a safe shape; returns null when unusable
 * (bad type, empty value, invalid hex/URL).
 */
export function normalizeTile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = TILE_TYPE_IDS.has(raw.type) ? raw.type : null;
  if (!type) return null;
  const caption = cleanText(raw.caption, 120);
  let value = '';

  if (type === 'color') {
    const hex = String(raw.value || '').trim();
    if (!isHexColor(hex)) return null;
    value = hex.toLowerCase();
  } else if (type === 'image') {
    value = normalizeImageUrl(raw.value);
    if (!value) return null;
  } else {
    value = cleanText(raw.value, 200);
    if (!value) return null;
  }

  return {
    id: cleanText(raw.id, 100) || raw.id || undefined,
    type,
    value,
    caption,
  };
}

/** Append a tile (mutates nothing); enforces MAX_TILES. Returns same array when full/invalid. */
export function addTile(tiles, raw) {
  const tile = normalizeTile(raw);
  const list = Array.isArray(tiles) ? tiles : [];
  if (!tile || list.length >= MAX_TILES) return list;
  return [...list, tile];
}

/** Remove by id (no-op when absent). */
export function removeTile(tiles, tileId) {
  if (!Array.isArray(tiles)) return [];
  return tiles.filter((t) => t?.id !== tileId);
}

/**
 * Move a tile one slot left (-1) or right (+1). Clamps at the edges, so
 * hammering the button can never wrap tiles around.
 */
export function moveTile(tiles, tileId, direction) {
  if (!Array.isArray(tiles)) return [];
  const dir = direction === 'left' ? -1 : 1;
  const index = tiles.findIndex((t) => t?.id === tileId);
  if (index < 0) return tiles;
  const target = index + dir;
  if (target < 0 || target >= tiles.length) return tiles;
  const next = [...tiles];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * Seed color tiles from a curated theme palette (or any hex list).
 * Caption takes the palette's color names when provided.
 */
export function tilesFromPalette(colors, names = [], { max = 6 } = {}) {
  const list = Array.isArray(colors) ? colors.slice(0, max) : [];
  return list
    .map((hex, i) => ({
      type: 'color',
      value: String(hex || '').trim().toLowerCase(),
      caption: typeof names[i] === 'string' ? cleanText(names[i], 120) : '',
    }))
    .filter((t) => isHexColor(t.value))
    .map(normalizeTile)
    .filter(Boolean);
}

/**
 * Build starter tiles for an event from its applied theme: matched curated
 * theme palette, or the event accent color, or the party-type default.
 * Returns [] when the event has no usable theme signal.
 */
export function tilesFromEventTheme(event, curatedThemes = []) {
  if (!event) return [];
  const byName = (Array.isArray(curatedThemes) ? curatedThemes : []).find(
    (t) => t && typeof t.name === 'string' && t.name === event.themeName
  );
  if (byName) {
    const colors = tilesFromPalette(byName.palette, byName.paletteNames);
    if (colors.length > 0) return colors;
  }
  if (isHexColor(event.themeColor || '')) {
    return tilesFromPalette([event.themeColor], [event.themeName || 'Accent color']);
  }
  return [];
}

/** Tiny stats helper for the board header. */
export function moodStats(tiles) {
  const list = Array.isArray(tiles) ? tiles : [];
  const byType = { color: 0, image: 0, note: 0 };
  for (const tile of list) {
    if (tile && TILE_TYPE_IDS.has(tile.type)) byType[tile.type] += 1;
  }
  return { total: list.length, ...byType };
}
