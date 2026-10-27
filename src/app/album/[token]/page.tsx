import { db } from "@/lib/db";
import { publicThemeFor, PublicInvalidLink } from "@/lib/ui/publicTheme";
import { ALBUM_MAX_PHOTOS_PER_EVENT } from "@/lib/validation/syncSchemas";
import { AlbumUploader } from "./AlbumUploader";
import { Calendar, Images, Users } from "lucide-react";

/**
 * Public guest photo album (GAP 3) — /album/[token].
 *
 * Guests land here from the host's shared link or QR: they see the celebration
 * card (title/date from the cloud snapshot), the guest-shared gallery, and an
 * upload form that optimizes photos in the browser (720px JPEG via the same
 * canvas pipeline the app uses) before sending them to the cloud. The host
 * imports shared photos into the on-device memory wall from the Photos tab.
 */

export const dynamic = "force-dynamic";

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const row = await db.syncedEvent
    .findUnique({ where: { albumToken: token } })
    .catch(() => null);

  if (!row) {
    return (
      <PublicInvalidLink>
        The photo album may have been unshared, or the link might be mistyped. Ask
        your host to resend it.
      </PublicInvalidLink>
    );
  }

  const count = await db.guestPhoto
    .count({ where: { eventId: row.id } })
    .catch(() => 0);

  const type = row.eventType || "other";
  const theme = publicThemeFor(type);
  const title = row.title || "A celebration";
  const date = row.eventDate || "";

  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      {/* Hero */}
      <div className={`bg-gradient-to-br ${theme.hero} text-white`}>
        <div className="max-w-3xl mx-auto px-6 py-14 text-center">
          <p
            className={`text-[11px] font-bold uppercase tracking-[0.35em] ${theme.text} drop-shadow-sm`}
          >
            Shared photo album
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-4 leading-snug drop-shadow-md">
            {title}
          </h1>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
            {dateLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-3 py-1.5 backdrop-blur-sm">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                {dateLabel}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-3 py-1.5 backdrop-blur-sm">
              <Images className="w-3.5 h-3.5" aria-hidden="true" />
              {count} of {ALBUM_MAX_PHOTOS_PER_EVENT} photos shared
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-3 py-1.5 backdrop-blur-sm">
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              Everyone with this link can add memories
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 -mt-8">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl p-6 sm:p-8">
          <AlbumUploader token={token} eventTitle={title} />
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Photos are optimized in your browser before upload · Hosted with
          Celebration Planner
        </p>
      </div>
    </main>
  );
}
