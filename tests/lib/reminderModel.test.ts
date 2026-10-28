import { describe, expect, test } from 'bun:test';
import {
  buildReminders,
  parseDateOnly,
  daysUntil,
  toDateKey,
  sortReminders,
  countSeverities,
  countBadge,
  visibleReminders,
  withMute,
  pruneMuted,
  muteKeyFor,
  remindersToastText,
  MAX_REMINDERS,
  PAYMENT_LOOKAHEAD_DAYS,
  TASK_LOOKAHEAD_DAYS,
  RSVP_LOOKAHEAD_DAYS,
} from '../../src/lib/reminders/reminderModel';

/* Fixed clock so every assertion is deterministic. */
const TODAY = new Date(2026, 9, 27); // 2026-10-27 local

const baseEvent = (over = {}) => ({
  id: 'evt-1',
  title: 'Maya & Raj Wedding',
  date: '2027-07-18',
  guests: [],
  tasks: [],
  payments: [],
  runSheet: [],
  invitation: {},
  ...over,
});

describe('parseDateOnly / daysUntil / toDateKey', () => {
  test('parses strict YYYY-MM-DD at local midnight', () => {
    const d = parseDateOnly('2026-10-27');
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(27);
  });

  test('rejects malformed and impossible dates', () => {
    expect(parseDateOnly('2026-13-01')).toBeNull();
    expect(parseDateOnly('2026-02-30')).toBeNull();
    expect(parseDateOnly('10/27/2026')).toBeNull();
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(20261027)).toBeNull();
  });

  test('daysUntil counts whole days, positive = future', () => {
    expect(daysUntil('2026-10-27', TODAY)).toBe(0);
    expect(daysUntil('2026-10-30', TODAY)).toBe(3);
    expect(daysUntil('2026-10-25', TODAY)).toBe(-2);
    expect(daysUntil('nonsense', TODAY)).toBeNull();
  });

  test('toDateKey round-trips a date', () => {
    expect(toDateKey(TODAY)).toBe('2026-10-27');
    expect(toDateKey(new Date(2027, 0, 5))).toBe('2027-01-05');
    expect(toDateKey('nope')).toBe('');
  });
});

describe('buildReminders — payments', () => {
  test('overdue unpaid payment is overdue with amount + vendor detail', () => {
    const event = baseEvent({
      payments: [
        { id: 'p1', label: 'Floral balance', vendorName: 'Botanica Flora', amount: 1650, dueDate: '2026-10-25', paid: false },
      ],
    });
    const { reminders, counts, badge } = buildReminders(event, { today: TODAY });
    const r = reminders.find((x) => x.kind === 'payment');
    expect(r).toBeDefined();
    expect(r.severity).toBe('overdue');
    expect(r.diffDays).toBe(-2);
    expect(r.title).toContain('overdue by 2 days');
    expect(r.title).toContain('Floral balance');
    expect(r.detail).toContain('$1,650');
    expect(r.detail).toContain('Botanica Flora');
    expect(r.tab).toBe('dayof');
    expect(counts.overdue).toBe(1);
    expect(badge).toBe(1);
  });

  test('due-today and due-soon payments are urgent; far ones surface as upcoming within the window', () => {
    const event = baseEvent({
      payments: [
        { id: 'a', label: 'Due today', amount: 100, dueDate: '2026-10-27', paid: false },
        { id: 'b', label: 'Due in 2', amount: 100, dueDate: '2026-10-29', paid: false },
        { id: 'c', label: 'Due in 10', amount: 100, dueDate: '2026-11-06', paid: false },
      ],
    });
    const { reminders } = buildReminders(event, { today: TODAY });
    const today = reminders.find((x) => x.id.includes(':a:'));
    const soon = reminders.find((x) => x.id.includes(':b:'));
    const later = reminders.find((x) => x.id.includes(':c:'));
    expect(today.severity).toBe('urgent');
    expect(today.title).toContain('due today');
    expect(soon.severity).toBe('urgent');
    expect(later.severity).toBe('upcoming');
  });

  test('paid payments and beyond-lookahead payments never appear', () => {
    const event = baseEvent({
      payments: [
        { id: 'paid', label: 'Settled', amount: 1, dueDate: '2026-10-20', paid: true },
        { id: 'far', label: 'Far future', amount: 1, dueDate: '2027-08-01', paid: false },
      ],
    });
    const { reminders } = buildReminders(event, { today: TODAY });
    expect(reminders.filter((x) => x.kind === 'payment')).toHaveLength(0);
    expect(PAYMENT_LOOKAHEAD_DAYS).toBe(14);
  });

  test('junk payment rows are dropped without throwing', () => {
    const event = baseEvent({ payments: [null, { paid: false }, { label: 'x', paid: false, dueDate: 'nope' }] });
    expect(() => buildReminders(event, { today: TODAY })).not.toThrow();
    const { reminders } = buildReminders(event, { today: TODAY });
    expect(reminders.filter((x) => x.kind === 'payment')).toHaveLength(0);
  });
});

