/**
 * Pure calculation utilities for Celebration & Event Planner
 * Encapsulates math and status evaluation for budgets, timelines, and vendors.
 */

/**
 * Calculates budget totals and financial health indicators for an event.
 */
export function calculateBudgetTotals(event) {
  if (!event) {
    return {
      totalBudget: 0,
      totalSpent: 0,
      totalAllocated: 0,
      remainingBudget: 0,
      isOverBudget: false,
      isAllocatedOver: false,
      spentPct: 0,
      costPerGuest: 0,
    };
  }

  const totalBudget = Math.max(0, Number(event.budget) || 0);
  const expenses = Array.isArray(event.expenses) ? event.expenses : [];
  const guestCount = Math.max(1, Number(event.guestCount) || 1);

  const totalSpent = expenses.reduce((sum, item) => sum + Math.max(0, Number(item?.spent) || 0), 0);
  const totalAllocated = expenses.reduce((sum, item) => sum + Math.max(0, Number(item?.allocated) || 0), 0);

  const remainingBudget = totalBudget - totalSpent;
  const isOverBudget = remainingBudget < 0;
  const isAllocatedOver = totalAllocated > totalBudget;
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const costPerGuest = Math.round(totalSpent / guestCount);

  return {
    totalBudget,
    totalSpent,
    totalAllocated,
    remainingBudget,
    isOverBudget,
    isAllocatedOver,
    spentPct,
    costPerGuest,
  };
}

/**
 * Aggregates expenses by budget category.
 */
export function calculateCategoryBreakdown(categories, expenses, totalBudget = 0) {
  if (!Array.isArray(categories)) return [];
  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const safeBudget = Math.max(0, Number(totalBudget) || 0);

  return categories.map((cat) => {
    const catExpenses = safeExpenses.filter((e) => e?.category === cat.id);
    const spent = catExpenses.reduce((s, e) => s + Math.max(0, Number(e?.spent) || 0), 0);
    const allocated = catExpenses.reduce((s, e) => s + Math.max(0, Number(e?.allocated) || 0), 0);
    const pctOfBudget = safeBudget > 0 ? Math.round((spent / safeBudget) * 100) : 0;

    return {
      ...cat,
      spent,
      allocated,
      pctOfBudget,
      itemCount: catExpenses.length,
    };
  });
}

/**
 * Calculates timeline task metrics.
 */
export function calculateTimelineStats(tasks) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const totalTasks = safeTasks.length;
  const completedTasks = safeTasks.filter((t) => Boolean(t?.completed)).length;
  const pendingTasks = totalTasks - completedTasks;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    totalTasks,
    completedTasks,
    pendingTasks,
    progressPct,
  };
}

/**
 * Evaluates due date status and urgency for a milestone.
 * @param {string} dueDateStr - 'YYYY-MM-DD'
 * @param {boolean} isCompleted - completion status
 * @param {Date} [referenceDate] - date to compare against (defaults to now)
 */
export function getDueDateUrgency(dueDateStr, isCompleted = false, referenceDate = new Date()) {
  if (!dueDateStr || isCompleted) return null;

  const parts = dueDateStr.split('-');
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map(Number);

  // Strict calendar validation: reject month/day overflow (e.g. 2026-13-99)
  // which JavaScript's Date would otherwise silently roll over.
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (String(year).length !== 4) return null;

  const due = new Date(year, month - 1, day);
  // Guard against e.g. 2026-02-31 which rolls into March.
  if (due.getMonth() !== month - 1 || due.getDate() !== day) return null;
  if (Number.isNaN(due.getTime())) return null;

  const now = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      status: 'overdue',
      diffDays,
      label: `Overdue by ${overdueDays}d`,
      color: 'text-rose-700 bg-rose-50 border-rose-200'
    };
  }

  if (diffDays === 0) {
    return {
      status: 'today',
      diffDays: 0,
      label: 'Due Today',
      color: 'text-amber-700 bg-amber-50 border-amber-200'
    };
  }

  if (diffDays <= 3) {
    return {
      status: 'urgent',
      diffDays,
      label: `Due in ${diffDays}d`,
      color: 'text-amber-700 bg-amber-50 border-amber-200'
    };
  }

  return {
    status: 'upcoming',
    diffDays,
    label: `Due in ${diffDays}d`,
    color: 'text-slate-600 bg-slate-50 border-slate-200'
  };
}

