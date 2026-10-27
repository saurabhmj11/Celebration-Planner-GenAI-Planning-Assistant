import Link from 'next/link';
import { Home, SearchX } from 'lucide-react';

/**
 * 404 page — the planner is a single-page client app, so any stray URL
 * (old bookmark, mistyped share link) lands here with a friendly way back.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <div className="mx-auto w-fit rounded-2xl bg-brand-50 p-3 text-brand-600">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-slate-900">
          Page not found
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          There&apos;s nothing at this address — the celebration command
          center lives at the home page.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          Back to the Planner
        </Link>
      </div>
    </div>
  );
}
