/**
 * Guest CSV + iCalendar (.ics) export/import contract tests.
 *
 * These utilities power the Guests tab: CSV round-trips the guest list
 * (export → edit in a spreadsheet → paste import), and the .ics file puts
 * the celebration + RSVP-deadline reminder on the user's calendar.
 * Everything here is pure string math — bun-testable with no DOM.
 */
import { describe, expect, test } from "bun:test";
import {
  GUEST_CSV_COLUMNS,
  guestsToCsv,
  parseCsv,
  parseGuestsCsv,
  buildIcsCalendar,
  slugify,
} from "../../src/utils/exporters";

/* ------------------------------------------------------------------ */
/* CSV serialization & parsing                                         */
/* ------------------------------------------------------------------ */

const baseGuest = {
  name: "Eleanor Vance",
  email: "eleanor.vance@email.com",
  phone: "(415) 555-0182",
  group: "family",
  rsvp: "attending",
  plusOnes: 2,
  meal: "vegetarian",
  notes: "Aisle-side seat",
};

describe("guestsToCsv", () => {
  test("emits the canonical header row always", () => {
    const csv = guestsToCsv([]);
    expect(csv.split("\r\n")[0]).toBe("Name,Email,Phone,Group,RSVP,PlusOnes,Meal,Notes");
  });

  test("serializes all canonical columns for each guest", () => {
    const csv = guestsToCsv([baseGuest]);
    const rows = csv.split("\r\n");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain("Eleanor Vance");
    expect(rows[1]).toContain("vegetarian");
    expect(rows[1]).toContain("2");
  });

  test("quotes fields containing commas, quotes and newlines (RFC 4180)", () => {
    const tricky = {
      ...baseGuest,
      name: 'The "Hendersons", Family of four',
      notes: "row1\nrow2",
    };
    const csv = guestsToCsv([tricky]);
    const parsed = parseGuestsCsv(csv);
    expect(parsed.guests).toHaveLength(1);
    expect(parsed.guests[0].name).toBe('The "Hendersons", Family of four');
    expect(parsed.guests[0].notes).toBe("row1\nrow2");
  });

  test("guards against non-array input", () => {
    expect(guestsToCsv(null)).toBe("Name,Email,Phone,Group,RSVP,PlusOnes,Meal,Notes");
    expect(guestsToCsv(undefined)).toContain("Name");
  });
});

describe("parseCsv", () => {
  test("parses quoted fields with embedded separators and doubled quotes", () => {
    const rows = parseCsv('a,"b,c","say ""hi"""\r\n1,"2\n3",x');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["a", "b,c", 'say "hi"']);
    expect(rows[1]).toEqual(["1", "2\n3", "x"]);
  });

  test("handles CR, LF and CRLF line endings and skips blank lines", () => {
    const rows = parseCsv("a,b\nc,d\r\ne,f\r");
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
  });
});