/**
 * Calculates vendor directory commitments and status counts.
 */
export function calculateVendorStats(vendors) {
  const safeVendors = Array.isArray(vendors) ? vendors : [];
  const totalVendors = safeVendors.length;
  const bookedCount = safeVendors.filter(
    (v) => v?.status === 'booked' || v?.status === 'deposit_paid'
  ).length;
  const totalCommittedCost = safeVendors.reduce((sum, v) => sum + Math.max(0, Number(v?.cost) || 0), 0);

  return {
    totalVendors,
    bookedCount,
    totalCommittedCost,
  };
}

/**
 * Aggregates the guest list into RSVP + headcount + kitchen metrics.
 *
 * `attendingHeadcount` is the number caterers actually plan for: attending
 * guests PLUS the plus-ones they registered. Meal counts cover attending
 * guests only — a declined guest's dinner preference is noise.
 *
 * @param {Array} guests - guest entries with { rsvp, plusOnes, meal, group }
 */
export function calculateGuestStats(guests) {
  const safeGuests = Array.isArray(guests) ? guests : [];
  const totalGuests = safeGuests.length;

  const byStatus = { invited: 0, attending: 0, maybe: 0, declined: 0 };
  const mealCounts = {};
  const byGroup = {};
  let plusOnesAttending = 0;

  for (const g of safeGuests) {
    const status = byStatus[g?.rsvp] !== undefined ? g.rsvp : 'invited';
    byStatus[status] += 1;

    const group = g?.group || 'friends';
    byGroup[group] = (byGroup[group] || 0) + 1;

    if (status === 'attending') {
      const plusOnes = Math.max(0, Math.min(10, Number(g?.plusOnes) || 0));
      plusOnesAttending += plusOnes;
      const meal = g?.meal || 'standard';
      mealCounts[meal] = (mealCounts[meal] || 0) + 1;
    }
  }

  const responded = byStatus.attending + byStatus.maybe + byStatus.declined;
  const responseRate = totalGuests > 0 ? Math.round((responded / totalGuests) * 100) : 0;

  return {
    totalGuests,
    byStatus,
    byGroup,
    responded,
    pending: byStatus.invited,
    responseRate,
    attendingHeadcount: byStatus.attending + plusOnesAttending,
    plusOnesAttending,
    mealCounts,
  };
}

/**
 * Payment-schedule ledger metrics.
 *
 * A payment is { amount, dueDate: 'YYYY-MM-DD', paid, kind }. `nextDue` is
 * the earliest UNPAID future (or today) milestone — the "write this cheque
 * next" signal for the dashboard chip and ledger header.
 *
 * @param {Array} payments
 * @param {Date} [referenceDate]
 */
export function calculatePaymentStats(payments, referenceDate = new Date()) {
  const safePayments = Array.isArray(payments) ? payments : [];
  const now = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  const total = safePayments.length;
  let paidTotal = 0;
  let outstandingTotal = 0;
  let paidCount = 0;
  let overdueCount = 0;
  let overdueTotal = 0;
  let nextDue = null;

  for (const p of safePayments) {
    const amount = Math.max(0, Number(p?.amount) || 0);
    if (p?.paid) {
      paidCount += 1;
      paidTotal += amount;
      continue;
    }
    outstandingTotal += amount;
    const due = parseDateOnly(p?.dueDate);
    if (due && due.getTime() < now.getTime()) {
      overdueCount += 1;
      overdueTotal += amount;
    } else if (due && (!nextDue || due.getTime() < nextDue.due.getTime())) {
      const diffDays = Math.round((due.getTime() - now.getTime()) / 86_400_000);
      nextDue = { due, date: p.dueDate, diffDays, label: diffDays === 0 ? 'Due today' : `Due in ${diffDays}d`, amount };
    }
  }

  return {
    total,
    paidCount,
    paidTotal,
    outstandingTotal,
    overdueCount,
    overdueTotal,
    nextDue,
  };
}

