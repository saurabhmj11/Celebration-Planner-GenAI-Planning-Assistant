/**
 * Export utilities — guest-list CSV, iCalendar (.ics) generation, and
 * browser download helpers.
 *
 * Everything here is pure string work (safe in bun tests); only the
 * download* helpers touch the DOM, and they no-op gracefully when a
 * `document` is unavailable.
 */

/* ------------------------------------------------------------------ */
/* Guest CSV                                                           */
/* ------------------------------------------------------------------ */

export const GUEST_CSV_COLUMNS = [
  { key: 'name', header: 'Name', required: true },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  { key: 'group', header: 'Group' },
  { key: 'rsvp', header: 'RSVP' },
  { key: 'plusOnes', header: 'PlusOnes' },
  { key: 'meal', header: 'Meal' },
  { key: 'notes', header: 'Notes' },
];

const RSVP_ALIASES = {
  invited: 'invited', invited: 'invited', pending: 'invited', awaiting: 'invited',
  sent: 'invited', waiting: 'invited', 'no response': 'invited',
  attending: 'attending', yes: 'attending', confirmed: 'attending',
  coming: 'attending', accepted: 'attending',
  maybe: 'maybe', tentative: 'maybe', tbd: 'maybe', perhaps: 'maybe', unsure: 'maybe',
  declined: 'declined', no: 'declined', regrettably: 'declined', cannot: 'declined',
  rejected: 'declined', sorry: 'declined',
};

const GROUP_ALIASES = {
  family: 'family', relatives: 'family',
  friends: 'friends', friend: 'friends',
  colleagues: 'colleagues', work: 'colleagues', coworkers: 'colleagues', coworkers: 'colleagues',
  vip: 'vip', honored: 'vip', guestofhonor: 'vip',
  vendors: 'vendors', vendor: 'vendors', team: 'vendors',
};

const MEAL_ALIASES = {
  standard: 'standard', regular: 'standard', default: 'standard', chicken: 'standard', meat: 'standard',
  vegetarian: 'vegetarian', veg: 'vegetarian',
  vegan: 'vegan',
  'gluten-free': 'gluten-free', glutenfree: 'gluten-free', gf: 'gluten-free',
  kids: 'kids', kid: 'kids', children: 'kids',
  other: 'other', note: 'other',
};

/** Escape one CSV field (RFC-4180): quote when it contains , " or newline. */
function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialize a guest list to CSV. Always emits the canonical header row so
 * parseGuestsCsv() can round-trip exports back into guests.
 */
export function guestsToCsv(guests) {
  const safeGuests = Array.isArray(guests) ? guests : [];
  const header = GUEST_CSV_COLUMNS.map((c) => c.header).join(',');
  const rows = safeGuests.map((g) =>
    GUEST_CSV_COLUMNS.map((c) => csvEscape(g?.[c.key] ?? '')).join(',')
  );
  return [header, ...rows].join('\r\n');
}

/**
 * RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
 * doubled quotes, and CRLF/CR/LF line endings. Returns rows of strings.
 */
export function parseCsv(text) {
  const src = String(text ?? '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

/**
 * Parse pasted/uploaded guest CSV into validated guest objects.
 *
 * Tolerant by design: headers are matched case-insensitively, RSVP/Group/Meal
 * accept friendly aliases ("yes" → attending, "no" → declined, ...), and the
 * Name column is required. Rows that fail produce entries in `errors`
 * instead of aborting the import.
 *
 * @returns {{ guests: object[], skipped: number, errors: string[] }}
 */
export function parseGuestsCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { guests: [], skipped: 0, errors: ['The CSV is empty.'] };

  const headerMap = rows[0].map((h) => h.trim().toLowerCase());
  const colIdx = {};
  GUEST_CSV_COLUMNS.forEach((c) => {
    const idx = headerMap.indexOf(c.header.toLowerCase());
    if (idx >= 0) colIdx[c.key] = idx;
  });

  if (colIdx.name === undefined) {
    return { guests: [], skipped: Math.max(0, rows.length - 1), errors: ['Missing a "Name" column in the header row.'] };
  }

  const guests = [];
  const errors = [];
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const at = (key) => (colIdx[key] !== undefined ? String(cells[colIdx[key]] ?? '').trim() : '');

    const name = at('name').slice(0, 200);
    if (!name) {
      skipped++;
      if (errors.length < 5) errors.push(`Row ${r + 1}: skipped — no name.`);
      continue;
    }

    const rsvpRaw = at('rsvp').toLowerCase().replace(/[\s_-]/g, '');
    const groupRaw = at('group').toLowerCase().replace(/[\s_-]/g, '');
    const mealRaw = at('meal').toLowerCase().replace(/[\s_-]/g, '');
    const plusOnesNum = Number(at('plusOnes'));

    guests.push({
      name,
      email: at('email').slice(0, 200),
      phone: at('phone').slice(0, 60),
      group: GROUP_ALIASES[groupRaw] || 'friends',
      rsvp: RSVP_ALIASES[rsvpRaw] || 'invited',
      plusOnes: Number.isFinite(plusOnesNum) ? Math.max(0, Math.min(10, Math.round(plusOnesNum))) : 0,
      meal: MEAL_ALIASES[mealRaw] || 'standard',
      notes: at('notes').slice(0, 500),
    });
  }

  return { guests, skipped, errors };
}

