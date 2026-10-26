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
