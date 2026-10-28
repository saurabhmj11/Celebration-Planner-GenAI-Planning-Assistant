/**
 * Multi-currency display model — pure, unit-testable.
 *
 * Amounts are STORED in USD (the historical base of every budget in this
 * app); currency config changes how money is DISPLAYED:
 *   - convert: true  -> amounts convert through an editable rate table
 *   - convert: false -> same numbers, different symbol/format (format-only)
 *
 * The active config lives in a module singleton hydrated once by
 * EventContext from localStorage; formatters.formatCurrency delegates here so
 * every existing call site becomes currency-aware without any edits.
 */

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', defaultRate: 1 },
  { code: 'EUR', symbol: '€', name: 'Euro', defaultRate: 0.92 },
  { code: 'GBP', symbol: '£', name: 'British Pound', defaultRate: 0.79 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', defaultRate: 83.5 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', defaultRate: 150 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', defaultRate: 1.36 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', defaultRate: 1.52 },
];

const CODES = new Set(CURRENCIES.map((c) => c.code));

export const DEFAULT_CURRENCY_CONFIG = Object.freeze({ code: 'USD', convert: true, rates: {} });

/** Currency meta lookup (unknown code falls back to USD). */
export function currencyOf(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

/**
 * Sanitize a raw config object into a safe shape.
 * Rates must be finite positive numbers; junk is silently dropped.
 */
export function normalizeCurrencyConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const code = CODES.has(source.code) ? source.code : 'USD';
  const rates = {};
  const rawRates = source.rates && typeof source.rates === 'object' ? source.rates : {};
  for (const [key, value] of Object.entries(rawRates)) {
    const n = Number(value);
    if (CODES.has(key) && Number.isFinite(n) && n > 0) {
      rates[key] = Math.round(n * 10_000) / 10_000; // 4-dp precision guard
    }
  }
  return { code, convert: Boolean(source.convert), rates };
}

/* ---------------------------------------------------------------------- */
/* Module singleton — hydrated by EventContext, read by formatters.       */
/* ---------------------------------------------------------------------- */

let activeConfig = { ...DEFAULT_CURRENCY_CONFIG };

/** Current display config (always normalized). */
export function getCurrencyConfig() {
  return activeConfig;
}

/** Set + normalize the active config. Returns the normalized copy stored. */
export function setCurrencyConfig(raw) {
  activeConfig = normalizeCurrencyConfig(raw);
  return { ...activeConfig };
}

/** Reset to USD defaults (used by tests + "Reset" affordances). */
export function resetCurrencyConfig() {
  activeConfig = { ...DEFAULT_CURRENCY_CONFIG };
  return { ...activeConfig };
}

/** Effective USD→code rate after user overrides. */
export function effectiveRate(cfg, code = undefined) {
  const config = cfg ? normalizeCurrencyConfig(cfg) : activeConfig;
  const target = code || config.code;
  const override = config.rates[target];
  if (Number.isFinite(override) && override > 0) return override;
  return currencyOf(target).defaultRate;
}

/** Convert a USD amount for display. Never throws; NaN/null -> 0. */
export function convertAmount(usd, cfg = null) {
  const n = Number(usd);
  if (!Number.isFinite(n)) return 0;
  const config = cfg ? normalizeCurrencyConfig(cfg) : activeConfig;
  const rate = effectiveRate(config);
  return config.convert ? n * rate : n;
}

/**
 * Format a stored USD amount in the active (or given) display currency.
 * JPY and other zero-decimal currencies render without cents automatically.
 */
export function formatMoney(usd, cfg = null) {
  const n = Number(usd);
  const config = cfg ? normalizeCurrencyConfig(cfg) : activeConfig;
  const amount = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: config.code,
      maximumFractionDigits: 0,
    }).format(Math.round(convertAmount(amount, config)));
  } catch (_err) {
    // Unknown currency code (shouldn't happen post-normalize) — degrade to USD.
    return `$${Math.round(amount).toLocaleString('en-US')}`;
  }
}

/** "1 USD = 0.92 EUR" style label for the settings modal. */
export function rateLabel(cfg, code = undefined) {
  const config = cfg ? normalizeCurrencyConfig(cfg) : activeConfig;
  const target = code || config.code;
  return `1 USD = ${effectiveRate(config, target)} ${target}`;
}
