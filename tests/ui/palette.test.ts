import { describe, expect, test } from 'bun:test';
import {
  PALETTE_NAV_ITEMS,
  GROUP_RESULT_CAP,
  buildActionItems,
  buildEventItems,
  buildDataItems,
  filterPaletteItems,
  groupPaletteItems,
} from '../../src/lib/palette/paletteItems';

/* A compact but realistic active event for the data builders. */
const sampleEvent = {
  id: 'ev-1',
  title: 'Sophia & Liam Vineyard Wedding',
  type: 'wedding',
  date: '2026-11-16',
  budget: 28000,
  guests: [
    { id: 'g-1', name: 'Eleanor Vance', email: 'eleanor@v.com', group: 'family', rsvp: 'attending', plusOnes: 1, meal: 'standard' },
    { id: 'g-2', name: 'Marco Rossi', email: 'marco@r.com', group: 'friends', rsvp: 'invited', plusOnes: 0, meal: 'vegetarian' },
    { id: 'g-3', name: "Liam's Work Team — Studio Delta", email: 'team@s.com', group: 'colleagues', rsvp: 'maybe', plusOnes: 0, meal: 'standard' },
  ],
  vendors: [
    { id: 'v-1', name: 'Napa Valley Vista Winery', category: 'venue', status: 'booked', cost: 9500, contactPerson: 'Clara Beaumont', email: 'events@napa.com' },
    { id: 'v-2', name: 'Lumiere Fine Art Studios', category: 'photography', status: 'deposit_paid', cost: 4200, contactPerson: 'Elena Rostova', email: 'hi@lumiere.com' },
  ],
  tasks: [
    { id: 't-1', title: 'Book the venue deposit', dueDate: '2026-09-01', priority: 'high', completed: false, category: 'venue' },
    { id: 't-2', title: 'Mail invitations', dueDate: '2026-10-01', priority: 'medium', completed: true, category: 'stationery' },
  ],
  expenses: [
    { id: 'e-1', name: 'Farm-to-Table Plated Dinner', category: 'catering', allocated: 8200, spent: 7800, paid: true },
    { id: 'e-2', name: 'Festoon lighting rental', category: 'venue', allocated: 900, spent: 0, paid: false },
  ],
};

const sampleEvents = [
  { id: 'ev-1', title: 'Sophia & Liam Vineyard Wedding', type: 'wedding', date: '2026-11-16', budget: 28000 },
  { id: 'ev-2', title: "Marcus's 30th Birthday Bash", type: 'birthday', date: '2026-08-02', budget: 3500 },
];

describe('PALETTE_NAV_ITEMS', () => {
  test('mirrors all 11 navbar tabs with unique ids and navigate actions', () => {
    expect(PALETTE_NAV_ITEMS.length).toBe(11);
    const ids = new Set(PALETTE_NAV_ITEMS.map((i) => i.id));
    expect(ids.size).toBe(11);
    const tabs = new Set(PALETTE_NAV_ITEMS.map((i) => i.action.tab));
    expect(tabs.size).toBe(11);
    for (const item of PALETTE_NAV_ITEMS) {
      expect(item.action.type).toBe('navigate');
      expect(item.group).toBe('Go to');
      expect(item.keywords.length).toBeGreaterThan(item.label.length);
    }
  });

  test('contains every primary tab id used by PlannerApp', () => {
    const expected = [
      'dashboard', 'force', 'budget', 'timeline', 'guests', 'dayof',
      'photos', 'venues', 'vendors', 'ai', 'print',
    ];
    const tabs = PALETTE_NAV_ITEMS.map((i) => i.action.tab);
    for (const tab of expected) expect(tabs).toContain(tab);
  });
});

describe('buildActionItems', () => {
  test('exposes the 8 quick actions with stable ids', () => {
    const items = buildActionItems({ resolvedTheme: 'light' });
    expect(items.map((i) => i.id)).toEqual([
      'act-new-event', 'act-add-expense', 'act-add-task', 'act-add-vendor',
      'act-toggle-theme', 'act-export-backup', 'act-ai-settings', 'act-print-master',
    ]);
    expect(items.every((i) => i.group === 'Actions')).toBe(true);
  });

  test('theme action label always describes the switch it will perform', () => {
    expect(buildActionItems({ resolvedTheme: 'light' })
      .find((i) => i.id === 'act-toggle-theme')?.label)
      .toBe('Switch to Dark Mode');
    expect(buildActionItems({ resolvedTheme: 'dark' })
      .find((i) => i.id === 'act-toggle-theme')?.label)
      .toBe('Switch to Light Mode');
    // Before hydration resolves we still promise a sensible default.
    expect(buildActionItems({})
      .find((i) => i.id === 'act-toggle-theme')?.label)
      .toBe('Switch to Dark Mode');
  });
});

describe('buildEventItems', () => {
  test('builds one switch action per event and flags the active one', () => {
    const items = buildEventItems(sampleEvents, { activeEventId: 'ev-1' });
    expect(items).toHaveLength(2);
    expect(items[0].action).toEqual({ type: 'selectEvent', eventId: 'ev-1' });
    expect(items[0].hint).toContain('active');
    expect(items[1].hint).not.toContain('active');
    expect(items[1].keywords).toContain('Birthday');
  });

  test('degrades gracefully on empty or missing input', () => {
    expect(buildEventItems(null)).toEqual([]);
    expect(buildEventItems(undefined, { activeEventId: 'x' })).toEqual([]);
  });
});

