import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  CURRENCIES,
  DEFAULT_CURRENCY_CONFIG,
  currencyOf,
  normalizeCurrencyConfig,
  getCurrencyConfig,
  setCurrencyConfig,
  resetCurrencyConfig,
  effectiveRate,
  convertAmount,
  formatMoney,
  rateLabel,
} from '../../src/lib/currency/currencyModel';
import { formatCurrency } from '../../src/utils/formatters';

/* The formatters singleton is module-global: every test that touches it
   restores USD defaults so sibling test files stay deterministic. */
beforeEach(() => {
  resetCurrencyConfig();
});

afterEach(() => {
  resetCurrencyConfig();
});

describe('currencyOf', () => {
  test('looks up currency meta and falls back to USD', () => {
    expect(currencyOf('EUR').symbol).toBe('€');
    expect(currencyOf('JPY').symbol).toBe('¥');
    expect(currencyOf('NOT-A-CODE').code).toBe('USD');
    expect(currencyOf('').code).toBe('USD');
  });
});

describe('normalizeCurrencyConfig', () => {
  test('keeps known codes, drops junk rates, keeps only finite positives', () => {
    const cfg = normalizeCurrencyConfig({
      code: 'EUR',
      convert: 'yes' as never, // truthy coerces
      rates: { EUR: 0.91678912, GBP: -1, INR: 'abc', JPY: 0, USD: 1.00001 },
    });
    expect(cfg.code).toBe('EUR');
    expect(cfg.convert).toBe(true);
    expect(cfg.rates.EUR).toBeCloseTo(0.9168, 4); // rounded to 4dp
    expect(cfg.rates).not.toHaveProperty('GBP');
    expect(cfg.rates).not.toHaveProperty('INR');
    expect(cfg.rates).not.toHaveProperty('JPY');
  });

  test('unknown codes and garbage inputs fall back to the USD default', () => {
    expect(normalizeCurrencyConfig(null)).toEqual({ code: 'USD', convert: false, rates: {} });
    expect(normalizeCurrencyConfig({ code: 'XXY' }).code).toBe('USD');
    expect(normalizeCurrencyConfig('junk' as never)).toEqual({ code: 'USD', convert: false, rates: {} });
    expect(DEFAULT_CURRENCY_CONFIG.code).toBe('USD');
  });
});

describe('effectiveRate', () => {
  test('user overrides beat built-in defaults', () => {
    const cfg = { code: 'EUR', convert: true, rates: { EUR: 0.95 } };
    expect(effectiveRate(cfg)).toBe(0.95);
    expect(effectiveRate({ code: 'EUR', convert: true, rates: {} })).toBe(currencyOf('EUR').defaultRate);
    // Asking for another code's rate uses that code's default.
    expect(effectiveRate(cfg, 'GBP')).toBe(currencyOf('GBP').defaultRate);
  });

  test('the module singleton backs the no-config path', () => {
    resetCurrencyConfig();
    expect(effectiveRate(null)).toBe(1);
  });
});

describe('convertAmount', () => {
  test('converts through the rate when conversion is on', () => {
    const cfg = { code: 'EUR', convert: true, rates: { EUR: 0.92 } };
    expect(convertAmount(32000, cfg)).toBeCloseTo(29440, 6);
  });

  test('format-only mode keeps the raw number', () => {
    const cfg = { code: 'EUR', convert: false, rates: {} };
    expect(convertAmount(32000, cfg)).toBe(32000);
  });

  test('garbage amounts degrade to 0 instead of throwing', () => {
    expect(convertAmount('x', { code: 'USD', convert: true, rates: {} })).toBe(0);
    expect(convertAmount(null, { code: 'USD', convert: true, rates: {} })).toBe(0);
  });

  test('with no explicit config the singleton drives conversion', () => {
    setCurrencyConfig({ code: 'INR', convert: true, rates: { INR: 83.5 } });
    expect(convertAmount(100)).toBeCloseTo(8350, 6);
  });
});

