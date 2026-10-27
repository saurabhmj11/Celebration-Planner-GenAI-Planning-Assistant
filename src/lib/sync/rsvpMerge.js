/**
 * Pure RSVP-merge engine — folds public-portal responses into the host's
 * local guest list.
 *
 * Environment-free (no React, no fetch) so it runs in bun tests and the
 * browser alike. Merge rules:
 *  - a response keyed to an existing guest id  -> updates rsvp/plus-ones/meal
 *    with a dated "[Public RSVP]" provenance note (existing notes kept)
 *  - a response flagged isNewGuest             -> appended as a new guest in
 *    the 'rsvp' group
 *  - anything else (guest deleted by the host) -> skipped and reported
 *
 * The result is a NEW event-shaped object — EventContext's history engine
 * records it as one undoable step.
 */
import { makeId } from "../../utils/ids";

const ATTENDING = new Set(["attending", "maybe", "declined"]);

const clampPlusOnes = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
};

const clean = (v, max) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * @returns {{
 *   guests: Array<object>,
 *   summary: { imported: number, updated: number, added: number, skipped: number,
 *              confirmed: number, declined: number, tentative: number },
 *   changes: Array<{ name: string, rsvp: string, plusOnes: number, isNew: boolean }>,
 * }}
 */
export function mergeRsvpResponses(localEvent, responses) {
  const guests = Array.isArray(localEvent?.guests)
    ? localEvent.guests.map((g) => ({ ...g }))
    : [];
  const byId = new Map(guests.map((g) => [g.id, g]));

  const today = new Date().toISOString().slice(0, 10);
  const summary = {
    imported: 0,
    updated: 0,
    added: 0,
    skipped: 0,
    confirmed: 0,
    declined: 0,
    tentative: 0,
  };
  const changes = [];

  const list = Array.isArray(responses) ? responses : [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const attending = ATTENDING.has(r.attending) ? r.attending : "maybe";
    const plusOnes = clampPlusOnes(r.plusOnes);
    const stampDate =
      typeof r.submittedAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.submittedAt)
        ? r.submittedAt.slice(0, 10)
        : today;
    const stamp = `[Public RSVP ${stampDate}]`;
    const note = clean(r.note, 400);

    if (r.guestKey && byId.has(r.guestKey)) {
      const prev = byId.get(r.guestKey);
      const next = {
        ...prev,
        rsvp: attending,
        plusOnes,
        meal: clean(r.meal, 40) || prev.meal || "standard",
      };
      const provenance = note ? `${stamp} ${note}` : `${stamp} Responded on the public RSVP page.`;
      next.notes = prev.notes ? `${provenance} — ${prev.notes}` : provenance;
      const idx = guests.findIndex((g) => g.id === prev.id);
      if (idx >= 0) guests[idx] = next;
      byId.set(next.id, next);
      summary.updated += 1;
      if (prev.rsvp !== attending || prev.plusOnes !== plusOnes || next.meal !== prev.meal) {
        changes.push({ name: next.name, rsvp: attending, plusOnes, isNew: false });
      }
    } else if (r.isNewGuest) {
      const name = clean(r.name, 80);
      if (!name || name.length < 2) {
        summary.skipped += 1;
        continue;
      }
      const guest = {
        id: makeId("guest"),
        name,
        email: "",
        phone: "",
        group: "rsvp",
        rsvp: attending,
        plusOnes,
        meal: clean(r.meal, 40) || "standard",
        notes: note ? `${stamp} ${note}` : `${stamp} Added via the public RSVP page.`,
      };
      guests.push(guest);
      byId.set(guest.id, guest);
      summary.added += 1;
      changes.push({ name, rsvp: attending, plusOnes, isNew: true });
    } else {
      // Response for a guest the host removed — never resurrect them.
      summary.skipped += 1;
    }

    summary.imported += 1;
    if (attending === "attending") summary.confirmed += 1;
    else if (attending === "declined") summary.declined += 1;
    else summary.tentative += 1;
  }

  return { guests, summary, changes };
}

/** Human toast line: "2 confirmed · 1 declined · 1 new guest added". */
export function rsvpSummaryText(summary) {
  if (!summary || summary.imported === 0) return "No new responses.";
  const parts = [];
  if (summary.confirmed > 0) parts.push(`${summary.confirmed} confirmed`);
  if (summary.tentative > 0) parts.push(`${summary.tentative} tentative`);
  if (summary.declined > 0) parts.push(`${summary.declined} declined`);
  if (summary.added > 0) parts.push(`${summary.added} new guest${summary.added === 1 ? "" : "s"} added`);
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped (removed guest)`);
  if (parts.length === 0) parts.push(`${summary.updated} guest${summary.updated === 1 ? "" : "s"} updated`);
  return `RSVP import: ${parts.join(" · ")}.`;
}
