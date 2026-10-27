/**
 * Collision-proof id minting + corrupted-data repair helpers.
 *
 * Why this exists: `Date.now()` has only millisecond resolution, so any code
 * path that mints several ids inside one tick (bulk "Add Selected" loops,
 * double submits, rapid programmatic adds) produced IDENTICAL ids like
 * `task-1793034912847`. Duplicate ids broke React list keys and made
 * toggle/delete/update act on every duplicate at once.
 *
 * makeId() layers a process-lifetime monotonic counter on top of the
 * timestamp, so every call returns a unique id — even thousands of times
 * within the same millisecond.
 */

let lastStamp = 0;
let counter = 0;

/**
 * Mint a unique id like `task-1793034912847-3`.
 * Safe to call in tight loops, bulk actions and rapid successive events.
 */
export function makeId(prefix = 'id') {
  const now = Date.now();
  if (now !== lastStamp) {
    lastStamp = now;
    counter = 0;
  } else {
    counter += 1;
  }
  return `${prefix}-${now}-${counter}`;
}

/**
 * Keep the first occurrence of each id and drop later duplicates.
 * Items that lost their id entirely get a fresh unique one (they are kept —
 * losing an id is not the same as being a duplicate). Non-objects are
 * dropped. Never mutates the input.
 */
export function dedupeById(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    let entry = item;
    if (!entry.id) {
      entry = { ...entry, id: makeId('item') };
    }
    if (seen.has(entry.id)) continue; // duplicate — keep the first, drop the rest
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

/** True when any item is missing an id, is not an object, or repeats an id. */
function needsRepair(list) {
  if (!Array.isArray(list)) return false;
  const seen = new Set();
  for (const item of list) {
    if (!item || typeof item !== 'object') return true;
    if (!item.id || seen.has(item.id)) return true;
    seen.add(item.id);
  }
  return false;
}

/**
 * Repair one event's collections (tasks / vendors / expenses / guests /
 * photos) so every item carries a unique id. Heals data written by the old
 * `task-${Date.now()}` bug — e.g. a timeline holding two
 * `task-1793034912847` entries collapses back to one. Clean events are
 * returned untouched (same reference), so referential equality/renders stay
 * stable for healthy data.
 */
export function sanitizeEvent(event) {
  if (!event || typeof event !== 'object') return event;
  const dirty =
    needsRepair(event.tasks) ||
    needsRepair(event.vendors) ||
    needsRepair(event.expenses) ||
    needsRepair(event.guests) ||
    needsRepair(event.photos);
  if (!dirty) return event;
  return {
    ...event,
    tasks: dedupeById(event.tasks),
    vendors: dedupeById(event.vendors),
    expenses: dedupeById(event.expenses),
    guests: dedupeById(event.guests),
    photos: dedupeById(event.photos),
  };
}

/** Sanitize a whole list of events (as loaded from storage or imported). */
export function sanitizeEvents(events) {
  if (!Array.isArray(events)) return events;
  return events.map(sanitizeEvent);
}