describe('formatMoney', () => {
  test('USD matches the historical formatting exactly', () => {
    expect(formatMoney(32000, { code: 'USD', convert: true, rates: {} })).toBe('$32,000');
    expect(formatMoney(1234.6, { code: 'USD', convert: true, rates: {} })).toBe('$1,235');
  });

  test('EUR prefixes the euro symbol on converted amounts', () => {
    expect(formatMoney(32000, { code: 'EUR', convert: true, rates: { EUR: 0.92 } })).toBe('€29,440');
  });

  test('GBP, INR and JPY use their native symbols', () => {
    expect(formatMoney(1000, { code: 'GBP', convert: true, rates: { GBP: 0.79 } })).toBe('£790');
    expect(formatMoney(100, { code: 'INR', convert: true, rates: { INR: 83.5 } })).toBe('₹8,350');
    expect(formatMoney(100, { code: 'JPY', convert: true, rates: { JPY: 150 } })).toBe('¥15,000');
  });

  test('format-only mode shows the same numbers with a new symbol', () => {
    expect(formatMoney(32000, { code: 'EUR', convert: false, rates: {} })).toBe('€32,000');
  });

  test('zero-decimal currencies never render cents', () => {
    expect(formatMoney(99.9, { code: 'JPY', convert: true, rates: { JPY: 150 } })).toBe('¥14,985');
  });

  test('NaN and null render as zero, never as "NaN"', () => {
    expect(formatMoney(Number.NaN, { code: 'USD', convert: true, rates: {} })).toBe('$0');
    expect(formatMoney(null as never, { code: 'EUR', convert: true, rates: {} })).toBe('€0');
  });

  test('reads the singleton when no config is passed', () => {
    setCurrencyConfig({ code: 'EUR', convert: true, rates: { EUR: 0.92 } });
    expect(formatMoney(100)).toBe('€92');
  });
});

describe('formatters.formatCurrency integration', () => {
  test('follows the singleton, so every existing call site is currency-aware', () => {
    expect(formatCurrency(5000)).toBe('$5,000');
    setCurrencyConfig({ code: 'EUR', convert: true, rates: { EUR: 0.92 } });
    expect(formatCurrency(5000)).toBe('€4,600');
    // Display-only: same numbers, new symbol.
    setCurrencyConfig({ code: 'GBP', convert: false, rates: {} });
    expect(formatCurrency(5000)).toBe('£5,000');
  });
});

describe('rateLabel', () => {
  test('renders the USD base rate for the active or given currency', () => {
    expect(rateLabel({ code: 'EUR', convert: true, rates: {} })).toBe('1 USD = 0.92 EUR');
    expect(rateLabel({ code: 'EUR', convert: true, rates: {} }, 'JPY')).toBe('1 USD = 150 JPY');
  });
});

describe('setCurrencyConfig / resetCurrencyConfig', () => {
  test('setter normalizes what it stores and returns a copy', () => {
    const stored = setCurrencyConfig({ code: 'CAD', convert: 1 as never, rates: { CAD: 'junk' as never } });
    expect(stored).toEqual({ code: 'CAD', convert: true, rates: {} });
    expect(getCurrencyConfig()).toEqual({ code: 'CAD', convert: true, rates: {} });
    const reset = resetCurrencyConfig();
    expect(reset).toEqual({ code: 'USD', convert: true, rates: {} });
  });
});

describe('CURRENCIES catalog', () => {
  test('exposes the seven supported codes with sensible defaults', () => {
    expect(CURRENCIES.map((c) => c.code)).toEqual(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD']);
    expect(CURRENCIES[0].defaultRate).toBe(1);
    for (const c of CURRENCIES) {
      expect(c.defaultRate).toBeGreaterThan(0);
      expect(c.symbol.length).toBeGreaterThan(0);
    }
  });
});