/** Strict 'YYYY-MM-DD' parser that rejects month/day rollover; null when invalid. */
function parseDateOnly(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Seating-chart metrics. Seats are weighted (1 + plus-ones) — see
 * src/lib/planning/seating.js seatWeight().
 *
 * @param {Array} tables - [{ id, name, capacity, seats: guestId[] }]
 * @param {Array} guests - full guest list (only attending are seatable)
 */
export function calculateSeatingStats(tables, guests) {
  const safeTables = Array.isArray(tables) ? tables.filter((t) => t && t.id) : [];
  const byId = new Map((Array.isArray(guests) ? guests : []).filter((g) => g && g.id).map((g) => [g.id, g]));
  const seatWeightOf = (id) => {
    const g = byId.get(id);
    if (!g) return 1;
    return 1 + Math.max(0, Math.min(10, Number(g.plusOnes) || 0));
  };

  const seatable = [...byId.values()].filter((g) => g.rsvp === 'attending');
  const seatableIds = new Set(seatable.map((g) => g.id));

  let capacity = 0;
  let takenSeats = 0;
  const seatedIds = new Set();
  const overCapacityTables = [];

  for (const table of safeTables) {
    const cap = Math.max(1, Math.min(50, Math.round(Number(table.capacity) || 8)));
    capacity += cap;
    let used = 0;
    for (const guestId of Array.isArray(table.seats) ? table.seats : []) {
      if (!seatableIds.has(guestId) || seatedIds.has(guestId)) continue; // stale/duplicate seat
      seatedIds.add(guestId);
      used += seatWeightOf(guestId);
    }
    takenSeats += used;
    if (used > cap) overCapacityTables.push(table.id);
  }

  return {
    totalTables: safeTables.length,
    totalCapacity: capacity,
    takenSeats,
    seatsFree: Math.max(0, capacity - takenSeats),
    seatedCount: seatedIds.size,
    unseatedCount: Math.max(0, seatableIds.size - seatedIds.size),
    seatableCount: seatableIds.size,
    overCapacityTables,
    utilizationPct: capacity > 0 ? Math.round((takenSeats / capacity) * 100) : 0,
  };
}

/**
 * Day-of run-sheet metrics.
 *
 * @param {Array} items - [{ time: 'HH:MM', durationMin, activity, done }]
 */
export function calculateRunSheetStats(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.length;
  const done = safeItems.filter((i) => Boolean(i?.done)).length;

  const toMinutes = (t) => {
    if (!t || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const timed = safeItems
    .map((i) => ({ item: i, mins: toMinutes(i?.time) }))
    .filter((x) => x.mins !== null)
    .sort((a, b) => a.mins - b.mins);

  let spanMin = 0;
  if (timed.length > 0) {
    const last = timed[timed.length - 1];
    const lastEnd = last.mins + Math.max(0, Math.min(1440, Math.round(Number(last.item.durationMin) || 0)));
    spanMin = Math.max(0, lastEnd - timed[0].mins);
  }

  return {
    total,
    done,
    pending: total - done,
    progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
    firstAt: timed.length > 0 ? timed[0].item.time : null,
    lastAt: timed.length > 0 ? timed[timed.length - 1].item.time : null,
    spanHours: spanMin > 0 ? Math.round((spanMin / 60) * 10) / 10 : 0,
    sorted: timed.map((x) => x.item),
  };
}

/**
 * RSVP-deadline urgency for banner chips and nag badges.
 * Mirrors getDueDateUrgency()'s shape ({status, diffDays, label, color})
 * so existing chip markup can render either identically.
 * @param {string} deadlineStr - 'YYYY-MM-DD'
 * @param {Date} [referenceDate]
 */
export function getRsvpUrgency(deadlineStr, referenceDate = new Date()) {
  if (!deadlineStr || !/^\d{4}-\d{2}-\d{2}$/.test(deadlineStr)) return null;

  const [year, month, day] = deadlineStr.split('-').map(Number);
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const due = new Date(year, month - 1, day);
  if (due.getMonth() !== month - 1 || due.getDate() !== day) return null;
  if (Number.isNaN(due.getTime())) return null;

  const now = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return { status: 'overdue', diffDays, label: `RSVP deadline passed ${Math.abs(diffDays)}d ago`, color: 'text-rose-700 bg-rose-50 border-rose-200' };
  }
  if (diffDays === 0) {
    return { status: 'today', diffDays, label: 'RSVPs due today!', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  if (diffDays <= 7) {
    return { status: 'urgent', diffDays, label: `RSVPs close in ${diffDays}d`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  return { status: 'upcoming', diffDays, label: `RSVPs close in ${diffDays}d`, color: 'text-slate-600 bg-slate-50 border-slate-200' };
}
