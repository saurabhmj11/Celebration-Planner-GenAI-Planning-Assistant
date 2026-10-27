/**
 * Command palette item builders + filtering — pure, unit-testable.
 *
 * The palette component stays thin: it feeds live event data through these
 * builders, filters with `filterPaletteItems`, and maps each item's `action`
 * to a handler. Every rule about grouping, ranking and caps lives here so
 * it can be tested without React.
 *
 * Item shape (all builders return this):
 *   { id, group, label, hint?, keywords, action }
 *     action: { type: 'navigate', tab }
 *            | { type: 'selectEvent', eventId }
 *            | { type: 'newEvent' | 'addExpense' | 'addTask' | 'addVendor'
 *                | 'toggleTheme' | 'exportBackup' | 'aiSettings' | 'printMaster' }
 */

import { formatCurrency, formatShortDate } from '@/utils/formatters';
import {
  EVENT_TYPES,
  BUDGET_CATEGORIES,
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
  RSVP_STATUSES,
} from '@/data/defaultData';

/** Max results shown per group once a query is typed. */
export const GROUP_RESULT_CAP = 6;

/** Navigation entries — mirrors the 13 navbar tabs. */
export const PALETTE_NAV_ITEMS = [
  { id: 'nav-dashboard', group: 'Go to', label: 'Dashboard', keywords: 'home overview stats countdown progress', tab: 'dashboard' },
  { id: 'nav-force', group: 'Go to', label: 'Agent Force', keywords: 'agents ai workforce run status budget guard', tab: 'force' },
  { id: 'nav-budget', group: 'Go to', label: 'Budget Planner', keywords: 'budget expenses money spend allocated paid', tab: 'budget' },
  { id: 'nav-timeline', group: 'Go to', label: 'Timeline & Tasks', keywords: 'timeline tasks milestones checklist due', tab: 'timeline' },
  { id: 'nav-guests', group: 'Go to', label: 'Guests & RSVPs', keywords: 'guests rsvps invitations headcount meal plus one', tab: 'guests' },
  { id: 'nav-gifts', group: 'Go to', label: 'Gift Registry', keywords: 'gifts registry wish list claim presents', tab: 'gifts' },
  { id: 'nav-dayof', group: 'Go to', label: 'Day-Of Workbench', keywords: 'day of run sheet seating chart payment ledger schedule', tab: 'dayof' },
  { id: 'nav-photos', group: 'Go to', label: 'Photo Memory Wall', keywords: 'photos album pictures memories gallery', tab: 'photos' },
  { id: 'nav-venues', group: 'Go to', label: 'AI Venue Finder', keywords: 'venues venue finder location map recommendations', tab: 'venues' },
  { id: 'nav-vendors', group: 'Go to', label: 'Vendor Checklist', keywords: 'vendors suppliers contacts booked quotes compare', tab: 'vendors' },
  { id: 'nav-ai', group: 'Go to', label: 'AI Theme Studio', keywords: 'ai studio theme ideas palette decor music', tab: 'ai' },
  { id: 'nav-mood', group: 'Go to', label: 'Mood Board', keywords: 'mood board inspiration colors swatches imagery vibe', tab: 'mood' },
  { id: 'nav-print', group: 'Go to', label: 'Print Summary', keywords: 'print summary export master plan pdf', tab: 'print' },
].map((item) => ({
  ...item,
  action: { type: 'navigate', tab: item.tab },
  // tab is folded into keywords so "budget" finds the Budget tab too
  keywords: `${item.keywords} ${item.label}`,
}));

const labelOf = (list, id, fallback = '') =>
  list.find((entry) => entry.id === id)?.label || fallback;

const rsvpShortOf = (id) => {
  const status = RSVP_STATUSES.find((s) => s.id === id);
  return status?.short || 'Invited';
};

/**
 * Quick actions. `resolvedTheme` ('light' | 'dark' | undefined) switches the
 * theme action's label so it always describes what the click will DO.
 * `canUndo` / `canRedo` annotate the history actions; `currencyCode` shows
 * the active display currency in the currency action's hint.
 */
