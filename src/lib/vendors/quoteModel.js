/**
 * Vendor quote comparison model — pure, unit-testable.
 *
 * Each vendor can hold multiple quotes (their own + competitors in the same
 * category). The comparison builder groups quotes per CATEGORY across all
 * vendors so hosts can see the spread at a glance: best value, highest rated,
 * and what accepting each quote would save versus the most expensive option.
 */

const cleanText = (v, max) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Max quotes kept per vendor — protects storage from hostile imports. */
export const MAX_QUOTES_PER_VENDOR = 12;

/**
 * Coerce a raw quote into a safe shape. Amount is required (> 0 is not
 * enforced — a $0 quote can be real, e.g. venue included by a package).
 * Returns null when the amount is missing/not a number.
 */
export function normalizeQuote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return {
    id: cleanText(raw.id, 100) || raw.id || undefined,
    company: cleanText(raw.company, 160),
    amount: Math.round(amount),
    date: /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : '',
    inclusions: cleanText(raw.inclusions, 600),
    notes: cleanText(raw.notes, 400),
    source: cleanText(raw.source, 40),
  };
}

/** Per-vendor quote stats. */
export function quoteStats(quotes) {
  const list = Array.isArray(quotes) ? quotes.filter(Boolean) : [];
  if (list.length === 0) return { count: 0, lowest: null, highest: null, average: null, spread: 0 };
  const amounts = list.map((q) => Number(q.amount) || 0);
  const lowest = Math.min(...amounts);
  const highest = Math.max(...amounts);
  const average = Math.round(amounts.reduce((a, b) => a + b, 0) / list.length);
  return {
    count: list.length,
    lowest,
    highest,
    average,
    spread: highest - lowest,
  };
}

/**
 * Build a per-category comparison across vendors.
 *
 * Returns an array of category blocks (only categories that have at least
 * one quote), each with quote rows annotated with:
 *   - isLowest: cheapest amount in the category (ties allowed)
 *   - isTopRated: quote belongs to the highest-rated vendor in the category
 *   - savingsVsTop: how much cheaper than the most expensive quote
 */
export function buildCategoryComparison(vendors, { categoryFilter = null } = {}) {
  const list = Array.isArray(vendors) ? vendors : [];
  const blocks = [];

  const categories = new Map();
  for (const vendor of list) {
    if (!vendor || !Array.isArray(vendor.quotes) || vendor.quotes.length === 0) continue;
    const cat = String(vendor.category || 'other');
    if (categoryFilter && cat !== categoryFilter) continue;
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat).push(vendor);
  }

  for (const [category, catVendors] of categories) {
    const rows = [];
    for (const vendor of catVendors) {
      for (const quote of vendor.quotes) {
        const normalized = normalizeQuote(quote);
        if (!normalized) continue;
        rows.push({
          quoteId: normalized.id || quote.id,
          vendorId: vendor.id,
          vendorName: vendor.name || 'Unnamed vendor',
          vendorRating: Number.isFinite(Number(vendor.rating)) ? Number(vendor.rating) : 0,
          vendorStatus: vendor.status || 'researching',
          company: normalized.company || vendor.name || 'Unnamed vendor',
          amount: normalized.amount,
          date: normalized.date,
          inclusions: normalized.inclusions,
          notes: normalized.notes,
        });
      }
    }
    if (rows.length === 0) continue;
    rows.sort((a, b) => a.amount - b.amount || a.vendorName.localeCompare(b.vendorName));

    const amounts = rows.map((r) => r.amount);
    const lowest = Math.min(...amounts);
    const highest = Math.max(...amounts);
    const topRating = Math.max(...rows.map((r) => r.vendorRating));

    for (const row of rows) {
      row.isLowest = row.amount === lowest;
      row.isTopRated = row.vendorRating === topRating;
      row.savingsVsTop = highest - row.amount;
    }

    blocks.push({
      category,
      rows,
      stats: {
        count: rows.length,
        lowest,
        highest,
        spread: highest - lowest,
        average: Math.round(amounts.reduce((a, b) => a + b, 0) / rows.length),
      },
    });
  }

  return blocks;
}

/**
 * Accept-a-quote mapping: which vendor fields change when the host accepts.
 * Cost syncs to the quote amount and the vendor flips to booked.
 */
export function acceptQuoteFields(vendor, quote) {
  const normalized = normalizeQuote(quote);
  if (!vendor || !normalized) return null;
  const stamp = new Date().toISOString().slice(0, 10);
  const priorNote = cleanText(vendor.notes, 400);
  const acceptedFrom = normalized.company || vendor.name || 'quote';
  const noteLine = `Accepted quote from ${acceptedFrom} ($${normalized.amount.toLocaleString('en-US')}) on ${stamp}.`;
  return {
    cost: normalized.amount,
    status: 'booked',
    notes: priorNote ? `${noteLine} ${priorNote}` : noteLine,
  };
}