describe('buildReminders — tasks', () => {
  test('open overdue task is overdue; completed task is silent', () => {
    const event = baseEvent({
      tasks: [
        { id: 't1', title: 'Seating chart', dueDate: '2026-10-24', completed: false, priority: 'high' },
        { id: 't2', title: 'Done thing', dueDate: '2026-10-20', completed: true },
      ],
    });
    const { reminders } = buildReminders(event, { today: TODAY });
    const tasks = reminders.filter((x) => x.kind === 'task');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].severity).toBe('overdue');
    expect(tasks[0].title).toContain('Seating chart');
    expect(tasks[0].detail).toContain('high priority');
    expect(tasks[0].tab).toBe('timeline');
  });

  test('task window is tighter than payments (7 days)', () => {
    expect(TASK_LOOKAHEAD_DAYS).toBe(7);
    const event = baseEvent({
      tasks: [{ id: 't8', title: 'Eight days out', dueDate: '2026-11-04', completed: false }],
    });
    const { reminders } = buildReminders(event, { today: TODAY });
    expect(reminders.filter((x) => x.kind === 'task')).toHaveLength(0);
  });
});

describe('buildReminders — RSVP deadline', () => {
  const guests = [
    { id: 'g1', rsvp: 'attending' },
    { id: 'g2', rsvp: 'invited' },
    { id: 'g3', rsvp: 'maybe' },
    { id: 'g4', rsvp: 'declined' },
  ];

  test('nags only while guests are unanswered', () => {
    const event = baseEvent({ guests, invitation: { rsvpDeadline: '2026-10-30' } });
    const { reminders } = buildReminders(event, { today: TODAY });
    const r = reminders.find((x) => x.kind === 'rsvp');
    expect(r).toBeDefined();
    expect(r.severity).toBe('urgent'); // 3 days out → urgent
    expect(r.title).toContain('2 guests unanswered'); // invited + maybe
    expect(r.tab).toBe('guests');
  });

  test('passed deadline becomes overdue; fully answered deadline goes quiet', () => {
    const late = buildReminders(
      baseEvent({ guests, invitation: { rsvpDeadline: '2026-10-20' } }),
      { today: TODAY }
    );
    expect(late.reminders.find((x) => x.kind === 'rsvp').severity).toBe('overdue');

    const answered = buildReminders(
      baseEvent({
        guests: guests.map((g) => ({ ...g, rsvp: 'attending' })),
        invitation: { rsvpDeadline: '2026-10-30' },
      }),
      { today: TODAY }
    );
    expect(answered.reminders.find((x) => x.kind === 'rsvp')).toBeUndefined();
  });

  test('deadline far in the future stays silent within the window', () => {
    expect(RSVP_LOOKAHEAD_DAYS).toBe(14);
    const event = baseEvent({ guests, invitation: { rsvpDeadline: '2026-12-01' } });
    const { reminders } = buildReminders(event, { today: TODAY });
    expect(reminders.find((x) => x.kind === 'rsvp')).toBeUndefined();
  });
});

describe('buildReminders — countdown', () => {
  test('exact milestone days earn an info heads-up with open-task detail', () => {
    const event = baseEvent({
      date: '2026-11-10', // 14 days out
      tasks: [
        { id: 'open', title: 'A', completed: false },
        { id: 'done', title: 'B', completed: true },
      ],
    });
    const { reminders } = buildReminders(event, { today: TODAY });
    const r = reminders.find((x) => x.kind === 'countdown');
    expect(r).toBeDefined();
    expect(r.severity).toBe('info');
    expect(r.title).toContain('14 days to go');
    expect(r.title).toContain('Maya & Raj Wedding');
    expect(r.detail).toContain('1 task still open');
  });

  test('non-milestone days stay quiet; the day itself is urgent with run-sheet detail', () => {
    const quiet = buildReminders(baseEvent({ date: '2026-11-08' }), { today: TODAY });
    expect(quiet.reminders.find((x) => x.kind === 'countdown')).toBeUndefined();

    const dayOf = buildReminders(
      baseEvent({
        date: '2026-10-27',
        runSheet: [
          { id: 'r1', done: false },
          { id: 'r2', done: false },
          { id: 'r3', done: true },
        ],
      }),
      { today: TODAY }
    );
    const r = dayOf.reminders.find((x) => x.kind === 'countdown');
    expect(r.severity).toBe('urgent');
    expect(r.title).toBe('Today is the celebration!');
    expect(r.detail).toContain('2 run-sheet items still unchecked');
  });

  test('past events never count down', () => {
    const { reminders } = buildReminders(baseEvent({ date: '2026-10-01' }), { today: TODAY });
    expect(reminders.find((x) => x.kind === 'countdown')).toBeUndefined();
  });
});