export function buildActionItems({ resolvedTheme, canUndo = false, canRedo = false, currencyCode = 'USD' } = {}) {
  const toDark = resolvedTheme !== 'dark';
  return [
    { id: 'act-new-event', group: 'Actions', label: 'New Celebration', keywords: 'new event create add celebration party', action: { type: 'newEvent' } },
    { id: 'act-add-expense', group: 'Actions', label: 'Add Expense', keywords: 'new expense budget cost add', action: { type: 'addExpense' } },
    { id: 'act-add-task', group: 'Actions', label: 'Add Task', keywords: 'new task todo milestone add', action: { type: 'addTask' } },
    { id: 'act-add-vendor', group: 'Actions', label: 'Add Vendor', keywords: 'new vendor supplier contact add', action: { type: 'addVendor' } },
    {
      id: 'act-undo',
      group: 'Actions',
      label: 'Undo Last Change',
      hint: canUndo ? 'Ctrl+Z — revert your latest edit' : 'Nothing to undo yet',
      keywords: 'undo revert back history last change ctrl z',
      action: { type: 'undo' },
    },
    {
      id: 'act-redo',
      group: 'Actions',
      label: 'Redo Change',
      hint: canRedo ? 'Ctrl+Shift+Z — restore what you undid' : 'Nothing to redo yet',
      keywords: 'redo repeat restore forward redo change ctrl shift z y',
      action: { type: 'redo' },
    },
    {
      id: 'act-currency',
      group: 'Actions',
      label: 'Display Currency',
      hint: `Currently showing ${currencyCode} — change symbol & conversion`,
      keywords: 'currency money display symbol euros pounds rupees yen conversion exchange rate',
      action: { type: 'currency' },
    },
    {
      id: 'act-toggle-theme',
      group: 'Actions',
      label: toDark ? 'Switch to Dark Mode' : 'Switch to Light Mode',
      keywords: 'theme dark light mode appearance night day toggle',
      action: { type: 'toggleTheme' },
    },
    { id: 'act-export-backup', group: 'Actions', label: 'Export Backup (JSON)', keywords: 'export backup download save json data', action: { type: 'exportBackup' } },
    { id: 'act-ai-settings', group: 'Actions', label: 'AI Engine Settings', keywords: 'ai engine settings api key configure', action: { type: 'aiSettings' } },
    { id: 'act-print-master', group: 'Actions', label: 'Print Master Plan', keywords: 'print master plan summary sheet paper', action: { type: 'printMaster' } },
  ];
}

/** Events you can switch to (marks the active one in its hint). */
export function buildEventItems(events, { activeEventId = null } = {}) {
  if (!Array.isArray(events)) return [];
  return events.map((ev) => {
    const typeInfo = EVENT_TYPES.find((t) => t.id === ev.type);
    return {
      id: `event:${ev.id}`,
      group: 'Events',
      label: ev.title,
      hint: `${typeInfo?.icon || '🎉'} ${formatShortDate(ev.date, { fallback: 'No date set' })} · ${formatCurrency(ev.budget)}${ev.id === activeEventId ? ' · active' : ''}`,
      keywords: [
        ev.title,
        typeInfo?.label || '',
        'switch event celebration open',
      ].join(' '),
      action: { type: 'selectEvent', eventId: ev.id },
    };
  });
}

