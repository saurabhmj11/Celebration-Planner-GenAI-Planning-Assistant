/**
 * Seating-chart pure helpers.
 *
 * A "seat" is one guest entry, but a guest entry may represent a party:
 * Eleanor + 1 plus-one occupies TWO physical seats. Every capacity check
 * therefore uses seatWeight() = 1 + plusOnes (clamped 0-10, matching the
 * guest model), and chips render "Name +N" so the chart stays honest.
 */

/** Physical seats one guest entry occupies (1 + clamped plus-ones). */
export function seatWeight(guest) {
  const plusOnes = Math.max(0, Math.min(10, Number(guest?.plusOnes) || 0));
  return 1 + plusOnes;
}

/** Total physical seats a whole group of guest entries occupies. */
const groupWeight = (groupGuests) =>
  groupGuests.reduce((sum, g) => sum + seatWeight(g), 0);

const clampCapacity = (n) => Math.max(1, Math.min(50, Math.round(Number(n) || 0) || 8));

/**
 * Deterministic auto-arranger — the offline brain behind both the
 * "Auto-Arrange" button and the offline Seating Agent.
 *
 * Strategy (event-producer heuristics, stable + explainable):
 *  1. Only ATTENDING guests are seated (maybe/invited/declined wait).
 *  2. Groups (families, friend circles…) are never split while any single
 *     table can fit the whole group — each group lands on the table with
 *     the most free capacity, which naturally spreads circles across the
 *     room instead of stacking one full table next to an empty one.
 *  3. A group too large for ANY single table degrades gracefully: its
 *     guests are poured into free space one party at a time.
 *  4. Parties (a guest + their plus-ones) are atomic — never split.
 *  5. Guests that fit nowhere remain unseated (caller surfaces them).
 *
 * @param {Array} tables - [{ id, name, capacity }]
 * @param {Array} guests - guest entries with { id, group, rsvp, plusOnes }
 * @returns {{ tables: Array, unseatedIds: string[], groupsKeptTogether: number }}
 *   `tables` is a NEW array (input never mutated) with `seats: guestId[]`.
 */
export function autoArrangeTables(tables, guests) {
  const safeTables = (Array.isArray(tables) ? tables : [])
    .filter((t) => t && t.id)
    .map((t) => ({ ...t, capacity: clampCapacity(t.capacity), seats: [] }));

  const attending = (Array.isArray(guests) ? guests : [])
    .filter((g) => g && g.id && g.rsvp === 'attending');

  // Stable grouping: first-seen order of circles keeps results reproducible,
  // then larger groups claim their tables first (best-fit works better).
  // Ties on weight resolve by first-seen order — deterministic and intuitive.
  const groups = new Map();
  for (const g of attending) {
    const key = g.group || 'friends';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }
  const groupList = [...groups.values()].map((guests, order) => ({ guests, order }));
  groupList.sort(
    (a, b) => groupWeight(b.guests) - groupWeight(a.guests) || a.order - b.order
  );

  const seated = new Map(); // guestId -> table index
  let groupsKeptTogether = 0;

  const freeAt = (idx) => {
    const t = safeTables[idx];
    const used = t.seats.reduce((sum, id) => {
      const g = attending.find((x) => x.id === id);
      return sum + (g ? seatWeight(g) : 1);
    }, 0);
    return t.capacity - used;
  };

  for (const { guests: groupGuests } of groupList) {
    const weight = groupWeight(groupGuests);
    // Table with the MOST free space that still fits the whole group.
    let best = -1;
    for (let i = 0; i < safeTables.length; i++) {
      if (freeAt(i) >= weight && (best === -1 || freeAt(i) > freeAt(best))) best = i;
    }

    if (best !== -1) {
      const table = safeTables[best];
      for (const g of groupGuests) {
        table.seats.push(g.id);
        seated.set(g.id, best);
      }
      groupsKeptTogether += 1;
      continue;
    }

    // Whole group fits nowhere → pour parties into free space one by one.
    let placedAny = false;
    for (const g of groupGuests) {
      const w = seatWeight(g);
      let target = -1;
      for (let i = 0; i < safeTables.length; i++) {
        if (freeAt(i) >= w) {
          target = i;
          break;
        }
      }
      if (target !== -1) {
        safeTables[target].seats.push(g.id);
        seated.set(g.id, target);
        placedAny = true;
      }
    }
    if (placedAny && groupGuests.every((g) => seated.has(g.id))) {
      groupsKeptTogether += 1; // split, but everyone made it to a seat
    }
  }

  return {
    tables: safeTables,
    unseatedIds: attending.filter((g) => !seated.has(g.id)).map((g) => g.id),
    groupsKeptTogether,
  };
}
