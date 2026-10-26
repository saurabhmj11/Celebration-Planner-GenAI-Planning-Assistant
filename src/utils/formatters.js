/**
 * Shared display formatters.
 *
 * Single source of truth for how dates, currency, and relative counts render,
 * so every surface (navbar, hero, cards, print sheet) stays consistent —
 * fixing the mixed "2026-11-20" vs "Fri, Nov 20, 2026" friction.
 */

/**
 * Format a YYYY-MM-DD string as a friendly localized date.
 * Falls back to a placeholder when the date is missing or malformed.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {object} [opts]
 * @param {string} [opts.fallback] Returned when no valid date (default "No date set")
 * @param {string} [opts.weekday] 'short' | 'long' | undefined (default 'short')
 */
export function formatEventDate(dateStr, { fallback = 'No date set', weekday = 'short' } = {}) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return fallback;
  const d = new Date(`${dateStr}T12:00:00`); // noon anchor avoids TZ day-shift
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-US', {
    weekday,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Compact date for chips/tables: "Nov 20, 2026".
 * @param {string} dateStr - 'YYYY-MM-DD'
 */
export function formatShortDate(dateStr, { fallback = '—' } = {}) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return fallback;
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format a number as USD currency with thousands separators.
 * @param {number} value
 */
export function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * Truncate a string with an ellipsis, preserving word boundaries when possible.
 * @param {string} text
 * @param {number} [maxLen]
 */
export function truncateText(text, maxLen = 24) {
  if (!text || text.length <= maxLen) return text || '';
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}