/** Searchable guest/vendor/task/expense rows from the active event. */
export function buildDataItems(event) {
  if (!event) return [];
  const items = [];

  (event.guests || []).forEach((g) => {
    items.push({
      id: `guest:${g.id}`,
      group: 'Guests',
      label: g.name,
      hint: `RSVP ${rsvpShortOf(g.rsvp)} · ${g.group || 'guest'}${g.plusOnes ? ` · +${g.plusOnes}` : ''}`,
      keywords: [
        g.name,
        g.email || '',
        g.group || '',
        labelOf(RSVP_STATUSES, g.rsvp, 'Invited'),
        'guest rsvp',
      ].join(' '),
      action: { type: 'navigate', tab: 'guests' },
    });
  });

  (event.vendors || []).forEach((v) => {
    items.push({
      id: `vendor:${v.id}`,
      group: 'Vendors',
      label: v.name,
      hint: `${labelOf(VENDOR_CATEGORIES, v.category, v.category)} · ${labelOf(VENDOR_STATUSES, v.status, v.status)}`,
      keywords: [
        v.name,
        v.contactPerson || '',
        v.email || '',
        labelOf(VENDOR_CATEGORIES, v.category, ''),
        labelOf(VENDOR_STATUSES, v.status, ''),
        'vendor',
      ].join(' '),
      action: { type: 'navigate', tab: 'vendors' },
    });
  });

  (event.tasks || []).forEach((t) => {
    items.push({
      id: `task:${t.id}`,
      group: 'Tasks',
      label: t.title,
      hint: `${t.completed ? 'Done' : formatShortDate(t.dueDate, { fallback: 'No due date' })} · ${t.priority || 'medium'} priority`,
      keywords: [
        t.title,
        t.category || '',
        t.priority || '',
        t.completed ? 'done completed' : 'pending open todo',
        'task',
      ].join(' '),
      action: { type: 'navigate', tab: 'timeline' },
    });
  });

  (event.expenses || []).forEach((e) => {
    items.push({
      id: `expense:${e.id}`,
      group: 'Expenses',
      label: e.name,
      hint: `${labelOf(BUDGET_CATEGORIES, e.category, e.category)} · ${formatCurrency(e.allocated)} allocated`,
      keywords: [
        e.name,
        labelOf(BUDGET_CATEGORIES, e.category, ''),
        'expense budget cost',
      ].join(' '),
      action: { type: 'navigate', tab: 'budget' },
    });
  });

  return items;
}

/** Escape a raw query for embedding into a RegExp. */
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Rank + filter items against a query.
 *
 * Scoring (higher wins, label alphabetical tiebreak):
 *   3 — label starts with the query
 *   2 — query matches at a word start inside label or keywords
 *   1 — query appears anywhere in label or keywords
 * Dropped — no match at all.
 *
 * Matching is case-insensitive and per-group capped so one noisy group
 * (e.g. 60 guests) cannot push everything else out of the palette.
 */
export function filterPaletteItems(items, query, { limitPerGroup = GROUP_RESULT_CAP } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return Array.isArray(items) ? items.slice() : [];
  if (!Array.isArray(items)) return [];

  const wordStart = new RegExp(`(^|\\s)${escapeRegExp(q)}`, 'i');

  const scored = [];
  for (const item of items) {
    const label = String(item.label || '').toLowerCase();
    const keywords = String(item.keywords || '').toLowerCase();
    let score = 0;
    if (label.startsWith(q)) score = 3;
    else if (wordStart.test(label) || wordStart.test(keywords)) score = 2;
    else if (label.includes(q) || keywords.includes(q)) score = 1;
    if (score > 0) scored.push({ item, score });
  }

  scored.sort((a, b) =>
    b.score - a.score ||
    String(a.item.label).localeCompare(String(b.item.label)) ||
    String(a.item.id).localeCompare(String(b.item.id))
  );

  const perGroup = new Map();
  const out = [];
  for (const { item } of scored) {
    const count = perGroup.get(item.group) || 0;
    if (count >= limitPerGroup) continue;
    perGroup.set(item.group, count + 1);
    out.push(item);
  }
  return out;
}

/** Group a flat list of palette items, preserving first-seen group order. */
export function groupPaletteItems(items) {
  const groups = [];
  const index = new Map();
  for (const item of items) {
    if (!index.has(item.group)) {
      index.set(item.group, []);
      groups.push({ group: item.group, items: index.get(item.group) });
    }
    index.get(item.group).push(item);
  }
  return groups;
}
