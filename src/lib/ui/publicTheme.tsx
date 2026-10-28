/**
 * Shared visual language for the guest-facing public portals (/rsvp/[token],
 * /album/[token]) — one palette map per event type so every host-shared page
 * feels like the celebration it belongs to. Server-safe: no client code.
 */
import type { ReactNode } from "react";
import { MailOpen } from "lucide-react";

export interface PublicPortalTheme {
  hero: string;
  chip: string;
  text: string;
}

export const PUBLIC_THEME_BY_TYPE: Record<string, PublicPortalTheme> = {
  wedding: {
    hero: "from-rose-500 via-rose-400 to-orange-300",
    chip: "bg-rose-100 text-rose-800 border-rose-200",
    text: "text-rose-50",
  },
  birthday: {
    hero: "from-violet-600 via-fuchsia-500 to-amber-400",
    chip: "bg-violet-100 text-violet-800 border-violet-200",
    text: "text-violet-50",
  },
  community: {
    hero: "from-emerald-600 via-teal-500 to-lime-400",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
    text: "text-emerald-50",
  },
  anniversary: {
    hero: "from-amber-500 via-orange-400 to-yellow-300",
    chip: "bg-amber-100 text-amber-900 border-amber-200",
    text: "text-amber-50",
  },
  gala: {
    hero: "from-indigo-700 via-violet-600 to-fuchsia-500",
    chip: "bg-indigo-100 text-indigo-800 border-indigo-200",
    text: "text-indigo-50",
  },
  babyshower: {
    hero: "from-pink-500 via-rose-400 to-sky-300",
    chip: "bg-pink-100 text-pink-800 border-pink-200",
    text: "text-pink-50",
  },
  other: {
    hero: "from-brand-600 via-fuchsia-500 to-amber-400",
    chip: "bg-brand-100 text-brand-800 border-brand-200",
    text: "text-brand-50",
  },
};

export function publicThemeFor(type: string): PublicPortalTheme {
  return PUBLIC_THEME_BY_TYPE[type] || PUBLIC_THEME_BY_TYPE.other;
}

/** Shared "this link isn't valid" card so both portals read identically. */
export function PublicInvalidLink({ children }: { children?: ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full text-center space-y-4 bg-white rounded-3xl border border-slate-200 shadow-xl p-10">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-100 text-rose-500">
          <MailOpen className="w-7 h-7" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold text-slate-800">This link isn&apos;t valid</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          {children ||
            "The celebration may have been unshared, or the link might be mistyped. Ask your host to resend it."}
        </p>
      </div>
    </main>
  );
}
