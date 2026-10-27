import { db } from "@/lib/db";
import { parseSnapshotJson } from "@/lib/sync/handlers";
import { isRsvpClosed } from "@/lib/rsvp/handlers";
import { RsvpForm } from "./RsvpForm";
import { Calendar, Clock, MapPin, MailOpen, Heart } from "lucide-react";

/**
 * Public RSVP portal (GAP 1) — /rsvp/[token].
 *
 * Server-rendered from the cloud snapshot: guests only need the unguessable
 * link (no account, no app). The page reads the SAVED invitation copy, shows
 * the RSVP deadline, and hands off to the client form island for name lookup
 * + response submission. The guest list itself is never rendered — only the
 * host-side lookup API answers name queries.
 */

export const dynamic = "force-dynamic";

const THEME_BY_TYPE: Record<string, { hero: string; chip: string; text: string }> = {
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

function InvalidLink() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full text-center space-y-4 bg-white rounded-3xl border border-slate-200 shadow-xl p-10">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-100 text-rose-500">
          <MailOpen className="w-7 h-7" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold text-slate-800">This RSVP link isn&apos;t valid</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          The celebration may have been unshared, or the link might be mistyped. Ask your host to
          resend the invitation with a fresh link.
        </p>
      </div>
    </main>
  );
}

export default async function RsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const row = await db.syncedEvent
    .findUnique({ where: { rsvpToken: token } })
    .catch(() => null);

  if (!row) return <InvalidLink />;

  const snapshot = parseSnapshotJson(row.snapshot);
  if (!snapshot) return <InvalidLink />;

  const respondedCount = await db.rsvpResponse
    .count({ where: { eventId: row.id } })
    .catch(() => 0);

  const type = typeof snapshot.type === "string" ? snapshot.type : "other";
  const theme = THEME_BY_TYPE[type] || THEME_BY_TYPE.other;
  const title = typeof snapshot.title === "string" ? snapshot.title : "A celebration";
  const date = typeof snapshot.date === "string" ? snapshot.date : "";
  const time = typeof snapshot.time === "string" ? snapshot.time : "";
  const location = typeof snapshot.location === "string" ? snapshot.location : "";
  const description = typeof snapshot.description === "string" ? snapshot.description : "";
  const invitation =
    typeof snapshot.invitation === "object" && snapshot.invitation !== null
      ? (snapshot.invitation as Record<string, unknown>)
      : {};
  const headline = typeof invitation.headline === "string" ? invitation.headline : "";
  const message = typeof invitation.message === "string" ? invitation.message : description;
  const signOff = typeof invitation.signOff === "string" ? invitation.signOff : "";
  const deadline = typeof invitation.rsvpDeadline === "string" ? invitation.rsvpDeadline : "";
  const guestCount = Array.isArray(snapshot.guests) ? snapshot.guests.length : 0;

  const today = new Date().toISOString().slice(0, 10);
  const closed = isRsvpClosed(snapshot, today);

  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Date to be announced";

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      {/* Hero */}
      <div className={`bg-gradient-to-br ${theme.hero} text-white`}>
        <div className="max-w-2xl mx-auto px-6 py-14 text-center">
          <p className={`text-[11px] font-bold uppercase tracking-[0.35em] ${theme.text} drop-shadow-sm`}>
            You are invited
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-4 leading-snug drop-shadow-md">
            {headline || title}
          </h1>
          {signOff && <p className="mt-3 text-sm text-white/85">{signOff}</p>}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-3 py-1.5 backdrop-blur-sm">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              {dateLabel}
            </span>
            {time && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-3 py-1.5 backdrop-blur-sm">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                {time}
              </span>
            )}
            {location && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-3 py-1.5 backdrop-blur-sm">
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                {location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-6 -mt-8">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
          {message && (
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line text-center">
              {message}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold">
            {deadline && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${theme.chip}`}>
                <Calendar className="w-3 h-3" aria-hidden="true" />
                Kindly RSVP by {deadline}
              </span>
            )}
            {guestCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
                <Heart className="w-3 h-3" aria-hidden="true" />
                {respondedCount} of {guestCount} invited guests have responded
              </span>
            )}
          </div>

          <RsvpForm
            token={token}
            closed={closed}
            deadline={deadline}
            eventTitle={title}
          />
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Hosted with Celebration Planner — plans, guests &amp; budgets in one joyful place.
        </p>
      </div>
    </main>
  );
}
