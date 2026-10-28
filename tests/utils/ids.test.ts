import { describe, expect, test } from 'bun:test';
import { makeId, dedupeById, sanitizeEvent, sanitizeEvents } from '../../src/utils/ids';

describe('makeId — collision-proof id minting', () => {
  test('1000 rapid calls all produce unique ids', () => {
    const ids = Array.from({ length: 1000 }, () => makeId('task'));
    expect(new Set(ids).size).toBe(1000);
    expect(ids.every((id) => id.startsWith('task-'))).toBe(true);
  });

  test('stays unique even when the clock is frozen (same millisecond)', () => {
    const originalNow = Date.now;
    try {
      Date.now = () => 1793034912847; // freeze — worst case: an entire bulk add in one ms
      const ids = Array.from({ length: 500 }, () => makeId('task'));
      expect(new Set(ids).size).toBe(500);
      expect(ids[0]).toBe('task-1793034912847-0');
      expect(ids[1]).toBe('task-1793034912847-1');
      expect(ids[499]).toBe('task-1793034912847-499');
    } finally {
      Date.now = originalNow;
    }
  });

  test('counter resets when the clock advances', () => {
    const originalNow = Date.now;
    try {
      let t = 1700000000000;
      Date.now = () => t;
      const a = makeId('v'); // 1700000000000-0
      const b = makeId('v'); // 1700000000000-1
      t += 5;
      const c = makeId('v'); // new stamp — counter back to 0
      expect(a).toBe('v-1700000000000-0');
      expect(b).toBe('v-1700000000000-1');
      expect(c).toBe('v-1700000000005-0');
    } finally {
      Date.now = originalNow;
    }
  });
});

describe('dedupeById — corrupted list repair', () => {
  test('keeps the first occurrence and drops later duplicates, preserving order', () => {
    const list = [
      { id: 'a', title: 'First A' },
      { id: 'b', title: 'B' },
      { id: 'a', title: 'Second A (duplicate)' },
      { id: 'c', title: 'C' },
      { id: 'b', title: 'Second B (duplicate)' },
    ];
    const out = dedupeById(list);
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(out[0].title).toBe('First A'); // first, not the later copy
  });

  test('assigns fresh unique ids to items that lost theirs (kept, not dropped)', () => {
    const list = [{ title: 'No id 1' }, { id: 'x', title: 'Has id' }, { title: 'No id 2' }];
    const out = dedupeById(list);
    expect(out.length).toBe(3);
    expect(out[1].id).toBe('x');
    expect(out[0].id).toBeTruthy();
    expect(out[2].id).toBeTruthy();
    expect(out[0].id).not.toBe(out[2].id);
    expect(new Set(out.map((i) => i.id)).size).toBe(3);
  });

  test('non-array input returns [] and non-objects are dropped', () => {
    expect(dedupeById(undefined)).toEqual([]);
    expect(dedupeById(null)).toEqual([]);
    expect(dedupeById([null, 'str', { id: 'ok' }])).toEqual([{ id: 'ok' }]);
  });

  test('does not mutate the input list', () => {
    const list = [{ id: 'a' }, { id: 'a' }];
    const snapshot = JSON.stringify(list);
    dedupeById(list);
    expect(JSON.stringify(list)).toBe(snapshot);
  });
});

describe('sanitizeEvent / sanitizeEvents — healing the reported bug data', () => {
  test('collapses duplicated task ids (regression: task-1793034912847 rendered twice)', () => {
    const corrupted = {
      id: 'event-1',
      title: 'Wedding',
      tasks: [
        { id: 'task-1793034912847', title: 'Book the venue', completed: false },
        { id: 'task-1793034912847', title: 'Book the venue', completed: false },
        { id: 'task-1793034912848', title: 'Order invitations', completed: false },
      ],
      vendors: [{ id: 'v-1', name: 'DJ' }],
      expenses: [{ id: 'exp-1', label: 'Cake' }],
    };
    const healed = sanitizeEvent(corrupted);
    expect(healed.tasks.length).toBe(2);
    expect(new Set(healed.tasks.map((t) => t.id)).size).toBe(2);
    expect(healed.tasks.some((t) => t.title === 'Order invitations')).toBe(true);
    // untouched collections pass through unchanged
    expect(healed.vendors).toEqual([{ id: 'v-1', name: 'DJ' }]);
  });

  test('also repairs duplicate ids in vendors and expenses', () => {
    const corrupted = {
      id: 'event-2',
      tasks: [],
      vendors: [
        { id: 'v-1', name: 'DJ' },
        { id: 'v-1', name: 'DJ copy' },
      ],
      expenses: [
        { id: 'exp-1', label: 'Cake' },
        { id: 'exp-1', label: 'Cake copy' },
        { id: 'exp-2', label: 'Flowers' },
      ],
    };
    const healed = sanitizeEvent(corrupted);
    expect(healed.vendors.length).toBe(1);
    expect(healed.expenses.length).toBe(2);
  });

  test('clean events are returned as the SAME reference (no needless copies)', () => {
    const clean = {
      id: 'event-3',
      tasks: [{ id: 't-1' }, { id: 't-2' }],
      vendors: [{ id: 'v-1' }],
      expenses: [],
    };
    expect(sanitizeEvent(clean)).toBe(clean);
  });

  test('sanitizeEvents maps over a list and passes through non-arrays', () => {
    const a = { id: 'e1', tasks: [{ id: 'x' }, { id: 'x' }] };
    const b = { id: 'e2', tasks: [{ id: 'y' }] };
    const out = sanitizeEvents([a, b]);
    expect(out[0].tasks.length).toBe(1);
    expect(out[1].tasks.length).toBe(1);
    expect(sanitizeEvents(undefined)).toBeUndefined();
  });
});