describe("parseGuestsCsv", () => {
  test("round-trips a guestsToCsv export back into guests", () => {
    const exported = guestsToCsv([baseGuest, { ...baseGuest, name: "Marco Rossi", rsvp: "declined" }]);
    const { guests, errors, skipped } = parseGuestsCsv(exported);
    expect(errors).toHaveLength(0);
    expect(skipped).toBe(0);
    expect(guests).toHaveLength(2);
    expect(guests[0].name).toBe("Eleanor Vance");
    expect(guests[0].rsvp).toBe("attending");
    expect(guests[0].plusOnes).toBe(2);
    expect(guests[0].group).toBe("family");
  });

  test("accepts friendly RSVP aliases (yes/no/maybe/confirmed…)", () => {
    const csv = "Name,RSVP\nA,yes\nB,no\nC,tentative\nD,awaiting\nE,coming";
    const { guests } = parseGuestsCsv(csv);
    expect(guests.map((g) => g.rsvp)).toEqual([
      "attending",
      "declined",
      "maybe",
      "invited",
      "attending",
    ]);
  });

  test("accepts meal + group aliases and defaults unknowns safely", () => {
    const csv = "Name,Meal,Group\nA,veg,relatives\nB,gf,coworkers\nC,lobster,space";
    const { guests } = parseGuestsCsv(csv);
    expect(guests[0].meal).toBe("vegetarian");
    expect(guests[0].group).toBe("family");
    expect(guests[1].meal).toBe("gluten-free");
    expect(guests[1].group).toBe("colleagues");
    // Unknown values fall back to safe defaults, never crash the import.
    expect(guests[2].meal).toBe("standard");
    expect(guests[2].group).toBe("friends");
  });

  test("clamps plus-ones into the 0-10 range", () => {
    const csv = "Name,PlusOnes\nA,3\nB,99\nC,-4\nD,not-a-number";
    const { guests } = parseGuestsCsv(csv);
    expect(guests.map((g) => g.plusOnes)).toEqual([3, 10, 0, 0]);
  });

  test("errors when the Name column is missing entirely", () => {
    const { guests, errors } = parseGuestsCsv("Email,Phone\na@b.com,555");
    expect(guests).toHaveLength(0);
    expect(errors[0]).toContain("Name");
  });

  test("skips blank-name rows and reports them instead of aborting", () => {
    const csv = "Name,Email\n,Eleanor A.\nMarco,m@b.com\n,Someone";
    const { guests, skipped } = parseGuestsCsv(csv);
    expect(guests).toHaveLength(1);
    expect(guests[0].name).toBe("Marco");
    expect(skipped).toBe(2);
  });

  test("matches headers case-insensitively and tolerates extra columns", () => {
    const csv = "name,EMAIL,EXTRA\nSomeone,s@b.com,ignored";
    const { guests, errors } = parseGuestsCsv(csv);
    expect(errors).toHaveLength(0);
    expect(guests[0].email).toBe("s@b.com");
  });

  test("handles an empty input", () => {
    const { guests, errors } = parseGuestsCsv("");
    expect(guests).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  test("GUEST_CSV_COLUMNS keys match the guest model fields", () => {
    expect(GUEST_CSV_COLUMNS.map((c) => c.key)).toEqual([
      "name",
      "email",
      "phone",
      "group",
      "rsvp",
      "plusOnes",
      "meal",
      "notes",
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* iCalendar (.ics)                                                     */
/* ------------------------------------------------------------------ */

const calEvent = {
  id: "event-wedding-01",
  title: "Sophia & Liam's Vineyard Wedding",
  type: "wedding",
  date: "2026-11-21",
  time: "16:00",
  location: "Vista Winery Terrace, Napa Valley",
  description: "Vineyard vows at golden hour",
  budget: 25000,
};

describe("buildIcsCalendar", () => {
  const NOW = new Date("2026-10-27T00:00:00Z");
  const nowIsoDate = "2026-10-27";

  /** RFC 5545 §3.1: unfold continuation lines (CRLF + space) before asserting on content. */
  const unfold = (ics: string) => ics.replace(/\r\n /g, "");

  test("builds a valid VCALENDAR with CRLF line endings", () => {
    const ics = buildIcsCalendar(calEvent, { now: NOW });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("CALSCALE:GREGORIAN");
    expect(ics).not.toMatch(/(^|[^\r])\n/); // every newline is CRLF
  });

  test("timed events become floating local DTSTART/DTEND with a 4h block", () => {
    const ics = buildIcsCalendar(calEvent, { now: NOW });
    expect(ics).toContain("DTSTART:20261121T160000");
    expect(ics).toMatch(/DTEND:20261121T\d{6}/);
    expect(ics).not.toContain("DTSTART;VALUE=DATE");
  });

  test("all-day events use VALUE=DATE and a next-day DTEND", () => {
    const ics = buildIcsCalendar({ ...calEvent, time: "" }, { now: NOW });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261121");
    expect(ics).toContain("DTEND;VALUE=DATE:20261122");
  });

  test("escapes RFC 5545 special characters in text values", () => {
    const ics = buildIcsCalendar(
      { ...calEvent, title: "A;B,C\\D", location: "X;Y" },
      { now: NOW }
    );
    expect(ics).toContain("SUMMARY:A\\;B\\,C\\\\D");
    expect(ics).toContain("LOCATION:X\\;Y");
  });

  test("folds long content lines at 74 chars (RFC 5545 §3.1)", () => {
    const ics = buildIcsCalendar(calEvent, { now: NOW });
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75); // folded continuation lines start with 1 space
    }
  });

  test("embeds an RSVP-deadline VEVENT with a day-prior alarm when in the future", () => {
    const ics = buildIcsCalendar(calEvent, { rsvpDeadline: "2026-11-01", now: NOW });
    expect(unfold(ics)).toContain("RSVP deadline — Sophia & Liam's Vineyard Wedding");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT15H");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261101");
  });

  test("omits the RSVP VEVENT once the deadline has passed", () => {
    const ics = buildIcsCalendar(calEvent, { rsvpDeadline: "2026-10-01", now: NOW });
    expect(ics).not.toContain("RSVP deadline");
    expect(ics).not.toContain("VALARM");
  });

  test("omits the RSVP VEVENT for malformed deadlines", () => {
    const ics = buildIcsCalendar(calEvent, { rsvpDeadline: "not-a-date", now: NOW });
    expect(ics).not.toContain("VALARM");
  });

  test("mentions the RSVP date inside the main event description", () => {
    const ics = buildIcsCalendar(calEvent, { rsvpDeadline: "2026-11-01", now: NOW });
    expect(unfold(ics)).toContain("RSVP by 2026-11-01");
  });

  test("degrades gracefully for events without a date", () => {
    const ics = buildIcsCalendar({ ...calEvent, date: "" }, { now: NOW });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:");
    expect(ics).not.toContain("DTSTART");
  });

  test("sanitizes the UID against unsafe characters", () => {
    const ics = buildIcsCalendar({ ...calEvent, id: "weird id/with@chars!" }, { now: NOW });
    expect(ics).toContain("UID:weirdidwithchars-main@celebration-planner");
  });
});

describe("slugify", () => {
  test("produces filesystem-safe fragments", () => {
    expect(slugify("Sophia & Liam's Wedding!")).toBe("sophia-liam-s-wedding");
    expect(slugify("  Ünïcödé Café  ")).toBe("n-c-d-caf");
    expect(slugify("")).toBe("celebration");
    expect(slugify("!!!", 10)).toBe("celebration");
  });

  test("respects the max length cap", () => {
    expect(slugify("a-very-long-celebration-title-that-keeps-going", 20).length).toBeLessThanOrEqual(20);
  });
});
