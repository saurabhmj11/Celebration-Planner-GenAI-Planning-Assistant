/**
 * Agent Force registry — the app's AI workforce definition.
 *
 * An agent is a thin, declarative descriptor; all orchestration lives in
 * src/hooks/useAgentForce.js. Keeping this pure makes the roster
 * unit-testable and lets the panel render straight from data.
 */

export const AGENT_IDS = ['seating', 'payments', 'runsheet', 'audit'];

export const AGENTS = [
  {
    id: 'seating',
    name: 'Seating Strategist',
    icon: '🪑',
    accent: 'from-indigo-500 to-violet-600',
    role: 'Seats every confirmed party',
    description:
      'Reads the live RSVP list and arranges attending guests (plus-ones included) into your tables — families and friend circles kept together, capacity never exceeded.',
    deliverable: 'Seating chart assignments',
    assistTask: 'seating-plan',
    viewTab: 'dayof',
    viewLabel: 'View seating chart',
  },
  {
    id: 'payments',
    name: 'Payment Controller',
    icon: '💳',
    accent: 'from-emerald-500 to-teal-600',
    role: 'Builds the payment schedule',
    description:
      'Turns booked vendors and contract costs into a deposit/balance ledger with due dates anchored to your event date — nothing slips to the last week.',
    deliverable: 'Payment milestones',
    assistTask: 'payment-schedule',
    viewTab: 'dayof',
    viewLabel: 'View payment ledger',
  },
  {
    id: 'runsheet',
    name: 'Day-Of Producer',
    icon: '🎬',
    accent: 'from-rose-500 to-orange-500',
    role: 'Writes the run sheet',
    description:
      'Produces a minute-by-minute day-of schedule from your venue, vendors and timeline — setup, doors, highlights and teardown, each line owned by a named role.',
    deliverable: 'Day-of run sheet',
    assistTask: 'run-sheet',
    viewTab: 'dayof',
    viewLabel: 'View run sheet',
  },
  {
    id: 'audit',
    name: 'Plan Auditor',
    icon: '🛡️',
    accent: 'from-amber-500 to-yellow-500',
    role: 'Audits the whole plan',
    description:
      'Scores real readiness against budget discipline, vendor lock-in, RSVP runway and task completion — then hands you the sharpest next actions.',
    deliverable: 'Readiness score + next actions',
    assistTask: 'plan-review',
    viewTab: 'dashboard',
    viewLabel: 'See the audit on the dashboard',
  },
];

export const agentById = (id) => AGENTS.find((a) => a.id === id) || null;
