import { describe, expect, test } from 'bun:test';
import {
  TILE_TYPES,
  MAX_TILES,
  isHexColor,
  normalizeTile,
  normalizeImageUrl,
  addTile,
  removeTile,
  moveTile,
  tilesFromPalette,
  tilesFromEventTheme,
  moodStats,
} from '../../src/lib/moodboard/moodModel';

const CURATED = [
  {
    id: 'rustic-tuscan',
    eventType: 'wedding',
    name: 'Rustic Tuscan Romance',
    palette: ['#C46851', '#7A8B7B', '#E8D5B5'],
    paletteNames: ['Terracotta', 'Olive Leaf', 'Warm Sand'],
  },
];

describe('isHexColor / normalizeImageUrl', () => {
  test('only strict 6-digit hex colors pass', () => {
    expect(isHexColor('#C46851')).toBe(true);
    expect(isHexColor('#c46851')).toBe(true);
    expect(isHexColor('C46851')).toBe(false);
    expect(isHexColor('#FFF')).toBe(false);
    expect(isHexColor('#GGGGGG')).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });

  test('image URLs must be http(s) — dangerous schemes are dropped', () => {
    expect(normalizeImageUrl('https://pics.example.com/a.jpg')).toBe('https://pics.example.com/a.jpg');
    expect(normalizeImageUrl('http://pics.example.com/a.jpg')).toBe('http://pics.example.com/a.jpg');
    expect(normalizeImageUrl('javascript:alert(1)')).toBe('');
    expect(normalizeImageUrl('data:image/svg+xml;base64,evil')).toBe('');
    expect(normalizeImageUrl('ftp://x/y.png')).toBe('');
    expect(normalizeImageUrl('')).toBe('');
  });
});

describe('normalizeTile', () => {
  test('color tiles normalize hex to lowercase', () => {
    const tile = normalizeTile({ type: 'color', value: ' #C46851 ', caption: ' Terracotta ' });
    expect(tile).toEqual({ id: undefined, type: 'color', value: '#c46851', caption: 'Terracotta' });
  });

  test('invalid hex, non-http images and empty notes are rejected', () => {
    expect(normalizeTile({ type: 'color', value: '#12345' })).toBeNull();
    expect(normalizeTile({ type: 'image', value: 'javascript:x' })).toBeNull();
    expect(normalizeTile({ type: 'note', value: '   ' })).toBeNull();
    expect(normalizeTile({ type: 'hologram', value: 'x' })).toBeNull();
    expect(normalizeTile(null)).toBeNull();
  });

  test('notes are capped at 200 chars, captions at 120', () => {
    const tile = normalizeTile({ type: 'note', value: 'n'.repeat(300), caption: 'c'.repeat(200) });
    expect(tile!.value).toHaveLength(200);
    expect(tile!.caption).toHaveLength(120);
  });
});

describe('addTile / removeTile / moveTile', () => {
  const c1 = { id: 't1', type: 'color', value: '#111111', caption: '' };
  const c2 = { id: 't2', type: 'color', value: '#222222', caption: '' };
  const c3 = { id: 't3', type: 'color', value: '#333333', caption: '' };

  test('addTile appends validated tiles immutably', () => {
    const board = addTile([c1], { type: 'color', value: '#222222' });
    expect(board).toHaveLength(2);
    expect(board[0]).toBe(c1); // original untouched
  });

  test('addTile rejects junk and respects MAX_TILES', () => {
    const list = [c1];
    expect(addTile(list, { type: 'color', value: 'nope' })).toBe(list);
    const full = Array.from({ length: MAX_TILES }, (_, i) => ({
      id: `t${i}`,
      type: 'note' as const,
      value: `note ${i}`,
      caption: '',
    }));
    expect(addTile(full, { type: 'note', value: 'overflow' })).toBe(full);
    expect(addTile(null as never, { type: 'note', value: 'x' })).toHaveLength(1);
  });

  test('removeTile only drops the targeted id', () => {
    expect(removeTile([c1, c2, c3], 't2')).toEqual([c1, c3]);
    expect(removeTile([c1], 'missing')).toEqual([c1]);
    expect(removeTile(null as never, 'x')).toEqual([]);
  });

  test('moveTile shifts one slot and clamps at the edges (no wrap-around)', () => {
    expect(moveTile([c1, c2, c3], 't2', 'left').map((t) => t.id)).toEqual(['t2', 't1', 't3']);
    expect(moveTile([c1, c2, c3], 't2', 'right').map((t) => t.id)).toEqual(['t1', 't3', 't2']);
    expect(moveTile([c1, c2, c3], 't1', 'left').map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(moveTile([c1, c2, c3], 't3', 'right').map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(moveTile([c1, c2], 'missing', 'left').map((t) => t.id)).toEqual(['t1', 't2']);
  });
});

describe('theme seeding', () => {
  test('tilesFromPalette pairs colors with names and drops invalid hex', () => {
    const tiles = tilesFromPalette(['#C46851', '#7A8B7B', 'nope', 'C46851'], ['Terracotta', 'Olive Leaf', 'X', 'Y']);
    expect(tiles).toEqual([
      { id: undefined, type: 'color', value: '#c46851', caption: 'Terracotta' },
      { id: undefined, type: 'color', value: '#7a8b7b', caption: 'Olive Leaf' },
    ]);
  });

  test('tilesFromEventTheme prefers the matched curated theme', () => {
    const tiles = tilesFromEventTheme({ themeName: 'Rustic Tuscan Romance' }, CURATED);
    expect(tiles).toHaveLength(3);
    expect(tiles[0]).toEqual({ id: undefined, type: 'color', value: '#c46851', caption: 'Terracotta' });
  });

  test('falls back to the event accent color, then to nothing', () => {
    const accent = tilesFromEventTheme({ themeColor: '#8b5cf6', themeName: 'Custom' }, CURATED);
    expect(accent).toHaveLength(1);
    expect(accent[0].value).toBe('#8b5cf6');
    expect(tilesFromEventTheme({}, CURATED)).toEqual([]);
    expect(tilesFromEventTheme(null as never, CURATED)).toEqual([]);
  });
});

describe('moodStats', () => {
  test('counts tiles by type and totals', () => {
    const stats = moodStats([
      { id: '1', type: 'color', value: '#111111', caption: '' },
      { id: '2', type: 'color', value: '#222222', caption: '' },
      { id: '3', type: 'note', value: 'a', caption: '' },
      { id: '4', type: 'image', value: 'https://x/y.jpg', caption: '' },
      null as never,
    ]);
    expect(stats).toEqual({ total: 5, color: 2, image: 1, note: 1 });
    expect(moodStats([]).total).toBe(0);
  });
});

describe('module constants', () => {
  test('tile types cover the three board tile kinds', () => {
    expect(TILE_TYPES.map((t) => t.id)).toEqual(['color', 'image', 'note']);
    expect(MAX_TILES).toBe(24);
  });
});
