/**
 * Gift registry model — pure, unit-testable.
 *
 * A registry item ("gift") tracks what the hosts would love to receive, plus
 * who has claimed/purchased it. Claims are soft-linked to guests: we store
 * both the guest id and a name snapshot, so deleting a guest never breaks a
 * registry row (the name keeps rendering).
 */

export const GIFT_STATUSES = [
  { id: 'available', label: 'Available', short: 'Open', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '🎁' },
  { id: 'claimed', label: 'Claimed', short: 'Claimed', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: '🙋' },
  { id: 'purchased', label: 'Purchased', short: 'Bought', color: 'bg-brand-50 text-brand-700 border-brand-200', icon: '✅' },
];

export const GIFT_PRIORITIES = [
  { id: 'high', label: 'Dream gift', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'medium', label: 'Would love', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'low', label: 'Nice to have', color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

const STATUS_IDS = new Set(GIFT_STATUSES.map((s) => s.id));
const PRIORITY_IDS = new Set(GIFT_PRIORITIES.map((p) => p.id));

/** Only http(s) links survive — blocks javascript: and friends. */
export function normalizeGiftUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim().slice(0, 500);
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch (_err) {
    return '';
  }
}

const cleanText = (v, max) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/**
 * Coerce raw input into a safe gift shape. Name is required — returns null
 * when missing so callers can reject the submit instead of storing junk.
 */
export function normalizeGift(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanText(raw.name, 160);
  if (!name) return null;
  return {
    id: cleanText(raw.id, 100) || raw.id || undefined,
    name,
    store: cleanText(raw.store, 120),
    url: normalizeGiftUrl(raw.url),
    price: Number.isFinite(Number(raw.price)) && Number(raw.price) >= 0 ? Math.round(Number(raw.price)) : 0,
    priority: PRIORITY_IDS.has(raw.priority) ? raw.priority : 'medium',
    status: STATUS_IDS.has(raw.status) ? raw.status : 'available',
    claimedByName: cleanText(raw.claimedByName, 160),
    claimedByGuestId: cleanText(raw.claimedByGuestId, 100),
    notes: cleanText(raw.notes, 500),
  };
}

/** Claim a gift for a guest (id + name snapshot). Already-claimed stays as-is. */
export function claimGift(gift, { guestId, guestName }) {
  if (!gift || gift.status !== 'available') return gift;
  return {
    ...gift,
    status: 'claimed',
    claimedByGuestId: cleanText(guestId, 100),
    claimedByName: cleanText(guestName, 160),
  };
}

/** Release a claim back to available. */
export function releaseGift(gift) {
  if (!gift || gift.status !== 'purchased') {
    return { ...gift, status: 'available', claimedByGuestId: '', claimedByName: '' };
  }
  return gift;
}

/** Mark a claimed gift as purchased (keeps the claim for thank-you notes). */
export function markGiftPurchased(gift) {
  if (!gift || gift.status === 'purchased') return gift;
  return { ...gift, status: 'purchased' };
}

/** Registry-wide stats for KPI cards. */
export function giftStats(gifts) {
  const list = Array.isArray(gifts) ? gifts : [];
  const byStatus = { available: 0, claimed: 0, purchased: 0 };
  let totalValue = 0;
  let securedValue = 0;
  for (const g of list) {
    const status = STATUS_IDS.has(g?.status) ? g.status : 'available';
    byStatus[status] += 1;
    const price = Number.isFinite(Number(g?.price)) ? Number(g.price) : 0;
    totalValue += price;
    if (status !== 'available') securedValue += price;
  }
  return {
    total: list.length,
    ...byStatus,
    totalValue,
    securedValue,
    securedPercent: totalValue > 0 ? Math.round((securedValue / totalValue) * 100) : 0,
  };
}

/** Case-insensitive filter over name / store / notes / claimed-by. */
export function matchesGift(gift, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  if (!gift) return false;
  const hay = [gift.name, gift.store, gift.notes, gift.claimedByName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}