describe('buildReminders — ranking, caps and guards', () => {
  test('overdue sorts before urgent before upcoming before info; soonest first within a tier', () => {
    const reminders = [
      { id: 'up-2', severity: 'upcoming', diffDays: 5 },
      { id: 'info-1', severity: 'info', diffDays: 7 },
      { id: 'od-2', severity: 'overdue', diffDays: -4 },
      { id: 'ur-1', severity: 'urgent', diffDays: 1 },
      { id: 'od-1', severity: 'overdue', diffDays: -1 },
    ];
    const ids = sortReminders(reminders).map((r) => r.id);
    expect(ids).toEqual(['od-2', 'od-1', 'ur-1', 'up-2', 'info-1']);
  });

  test('the list is capped at MAX_REMINDERS with the most important surviving', () => {
    const payments = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      label: `Payment ${i}`,
      amount: 10,
      dueDate: `2026-10-${String(2 + (i % 9)).padStart(2, '0')}`, // all overdue
      paid: false,
    }));
    const { reminders } = buildReminders(baseEvent({ payments }), { today: TODAY });
    expect(reminders.length).toBeLessThanOrEqual(MAX_REMINDERS);
    expect(reminders.every((r) => r.severity === 'overdue')).toBe(true);
  });

  test('badge counts only overdue + urgent; info alone never badges', () => {
    const infoOnly = buildReminders(
      baseEvent({ date: '2026-11-10', tasks: [] }), // 14-day milestone, nothing else
      { today: TODAY }
    );
    expect(infoOnly.badge).toBe(0);
    expect(countBadge([{ severity: 'overdue' }, { severity: 'urgent' }, { severity: 'upcoming' }, { severity: 'info' }])).toBe(2);
  });

  test('null / malformed event degrades to an empty report', () => {
    const empty = buildReminders(null, { today: TODAY });
    expect(empty.reminders).toEqual([]);
    expect(empty.badge).toBe(0);
    expect(countSeverities([])).toEqual({ overdue: 0, urgent: 0, upcoming: 0, info: 0 });
  });
});

describe('mutes — snooze until tomorrow', () => {
  const event = baseEvent({
    payments: [{ id: 'p1', label: 'Late florist', amount: 5, dueDate: '2026-10-25', paid: false }],
  });
  const built = buildReminders(event, { today: TODAY });
  const reminder = built.reminders[0];
  const key = muteKeyFor('evt-1', reminder);

  test('mute key is stable and event-scoped', () => {
    expect(key).toBe(`evt-1::${reminder.id}`);
    expect(muteKeyFor('other', reminder)).not.toBe(key);
  });

  test('a mute recorded today hides the item; an older mute has expired', () => {
    const todayKey = toDateKey(TODAY);
    const hidden = visibleReminders(built.reminders, { [key]: todayKey }, todayKey);
    expect(hidden).toHaveLength(0);

    const stale = visibleReminders(built.reminders, { [key]: '2026-10-20' }, todayKey);
    expect(stale).toHaveLength(1);

    const tomorrow = visibleReminders(built.reminders, { [key]: todayKey }, '2026-10-28');
    expect(tomorrow).toHaveLength(1); // resurfaces the next day
  });

  test('withMute records and prunes in one pass', () => {
    const todayKey = toDateKey(TODAY);
    const next = withMute({ ancient: '2020-01-01' }, key, todayKey);
    expect(next[key]).toBe(todayKey);
    expect(next.ancient).toBeUndefined();
  });

  test('pruneMuted drops junk and ancient entries, keeps fresh ones', () => {
    const todayKey = '2026-10-27';
    const kept = pruneMuted(
      { fresh: '2026-10-15', old: '2025-01-01', junk: 'nope', num: 5 },
      todayKey
    );
    expect(Object.keys(kept)).toEqual(['fresh']);
  });
});

describe('remindersToastText', () => {
  test('overdue + urgent items read as needing attention', () => {
    const text = remindersToastText([
      { severity: 'overdue' },
      { severity: 'urgent' },
      { severity: 'upcoming' },
    ]);
    expect(text).toContain('3 reminders need attention');
    expect(text).toContain('1 overdue');
    expect(text).toContain('1 urgent');
  });

  test('only soft items stay friendly; empty is silent', () => {
    expect(remindersToastText([{ severity: 'upcoming' }])).toContain('1 upcoming reminder');
    expect(remindersToastText([{ severity: 'info' }])).toContain('1 upcoming reminder');
    expect(remindersToastText([])).toBe('');
  });
});
