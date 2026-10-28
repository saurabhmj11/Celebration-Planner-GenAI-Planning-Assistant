import { describe, expect, test } from 'bun:test';
import {
  GIFT_STATUSES,
  GIFT_PRIORITIES,
  normalizeGift,
  normalizeGiftUrl,
  claimGift,
  releaseGift,
  markGiftPurchased,
  giftStats,
  matchesGift,
} from '../../src/lib/gifts/giftModel';

const baseGift = {
  id: 'gift-1',
  name: 'Stand Mixer in Matte Sage',
  store: 'Culinary Depot',
  url: 'https://example.com/mixer',
  price: 380,
  priority: 'medium',
  status: 'available',
  claimedByName: '',
  claimedByGuestId: '',
  notes: 'For pasta nights.',
};

describe('normalizeGiftUrl', () => {
  test('accepts http and https, rejects everything else', () => {
    expect(normalizeGiftUrl('https://shop.example.com/gift')).toBe('https://shop.example.com/gift');
    expect(normalizeGiftUrl('http://shop.example.com/gift')).toBe('http://shop.example.com/gift');
    expect(normalizeGiftUrl('javascript:alert(1)')).toBe('');
    expect(normalizeGiftUrl('data:text/html,evil')).toBe('');
    expect(normalizeGiftUrl('')).toBe('');
    expect(normalizeGiftUrl(42 as never)).toBe('');
  });
});

describe('normalizeGift', () => {
  test('fills a safe, complete record', () => {
    const gift = normalizeGift(baseGift);
    expect(gift).toEqual({ ...baseGift });
  });

  test('name is required — junk records are rejected with null', () => {
    expect(normalizeGift(null)).toBeNull();
    expect(normalizeGift({ name: '' })).toBeNull();
    expect(normalizeGift({ name: '   ' })).toBeNull();
    expect(normalizeGift({ store: 'Some store' })).toBeNull();
  });

  test('coerces bad fields to safe defaults instead of throwing', () => {
    const gift = normalizeGift({
      name: '  Board  game ',
      price: 'not-a-number',
      priority: 'ultra',
      status: 'teleported',
      url: 'javascript:nope',
      notes: 123 as never,
    });
    expect(gift!.name).toBe('Board game');
    expect(gift!.price).toBe(0);
    expect(gift!.priority).toBe('medium');
    expect(gift!.status).toBe('available');
    expect(gift!.url).toBe('');
    expect(gift!.notes).toBe('');
  });

  test('negative prices clamp to 0 and long text is trimmed', () => {
    const gift = normalizeGift({ name: 'x'.repeat(400), price: -50, notes: 'y'.repeat(600) });
    expect(gift!.price).toBe(0);
    expect(gift!.name).toHaveLength(160);
    expect(gift!.notes).toHaveLength(500);
  });
});

describe('claim / release / purchase transitions', () => {
  test('claim snapshots both the guest id and name', () => {
    const claimed = claimGift(baseGift, { guestId: 'guest-9', guestName: 'Aunt Mei' });
    expect(claimed.status).toBe('claimed');
    expect(claimed.claimedByGuestId).toBe('guest-9');
    expect(claimed.claimedByName).toBe('Aunt Mei');
  });

  test('already-claimed or purchased gifts cannot be re-claimed', () => {
    const claimed = claimGift(baseGift, { guestId: 'g', guestName: 'A' });
    expect(claimGift(claimed, { guestId: 'g2', guestName: 'B' })).toBe(claimed);
    const purchased = markGiftPurchased(claimed);
    expect(claimGift(purchased, { guestId: 'g3', guestName: 'C' })).toBe(purchased);
  });

  test('release returns a claim to available and wipes the claimant', () => {
    const claimed = claimGift(baseGift, { guestId: 'guest-9', guestName: 'Aunt Mei' });
    const released = releaseGift(claimed);
    expect(released.status).toBe('available');
    expect(released.claimedByGuestId).toBe('');
    expect(released.claimedByName).toBe('');
  });

  test('purchased gifts are protected from release (keep the name for thank-yous)', () => {
    const purchased = markGiftPurchased(claimGift(baseGift, { guestId: 'g', guestName: 'A' }));
    expect(releaseGift(purchased)).toBe(purchased);
    expect(purchased.status).toBe('purchased');
  });
});

describe('giftStats', () => {
  test('counts by status and totals the registry value', () => {
    const stats = giftStats([
      { ...baseGift, id: '1', price: 100, status: 'available' },
      { ...baseGift, id: '2', price: 200, status: 'claimed' },
      { ...baseGift, id: '3', price: 300, status: 'purchased' },
      { ...baseGift, id: '4', price: 50, status: 'unknown-status', price2: undefined },
    ]);
    expect(stats.total).toBe(4);
    expect(stats.available).toBe(2); // unknown statuses degrade to available
    expect(stats.claimed).toBe(1);
    expect(stats.purchased).toBe(1);
    expect(stats.totalValue).toBe(650);
    expect(stats.securedValue).toBe(500); // claimed + purchased
    expect(stats.securedPercent).toBe(Math.round((500 / 650) * 100));
  });

  test('empty and malformed inputs are safe', () => {
    expect(giftStats([])).toEqual({
      total: 0, available: 0, claimed: 0, purchased: 0,
      totalValue: 0, securedValue: 0, securedPercent: 0,
    });
    expect(giftStats(null as never).total).toBe(0);
    expect(giftStats([null as never, { price: 'x' }]).total).toBe(2);
  });
});

describe('matchesGift', () => {
  test('searches name, store, notes and claimant case-insensitively', () => {
    expect(matchesGift(baseGift, 'mixer')).toBe(true);
    expect(matchesGift(baseGift, 'CULINARY')).toBe(true);
    expect(matchesGift(baseGift, 'pasta')).toBe(true);
    expect(matchesGift(baseGift, '')).toBe(true);
    expect(matchesGift(baseGift, 'espresso machine')).toBe(false);
    expect(matchesGift(null as never, 'x')).toBe(false);
    const claimed = { ...baseGift, claimedByName: 'Aunt Mei' };
    expect(matchesGift(claimed, 'aunt mei')).toBe(true);
  });
});

describe('module constants', () => {
  test('statuses and priorities expose stable ids used by the UI selects', () => {
    expect(GIFT_STATUSES.map((s) => s.id)).toEqual(['available', 'claimed', 'purchased']);
    expect(GIFT_PRIORITIES.map((p) => p.id)).toEqual(['high', 'medium', 'low']);
  });
});
