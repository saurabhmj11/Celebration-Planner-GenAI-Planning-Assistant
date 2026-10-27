/**
 * Starter timeline builder — makes a new (or re-typed) celebration immediately
 * useful by seeding type-aware milestone tasks, dated relative to the event date.
 *
 * Deterministic + offline-safe: reuses the Smart Offline Planning Engine's
 * per-event-type timeline templates (runway-compressed). The AI Milestone
 * Planner (Timeline tab) can later regenerate richer, personalized tasks.
 */

import { offlineTimelinePlan } from '../../services/assistOffline';
import { daysUntil, derivePhase } from '../../components/ai/aiKit';
import { EVENT_TYPES } from '../../data/defaultData';

/**
 * @param {{ type?: string, date?: string }} args — event type id + ISO date string.
 * @returns {Array<{id,title,notes,dueDate,priority,category,phase,completed}>}
 *   App-shaped tasks, ready to drop into event.tasks.
 */
export function buildStarterTasks({ type, date } = {}) {
  if (!date) return [];

  const runway = Math.max(0, daysUntil(date));
  const plan = offlineTimelinePlan({
    eventType: type || 'other',
    eventDate: date,
    daysUntilEvent: runway,
  });

  const label = EVENT_TYPES.find((t) => t.id === type)?.label || 'celebration';
  const stamp = Date.now();

  return plan.tasks.map((t, i) => ({
    id: `task-${stamp}-${i}`,
    title: t.title,
    notes: t.description
      ? `${t.description}\n\n(Starter ${label.toLowerCase()} milestone — edit freely or regenerate with AI in the Timeline tab.)`
      : `Starter ${label.toLowerCase()} milestone — edit freely or regenerate with AI in the Timeline tab.`,
    dueDate: t.dueDate,
    priority: t.priority || 'medium',
    category: t.category || 'logistics',
    phase: derivePhase(t.dueDate, date),
    completed: false,
  }));
}
