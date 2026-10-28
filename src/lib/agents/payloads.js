/**
 * Pure payload builders for the Agent Force.
 *
 * Each builder compresses the live event into the small, validated context
 * its assist task needs (see src/lib/validation/assistSchemas.ts). Pure
 * functions = unit-testable without React, and the hook stays a thin shell.
 */

import { calculateTimelineStats, calculateVendorStats, calculateGuestStats } from '../../utils/calculator';

const todayStr = () => new Date().toISOString().slice(0, 10);

function daysUntil(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 30;
  const target = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

const EVENT_TYPE_ENUM = ['wedding', 'birthday', 'community', 'anniversary', 'gala', 'babyshower', 'other'];
const safeEventType = (t) => (EVENT_TYPE_ENUM.includes(t) ? t : 'other');

/** Attending-only, trimmed guest cards the seating agent reasons about. */
export function buildSeatingPayload(event) {
  const tables = (Array.isArray(event?.seating?.tables) ? event.seating.tables : [])
    .filter((t) => t && t.id)
    .slice(0, 30)
    .map((t) => ({
      id: String(t.id).slice(0, 60),
      name: String(t.name || 'Table').slice(0, 60),
      capacity: Math.max(1, Math.min(50, Math.round(Number(t.capacity) || 8))),
    }));

  const guests = (Array.isArray(event?.guests) ? event.guests : [])
    .filter((g) => g && g.id && g.rsvp === 'attending')
    .slice(0, 150)
    .map((g) => ({
      id: String(g.id).slice(0, 60),
      name: String(g.name || '').slice(0, 80),
      group: String(g.group || 'friends').slice(0, 40),
      plusOnes: Math.max(0, Math.min(10, Number(g.plusOnes) || 0)),
      meal: String(g.meal || 'standard').slice(0, 30),
      notes: String(g.notes || '').slice(0, 120),
    }));

  return {
    eventType: safeEventType(event?.type),
    tables,
    guests,
  };
}

/** Booked vendors + money context for the payment agent. */
export function buildPaymentsPayload(event) {
  const vendors = (Array.isArray(event?.vendors) ? event.vendors : [])
    .slice(0, 30)
    .map((v) => ({
      name: String(v?.name || '').slice(0, 80),
      category: String(v?.category || 'other').slice(0, 40),
      cost: Math.max(0, Math.round(Number(v?.cost) || 0)),
      status: String(v?.status || 'researching').slice(0, 30),
    }));

  return {
    eventType: safeEventType(event?.type),
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(event?.date) ? event.date : todayStr(),
    today: todayStr(),
    totalBudget: Math.max(0, Math.round(Number(event?.budget) || 0)),
    vendors,
  };
}

/** Day-of context for the run-sheet agent. */
export function buildRunSheetPayload(event) {
  const vendorStats = calculateVendorStats(event?.vendors);
  const vendors = (Array.isArray(event?.vendors) ? event.vendors : [])
    .filter((v) => v && (v.status === 'booked' || v.status === 'deposit_paid'))
    .slice(0, 15)
    .map((v) => `${String(v.name || '').slice(0, 60)} (${String(v.category || '').slice(0, 30)})`);

  const highlights = (Array.isArray(event?.tasks) ? event.tasks : [])
    .filter((t) => t && !t.completed && t.title)
    .slice(0, 8)
    .map((t) => String(t.title).slice(0, 90));

  return {
    eventType: safeEventType(event?.type),
    eventTitle: String(event?.title || 'Your celebration').slice(0, 120),
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(event?.date) ? event.date : todayStr(),
    eventTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(event?.time) ? event.time : '17:00',
    durationHours: 6,
    venueName: String(event?.location || '').slice(0, 160),
    guestCount: Math.max(0, Number(event?.guestCount) || 0),
    vendorCount: vendorStats.bookedCount,
    vendors,
    highlights,
  };
}

/** Whole-plan snapshot for the audit agent (mirrors the PlanReview payload). */
export function buildAuditPayload(event) {
  const taskStats = calculateTimelineStats(event?.tasks);
  const vendorStats = calculateVendorStats(event?.vendors);
  const guestStats = calculateGuestStats(event?.guests);
  const spent = (Array.isArray(event?.expenses) ? event.expenses : []).reduce(
    (s, e) => s + Math.max(0, Number(e?.spent) || 0),
    0
  );

  const upcomingTasks = (Array.isArray(event?.tasks) ? event.tasks : [])
    .filter((t) => t && !t.completed)
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
    .slice(0, 5)
    .map((t) => ({
      title: String(t.title || '').slice(0, 160),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : undefined,
    }));

  const allCategories = new Set((Array.isArray(event?.vendors) ? event.vendors : []).map((v) => v?.category));
  const bookedCategories = new Set(
    (Array.isArray(event?.vendors) ? event.vendors : [])
      .filter((v) => v?.status === 'booked' || v?.status === 'deposit_paid')
      .map((v) => v?.category)
  );
  const unbooked = [...allCategories].filter(Boolean).filter((c) => !bookedCategories.has(c));

  return {
    eventType: safeEventType(event?.type),
    eventTitle: String(event?.title || 'Untitled celebration').slice(0, 120),
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(event?.date) ? event.date : todayStr(),
    daysUntilEvent: daysUntil(event?.date),
    totalBudget: Math.max(0, Math.round(Number(event?.budget) || 0)),
    spentSoFar: Math.max(0, Math.round(spent)),
    guestCount: Math.max(0, Number(event?.guestCount) || 0),
    taskStats: { total: taskStats.totalTasks, completed: taskStats.completedTasks },
    vendorStats: { total: vendorStats.totalVendors, booked: vendorStats.bookedCount },
    upcomingTasks,
    unbookedCategories: unbooked.map((c) => String(c).slice(0, 60)).slice(0, 20),
    guestStats: {
      total: guestStats.totalGuests,
      attending: guestStats.attendingHeadcount,
      pending: guestStats.pending,
    },
  };
}