describe('buildDataItems', () => {
  test('maps guests, vendors, tasks and expenses into labeled groups', () => {
    const items = buildDataItems(sampleEvent);
    const groups = new Set(items.map((i) => i.group));
    expect([...groups].sort()).toEqual(['Expenses', 'Guests', 'Tasks', 'Vendors']);

    const guest = items.find((i) => i.id === 'guest:g-1');
    expect(guest.label).toBe('Eleanor Vance');
    expect(guest.hint).toContain('Yes');
    expect(guest.hint).toContain('+1');
    expect(guest.keywords).toContain('eleanor@v.com');

    const vendor = items.find((i) => i.id === 'vendor:v-1');
    expect(vendor.hint).toContain('Venue');
    expect(vendor.hint).toContain('Booked');
    expect(vendor.keywords).toContain('Clara Beaumont');

    const doneTask = items.find((i) => i.id === 'task:t-2');
    expect(doneTask.hint).toContain('Done');

    const expense = items.find((i) => i.id === 'expense:e-1');
    expect(expense.hint).toContain('$');
    expect(expense.action).toEqual({ type: 'navigate', tab: 'budget' });
  });

  test('returns [] for a missing event and skips absent collections', () => {
    expect(buildDataItems(null)).toEqual([]);
    expect(buildDataItems({ id: 'x', guests: [], tasks: [] })).toEqual([]);
  });
});

describe('filterPaletteItems', () => {
  const all = [
    ...PALETTE_NAV_ITEMS,
    ...buildActionItems({ resolvedTheme: 'light' }),
    ...buildEventItems(sampleEvents, { activeEventId: 'ev-1' }),
    ...buildDataItems(sampleEvent),
  ];

  test('empty query returns the full list untouched', () => {
    const out = filterPaletteItems(all, '');
    expect(out.length).toBe(all.length);
    expect(out).not.toBe(all); // defensive copy
  });

  test('matching is case-insensitive across labels and keywords', () => {
    const ids = filterPaletteItems(all, 'ELEANOR').map((i) => i.id);
    expect(ids).toContain('guest:g-1');
    // "invited" lives in the rsvp label keywords of Marco's guest row
    expect(filterPaletteItems(all, 'INVITED').map((i) => i.id)).toContain('guest:g-2');
  });

  test('ranking: prefix beats word-start beats substring', () => {
    const controlled = [
      { id: 'i-sub', group: 'T', label: 'Smart Fairy Lights', keywords: 'decor', action: { type: 'navigate', tab: 'budget' } },
      { id: 'i-word', group: 'T', label: 'San Marco Club', keywords: 'venue', action: { type: 'navigate', tab: 'budget' } },
      { id: 'i-prefix', group: 'T', label: 'Marco Rossi', keywords: 'guest', action: { type: 'navigate', tab: 'budget' } },
    ];
    // Deliberately ordered so a stable sort alone cannot save the test:
    // scoring must promote the prefix match to the top.
    expect(filterPaletteItems(controlled, 'mar').map((i) => i.id))
      .toEqual(['i-prefix', 'i-word', 'i-sub']);
  });

  test('regex-special characters in the query never throw', () => {
    expect(() => filterPaletteItems(all, 'a+b (c) [d] .e')).not.toThrow();
    expect(filterPaletteItems(all, 'a+b (c) [d] .e')).toEqual([]);
  });

  test('per-group cap keeps one noisy group from flooding the palette', () => {
    const manyGuests = Array.from({ length: 30 }, (_, i) => ({
      id: `guest:x-${i}`,
      group: 'Guests',
      label: `Test Guest ${i}`,
      keywords: 'guest test',
      action: { type: 'navigate', tab: 'guests' },
    }));
    const oneNav = [PALETTE_NAV_ITEMS.find((i) => i.action.tab === 'guests')];
    // "guest" matches all 30 fake guests AND the Guests & RSVPs tab —
    // the tab must survive while the flood is capped.
    const out = filterPaletteItems([...manyGuests, ...oneNav], 'guest');
    const guests = out.filter((i) => i.group === 'Guests');
    expect(guests.length).toBe(GROUP_RESULT_CAP);
    expect(out.find((i) => i.id === 'nav-guests')).toBeDefined();
  });

  test('no match yields an empty array', () => {
    expect(filterPaletteItems(all, 'zzzz-nothing')).toEqual([]);
  });
});

describe('groupPaletteItems', () => {
  test('preserves first-seen group order and buckets items', () => {
    const flat = [
      { id: 'a', group: 'Go to', label: 'A' },
      { id: 'b', group: 'Actions', label: 'B' },
      { id: 'c', group: 'Go to', label: 'C' },
    ];
    const grouped = groupPaletteItems(flat);
    expect(grouped.map((g) => g.group)).toEqual(['Go to', 'Actions']);
    expect(grouped[0].items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(groupPaletteItems([])).toEqual([]);
  });
});
