import { describe, expect, test } from 'bun:test';
import {
  MAX_QUOTES_PER_VENDOR,
  normalizeQuote,
  quoteStats,
  buildCategoryComparison,
  acceptQuoteFields,
} from '../../src/lib/vendors/quoteModel';

const vendors = [
  {
    id: 'v-1',
    name: 'Artisan Vineyard Table',
    category: 'catering',
    rating: 5,
    status: 'booked',
    cost: 7800,
    quotes: [
      { id: 'q-1', company: 'Artisan Vineyard Table', amount: 7800, date: '2026-08-28', inclusions: 'Plated dinner for 120', notes: 'Tasting done.', source: 'sample' },
      { id: 'q-2', company: 'Golden Harvest', amount: 8600, date: '2026-08-30', inclusions: 'Family style for 120', notes: '', source: 'sample' },
    ],
  },
  {
    id: 'v-2',
    name: 'Farmhouse Feasts',
    category: 'catering',
    rating: 4,
    status: 'researching',
    cost: 0,
    quotes: [
      { id: 'q-3', company: 'Farmhouse Feasts', amount: 6900, date: '2026-08-25', inclusions: 'Buffet for 120', notes: '', source: 'sample' },
    ],
  },
  {
    id: 'v-3',
    name: 'Lumiere Studios',
    category: 'photography',
    rating: 5,
    status: 'deposit_paid',
    cost: 4200,
    quotes: [
      { id: 'q-4', company: 'Lumiere Studios', amount: 4200, date: '2026-08-18', inclusions: '9h coverage, drone', notes: '', source: 'sample' },
    ],
  },
];

describe('normalizeQuote', () => {
  test('builds a safe quote from raw input', () => {
    const q = normalizeQuote({ company: ' Test Co ', amount: '1234.6', date: '2026-01-05', inclusions: '  a  b ', notes: 'n' });
    expect(q!.company).toBe('Test Co');
    expect(q!.amount).toBe(1235); // rounded
    expect(q!.date).toBe('2026-01-05');
    expect(q!.inclusions).toBe('a b');
  });

  test('amount is mandatory — missing / negative / NaN amounts are rejected', () => {
    expect(normalizeQuote(null)).toBeNull();
    expect(normalizeQuote({ company: 'X' })).toBeNull();
    expect(normalizeQuote({ amount: 'abc' })).toBeNull();
    expect(normalizeQuote({ amount: -5 })).toBeNull();
  });

  test('a $0 quote is valid (packages can include things for free)', () => {
    expect(normalizeQuote({ amount: 0 })!.amount).toBe(0);
  });

  test('bad dates fall back to empty, unknown sources pass through capped', () => {
    const q = normalizeQuote({ amount: 10, date: '05/01/2026', source: 'x'.repeat(80) });
    expect(q!.date).toBe('');
    expect(q!.source).toHaveLength(40);
  });
});

describe('quoteStats', () => {
  test('computes lowest, highest, average and spread', () => {
    const stats = quoteStats([{ amount: 100 }, { amount: 300 }, { amount: 200 }]);
    expect(stats).toEqual({ count: 3, lowest: 100, highest: 300, average: 200, spread: 200 });
  });

  test('empty input yields inert stats', () => {
    expect(quoteStats([])).toEqual({ count: 0, lowest: null, highest: null, average: null, spread: 0 });
    expect(quoteStats(null as never).count).toBe(0);
  });
});

describe('buildCategoryComparison', () => {
  test('groups quotes per category and annotates best value / top rated / savings', () => {
    const blocks = buildCategoryComparison(vendors);
    expect(blocks).toHaveLength(2); // catering + photography

    const catering = blocks.find((b) => b.category === 'catering')!;
    expect(catering.rows).toHaveLength(3);
    // Sorted cheapest-first.
    expect(catering.rows.map((r) => r.amount)).toEqual([6900, 7800, 8600]);
    // Best value = 6900; savings computed against the priciest (8600).
    const best = catering.rows[0];
    expect(best.isLowest).toBe(true);
    expect(best.company).toBe('Farmhouse Feasts');
    expect(best.savingsVsTop).toBe(1700);
    expect(catering.rows[2].savingsVsTop).toBe(0);
    // Top-rated flag follows vendor rating (both 5-star vendors flagged).
    expect(catering.rows.filter((r) => r.isTopRated).map((r) => r.vendorName).sort()).toEqual([
      'Artisan Vineyard Table',
      'Artisan Vineyard Table',
    ]);
  });

  test('categoryFilter scopes the comparison to one category', () => {
    const blocks = buildCategoryComparison(vendors, { categoryFilter: 'photography' });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].category).toBe('photography');
    expect(blocks[0].rows[0].company).toBe('Lumiere Studios');
  });

  test('vendors without quotes are skipped; malformed quotes are dropped, not fatal', () => {
    const noisy = [
      { id: 'a', name: 'A', category: 'venue', rating: 5, quotes: [{ amount: 500 }, { amount: 'bad' }] },
      { id: 'b', name: 'B', category: 'venue', rating: 3, quotes: [] },
    ];
    const blocks = buildCategoryComparison(noisy);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].rows).toHaveLength(1);
    expect(buildCategoryComparison(null as never)).toEqual([]);
  });

  test('per-vendor quote caps stay constant for storage guards', () => {
    expect(MAX_QUOTES_PER_VENDOR).toBeGreaterThanOrEqual(5);
  });
});

describe('acceptQuoteFields', () => {
  test('accepting syncs cost, books the vendor and prepends an audit note', () => {
    const fields = acceptQuoteFields(
      { id: 'v-2', name: 'Farmhouse Feasts', rating: 4, notes: 'Buffet specialist.' },
      { company: 'Farmhouse Feasts', amount: 6900 }
    )!;
    expect(fields.cost).toBe(6900);
    expect(fields.status).toBe('booked');
    expect(fields.notes).toMatch(/^Accepted quote from Farmhouse Feasts \(\$6,900\) on \d{4}-\d{2}-\d{2}\. Buffet specialist\.?$/);
  });

  test('returns null on unusable input', () => {
    expect(acceptQuoteFields(null, { amount: 5 })).toBeNull();
    expect(acceptQuoteFields({ id: 'x', name: 'X' }, { amount: 'nope' })).toBeNull();
  });
});
