/**
 * Auto-Reminders engine (GAP 8) — pure, side-effect-free logic that turns an
 * event's live plan into a ranked nudge list.
 *
 * The planner is localStorage-first with optional cloud sync, so "automated
 * reminders" here means deterministic on-load recomputation: every time the
 * app opens (or the plan changes), the engine re-derives what needs attention
 * from four sources —
 *   1. payments   (unpaid invoices with a due date)
 *   2. tasks      (incomplete checklist items with a due date)
 *   3. RSVPs      (an approaching/passed RSVP deadline with guests unanswered)
 *   4. countdown  (milestone days before the celebration, incl. the day itself)
 *
 * Severities: overdue > urgent > upcoming > info. Every reminder carries a
 * stable id (kind + source id + due date) so the UI can mute ("snooze until
 * tomorrow") an item without it flickering back on recompute. Mutes are
 * date-scoped: a reminder muted today resurfaces tomorrow, when its window
 * has shifted and the nudge is honest again.
 *
 * Guardrails: malformed dates and junk shapes are dropped (never throw), the
 * list is capped so a messy plan cannot flood the bell, and past events go
 * quiet (nothing nags about a celebration that already happened).
 */

/** Show at most this many reminders in the bell panel. */
export const MAX_REMINDERS = 12;

/** Unpaid payments surface this many days before they are due. */
export const PAYMENT_LOOKAHEAD_DAYS = 14;
/** Open tasks surface this many days before they are due. */
export const TASK_LOOKAHEAD_DAYS = 7;
/** An RSVP deadline nags while guests are still unanswered. */
export const RSVP_LOOKAHEAD_DAYS = 14;
/** Countdown milestones (days before the event) that earn a heads-up. */
export const COUNTDOWN_MILESTONES = [30, 14, 7, 3, 1];

/** Anything at or below this severity rank shows in the bell badge. */
const SEVERITY_ORDER = { overdue: 0, urgent: 1, upcoming: 2, info: 3 };

/**
 * Strict 'YYYY-MM-DD' → Date at local midnight. Returns null for anything
 * malformed so one bad row can never poison the whole nudge list.
 */
