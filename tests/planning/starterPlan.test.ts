import { describe, expect, test } from 'bun:test';
import { buildStarterTasks } from '../../src/lib/planning/starterPlan';

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const PHASES = ['early', 'mid', 'final', 'day_of', 'post'];

describe('buildStarterTasks — type-aware starter timelines', () => {
  test('seeds wedding-specific milestones for a wedding 180+ days out', () => {
    const tasks = buildStarterTasks({ type: 'wedding', date: addDays(200) });
    expect(tasks.length).toBeGreaterThan(5);
    expect(tasks.some((t) => t.title.includes('Book the venue'))).toBe(true);
    expect(tasks.some((t) => t.title.includes('Marriage license'))).toBe(true);
  });

  test('seeds birthday-specific milestones for a birthday', () => {
    const tasks = buildStarterTasks({ type: 'birthday', date: addDays(30) });
    expect(tasks.some((t) => t.title.includes('Pick the theme'))).toBe(true);
    expect(tasks.some((t) => t.title.includes('Order the cake'))).toBe(true);
    expect(tasks.some((t) => t.notes.toLowerCase().includes('birthday'))).toBe(true); // notes mention the type
  });

  test('every event type now has a dedicated checklist; unknown types fall back to generic', () => {
    // The six real event types each get their own milestone checklist
    for (const [type, marker] of [
      ['anniversary', 'Reserve the venue or private dining room'],
      ['gala', 'Launch sponsorship packages'],
      ['babyshower', 'Set up the registry'],
    ]) {
      const tasks = buildStarterTasks({ type, date: addDays(60) });
      expect(tasks.some((t) => t.title.includes(marker))).toBe(true);
      expect(tasks.every((t) => t.title !== 'Set the date and lock the venue')).toBe(true); // NOT the generic fallback
    }
    // Unknown/other types still fall back safely
    const other = buildStarterTasks({ type: 'other', date: addDays(60) });
    expect(other.some((t) => t.title.includes('Set the date and lock the venue'))).toBe(true);
  });

  test('every task is app-shaped: unique id, valid priority/category/phase, not completed', () => {
    const tasks = buildStarterTasks({ type: 'community', date: addDays(70) });
    const ids = new Set(tasks.map((t) => t.id));
    expect(ids.size).toBe(tasks.length);
    for (const t of tasks) {
      expect(typeof t.title).toBe('string');
      expect(t.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['high', 'medium', 'low']).toContain(t.priority);
      expect(typeof t.category).toBe('string');
      expect(PHASES).toContain(t.phase);
      expect(t.completed).toBe(false);
      expect(t.notes.length).toBeGreaterThan(0);
    }
  });

  test('dates are window-safe: never after the event date, never before today', () => {
    const eventDate = addDays(45);
    const tasks = buildStarterTasks({ type: 'wedding', date: eventDate });
    for (const t of tasks) {
      expect(t.dueDate <= eventDate).toBe(true);
      expect(t.dueDate >= todayStr()).toBe(true);
    }
  });

  test('compresses long templates into short runways', () => {
    const tasks = buildStarterTasks({ type: 'wedding', date: addDays(10) });
    // 9 wedding milestones compressed into a 10-day runway — none land in the past or after the event
    expect(tasks.length).toBe(9);
    for (const t of tasks) {
      expect(t.dueDate >= todayStr()).toBe(true);
      expect(t.dueDate <= addDays(10)).toBe(true);
    }
  });

  test('no date — no seeded tasks (caller guards, builder is safe anyway)', () => {
    expect(buildStarterTasks({ type: 'wedding', date: '' })).toEqual([]);
    expect(buildStarterTasks({})).toEqual([]);
  });

  test('tasks are sorted by due date so the timeline reads top-down', () => {
    const tasks = buildStarterTasks({ type: 'community', date: addDays(120) });
    const dates = tasks.map((t) => t.dueDate);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });
});