/* ------------------------------------------------------------------ */
/* iCalendar (.ics)                                                    */
/* ------------------------------------------------------------------ */

/** Escape a text value per RFC 5545 (backslash, semicolon, comma, newline). */
function icsEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold long content lines at 74 chars (RFC 5545 §3.1) with CRLF + space. */
function icsFold(line) {
  if (line.length <= 74) return line;
  const parts = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  return parts.join('\r\n');
}

const icsDate = (dateStr) => dateStr.replace(/-/g, '');
const icsDateTime = (dateStr, timeStr = '00:00') =>
  `${dateStr.replace(/-/g, '')}T${(timeStr || '00:00').replace(':', '')}00`;

/** YYYY-MM-DD plus n days (calendar math; input validated by callers). */
function datePlusDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Build a complete .ics calendar for an event:
 *  - the celebration itself (timed when an event time exists, else all-day)
 *  - a separate RSVP-deadline all-day VEVENT with a 1-day-prior alarm
 *    (only when the deadline is still in the future)
 *
 * @param {object} event - { id, title, type, date, time, location, description, budget? }
 * @param {object} [opts] - { rsvpDeadline?: 'YYYY-MM-DD', now?: Date }
 */
export function buildIcsCalendar(event, { rsvpDeadline, now = new Date() } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Celebration & Event Planner//Guests & Invitations//EN',
    'CALSCALE:GREGORIAN',
  ];

  const safeId = String(event?.id || 'event').replace(/[^\w-]/g, '').slice(0, 60);
  const stamp = `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;

  const summary = icsEscape(event?.title || 'Celebration');
  const location = icsEscape(event?.location || '');
  const descParts = [];
  if (event?.description) descParts.push(String(event.description).slice(0, 400));
  if (event?.budget) descParts.push(`Budget: $${Math.round(Number(event.budget) || 0).toLocaleString('en-US')}`);
  if (rsvpDeadline) descParts.push(`RSVP by ${rsvpDeadline}`);
  const description = icsEscape(descParts.join(' — '));

  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(event?.date || '') ? event.date : null;

  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${safeId}-main@celebration-planner`);
  lines.push(`DTSTAMP:${stamp}`);
  if (dateStr) {
    if (event?.time && /^\d{2}:\d{2}$/.test(event.time)) {
      // Floating local time (no TZ) so the event shows at the planner's local hour.
      lines.push(`DTSTART:${icsDateTime(dateStr, event.time)}`);
      const end = new Date(`${dateStr}T${event.time}`);
      end.setHours(end.getHours() + 4);
      const endTime = `${String(end.getHours()).padStart(2, '0')}${String(end.getMinutes()).padStart(2, '0')}`;
      lines.push(`DTEND:${icsDateTime(end.toISOString().slice(0, 10), endTime)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(dateStr)}`);
      lines.push(`DTEND;VALUE=DATE:${icsDate(datePlusDays(dateStr, 1))}`);
    }
  }
  lines.push(`SUMMARY:${summary}`);
  if (location) lines.push(`LOCATION:${location}`);
  if (description) lines.push(`DESCRIPTION:${description}`);
  lines.push('END:VEVENT');

  // RSVP deadline as its own all-day event + reminder the day before at 9:00.
  if (rsvpDeadline && /^\d{4}-\d{2}-\d{2}$/.test(rsvpDeadline) && rsvpDeadline >= now.toISOString().slice(0, 10)) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${safeId}-rsvp@celebration-planner`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(rsvpDeadline)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(datePlusDays(rsvpDeadline, 1))}`);
    lines.push(`SUMMARY:${icsEscape(`RSVP deadline — ${event?.title || 'Celebration'}`)}`);
    lines.push(`DESCRIPTION:${icsEscape(`Final day to reply to "${event?.title || 'Celebration'}". Chase pending guests today!`)}`);
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT15H'); // 9:00 the previous morning for an all-day event
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${icsEscape(`RSVP deadline tomorrow for ${event?.title || 'your celebration'}`)}`);
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // Fold every content line, then join with the RFC-mandated CRLF.
  return lines.map(icsFold).join('\r\n');
}

/* ------------------------------------------------------------------ */
/* Browser download helpers (DOM-dependent, guarded)                   */
/* ------------------------------------------------------------------ */

/** Trigger a plain-text/file download. No-ops outside a browser. */
export function downloadTextFile(filename, content, mime = 'text/plain;charset=utf-8') {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Trigger a download of an existing data URL (e.g. a stored photo). */
export function downloadDataUrlFile(filename, dataUrl) {
  if (typeof document === 'undefined' || typeof dataUrl !== 'string') return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Slug a title into a filesystem-safe filename fragment. */
export function slugify(title, maxLen = 40) {
  return String(title || 'celebration')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen) || 'celebration';
}