export function parseDateOnly(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** Whole-day difference: due − today (positive = in the future). */
export function daysUntil(dueStr, todayMidnight) {
  const due = parseDateOnly(dueStr);
  if (!due || !(todayMidnight instanceof Date) || Number.isNaN(todayMidnight.getTime())) return null;
  const today = new Date(todayMidnight.getFullYear(), todayMidnight.getMonth(), todayMidnight.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** Local 'YYYY-MM-DD' for a Date — the key for date-scoped mutes. */
export function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function severityFor(diff, urgentWithin, isDeadlinePassed = false) {
  if (diff < 0) return 'overdue';
  if (isDeadlinePassed) return 'overdue';
  if (diff <= urgentWithin) return diff <= 3 ? 'urgent' : 'upcoming';
  return 'upcoming';
}

function duePhrase(diff) {
  if (diff < 0) return `overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`;
  if (diff === 0) return 'due today';
  return `in ${diff} day${diff === 1 ? '' : 's'}`;
}

function money(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/**
 * Build the ranked reminder list for one event.
 *
 * @param {object} event - the full event (guests, tasks, payments,
 *   invitation, runSheet, date).
 * @param {{ today?: Date, now?: Date }} [opts] - injectable clock for tests.
 * @returns {{ reminders: Array, counts: object, badge: number }}
 */
export function buildReminders(event, opts = {}) {
  const today = opts.today instanceof Date ? opts.today : new Date();
  const reminders = [];
  if (!event || typeof event !== 'object') {
    return { reminders: [], counts: { overdue: 0, urgent: 0, upcoming: 0, info: 0 }, badge: 0 };
  }

  /* 1 — Payments (unpaid, dated, within the window). */
  const eventId = event.id || 'event';
  for (const p of Array.isArray(event.payments) ? event.payments : []) {
    if (!p || p.paid) continue;
    const diff = daysUntil(p.dueDate, today);
    if (diff === null || diff > PAYMENT_LOOKAHEAD_DAYS) continue;
    const severity = severityFor(diff, 3);
    const label = typeof p.label === 'string' && p.label.trim() ? p.label.trim() : 'Unnamed payment';
    const amount = money(p.amount);
    reminders.push({
      id: `payment:${p.id || p.dueDate}:${p.dueDate}`,
      eventId,
      kind: 'payment',
      severity,
      title: `Payment ${duePhrase(diff)}: ${label}`,
      detail: [amount, p.dueDate, p.vendorName].filter(Boolean).join(' · '),
      dueDate: p.dueDate,
      diffDays: diff,
      tab: 'dayof',
    });
  }

  /* 2 — Tasks (incomplete, dated, within the window). */
  for (const t of Array.isArray(event.tasks) ? event.tasks : []) {
    if (!t || t.completed) continue;
    const diff = daysUntil(t.dueDate, today);
    if (diff === null || diff > TASK_LOOKAHEAD_DAYS) continue;
    const severity = severityFor(diff, 3);
    const title = typeof t.title === 'string' && t.title.trim() ? t.title.trim() : 'Untitled task';
    reminders.push({
      id: `task:${t.id || t.dueDate}:${t.dueDate}`,
      eventId,
      kind: 'task',
      severity,
      title: `Task ${duePhrase(diff)}: ${title}`,
      detail: [t.priority ? `${t.priority} priority` : null, t.dueDate, t.phase].filter(Boolean).join(' · '),
      dueDate: t.dueDate,
      diffDays: diff,
      tab: 'timeline',
    });
  }

  /* 3 — RSVP deadline with guests still unanswered. */
  const guests = Array.isArray(event.guests) ? event.guests : [];
  const unanswered = guests.filter((g) => !g?.rsvp || g.rsvp === 'invited' || g.rsvp === 'maybe').length;
  const deadline = event?.invitation?.rsvpDeadline;
  if (unanswered > 0) {
    const diff = daysUntil(deadline, today);
    if (diff !== null && diff <= RSVP_LOOKAHEAD_DAYS) {
      const severity = severityFor(diff, 3);
      reminders.push({
        id: `rsvp:${event.id || 'event'}:${deadline}`,
        eventId,
        kind: 'rsvp',
        severity,
        title:
          diff < 0
            ? `RSVP deadline passed — ${unanswered} guest${unanswered === 1 ? '' : 's'} still unanswered`
            : `RSVP deadline ${duePhrase(diff)} — ${unanswered} guest${unanswered === 1 ? '' : 's'} unanswered`,
        detail: `Deadline ${deadline} · chase them from the guest list`,
        dueDate: deadline,
        diffDays: diff,
        tab: 'guests',
      });
    }
  }

  /* 4 — Countdown milestones + the big day itself. */
  const eventDiff = daysUntil(event.date, today);
  if (eventDiff !== null && eventDiff >= 0) {
    if (eventDiff === 0) {
      const undone = (Array.isArray(event.runSheet) ? event.runSheet : []).filter((r) => r && !r.done).length;
      reminders.push({
        id: `countdown:${event.id || 'event'}:today`,
        eventId,
        kind: 'countdown',
        severity: 'urgent',
        title: 'Today is the celebration!',
        detail: undone > 0 ? `${undone} run-sheet item${undone === 1 ? '' : 's'} still unchecked` : 'Open the day-of workbench for the run sheet',
        dueDate: event.date,
        diffDays: 0,
        tab: 'dayof',
      });
    } else if (COUNTDOWN_MILESTONES.includes(eventDiff)) {
      const openTasks = (Array.isArray(event.tasks) ? event.tasks : []).filter((t) => t && !t.completed).length;
      reminders.push({
        id: `countdown:${event.id || 'event'}:${event.date}`,
        eventId,
        kind: 'countdown',
        severity: 'info',
        title: `${eventDiff} day${eventDiff === 1 ? '' : 's'} to go — ${event.title || 'your celebration'}`,
        detail: openTasks > 0 ? `${openTasks} task${openTasks === 1 ? '' : 's'} still open on the plan` : 'The plan is all clear',
        dueDate: event.date,
        diffDays: eventDiff,
        tab: 'dashboard',
      });
    }
  }

  const sorted = sortReminders(reminders).slice(0, MAX_REMINDERS);
  return { reminders: sorted, counts: countSeverities(sorted), badge: countBadge(sorted) };
}

/** Sort overdue → urgent → upcoming → info, then soonest due date first. */
export function sortReminders(reminders) {
  const list = Array.isArray(reminders) ? [...reminders] : [];
  return list.sort((a, b) => {
    const bySeverity = (SEVERITY_ORDER[a?.severity] ?? 99) - (SEVERITY_ORDER[b?.severity] ?? 99);
    if (bySeverity !== 0) return bySeverity;
    const da = a?.diffDays ?? 0;
    const db = b?.diffDays ?? 0;
    return da - db;
  });
}

export function countSeverities(reminders) {
  const counts = { overdue: 0, urgent: 0, upcoming: 0, info: 0 };
  for (const r of Array.isArray(reminders) ? reminders : []) {
    if (r?.severity && counts[r.severity] !== undefined) counts[r.severity] += 1;
  }
  return counts;
}

/** The bell badge counts only what genuinely needs action now. */
export function countBadge(reminders) {
  const { overdue, urgent } = countSeverities(reminders);
  return overdue + urgent;
}

/* ---------------- mute ("snooze until tomorrow") ---------------- */

export const MUTED_STORAGE_KEY = 'celebration_planner_muted_reminders_v1';
/** Mutes older than this many days are pruned on load. */
export const MUTE_PRUNE_DAYS = 30;

/** Stable mute key: one event + one source item. */
export function muteKeyFor(eventId, reminder) {
  return `${eventId}::${reminder?.id || 'unknown'}`;
}

/**
 * Filter out reminders muted today (or muted on a later date — defensive).
 * A mute recorded for an older date has expired: the reminder resurfaces.
 */
export function visibleReminders(reminders, muted, todayKey) {
  const list = Array.isArray(reminders) ? reminders : [];
  if (!muted || typeof muted !== 'object') return list;
  return list.filter((r) => {
    const at = muted[muteKeyFor(r?.eventId || '', r)];
    return !(typeof at === 'string' && at >= todayKey);
  });
}

/** Record a snooze (date-keyed, so tomorrow it expires on its own). */
export function withMute(muted, key, todayKey) {
  const next = { ...(muted && typeof muted === 'object' ? muted : {}) };
  next[key] = todayKey;
  return pruneMuted(next, todayKey);
}

/** Drop stale mute entries so the blob stays tiny. */
export function pruneMuted(muted, todayKey) {
  const source = muted && typeof muted === 'object' ? muted : {};
  const today = parseDateOnly(todayKey);
  if (!today) return {};
  const cutoff = today.getTime() - MUTE_PRUNE_DAYS * 86_400_000;
  const out = {};
  for (const [key, at] of Object.entries(source)) {
    if (typeof at !== 'string') continue;
    const d = parseDateOnly(at);
    if (d && d.getTime() >= cutoff) out[key] = at;
  }
  return out;
}

/** One-line summary for the on-load nudge toast. */
export function remindersToastText(reminders) {
  const counts = countSeverities(reminders);
  const total = (reminders || []).length;
  if (total === 0) return '';
  const bits = [];
  if (counts.overdue > 0) bits.push(`${counts.overdue} overdue`);
  if (counts.urgent > 0) bits.push(`${counts.urgent} urgent`);
  if (bits.length === 0) return `${total} upcoming reminder${total === 1 ? '' : 's'} — tap the bell any time.`;
  return `${total} reminder${total === 1 ? '' : 's'} need${total === 1 ? 's' : ''} attention (${bits.join(', ')}) — tap the bell.`;
}
