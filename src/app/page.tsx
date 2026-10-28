'use client';

import dynamic from 'next/dynamic';

/**
 * Celebration & Event Planner — GenAI planning command center.
 *
 * The planner is a rich client-side application (localStorage persistence,
 * live countdowns, canvas-confetti), so it is mounted as a client-only
 * component to keep it decoupled from SSR and avoid hydration mismatches.
 */
const PlannerApp = dynamic(() => import('@/components/PlannerApp'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-rose-500 p-0.5 shadow-lg shadow-brand-500/20 animate-pulse-subtle">
        <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-2xl">
          ✨
        </div>
      </div>
      <div className="text-center">
        <p className="font-display font-extrabold text-lg text-slate-900">
          Celebration &amp; Event Planner
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Preparing your GenAI planning command center…
        </p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <PlannerApp />;
}
