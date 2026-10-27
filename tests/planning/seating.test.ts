/**
 * Deterministic seating arranger — the shared brain of the "Auto-Arrange"
 * button and the offline Seating Strategist agent.
 */
import { describe, expect, test } from "bun:test";
import { autoArrangeTables, seatWeight } from "../../src/lib/planning/seating";

describe("seatWeight", () => {
  test("1 + clamped plus-ones", () => {
    expect(seatWeight({ plusOnes: 0 })).toBe(1);
    expect(seatWeight({ plusOnes: 3 })).toBe(4);
    expect(seatWeight({ plusOnes: 99 })).toBe(11); // clamp at 10
    expect(seatWeight({ plusOnes: -5 })).toBe(1);
    expect(seatWeight({ plusOnes: "2" })).toBe(3);
    expect(seatWeight(null)).toBe(1);
    expect(seatWeight({})).toBe(1);
  });
});

describe("autoArrangeTables", () => {
  const G = (id, group, rsvp = "attending", plusOnes = 0) => ({ id, group, rsvp, plusOnes });

  test("keeps groups together and fills tables in order", () => {
    const tables = [
      { id: "t1", name: "T1", capacity: 4 },
      { id: "t2", name: "T2", capacity: 4 },
    ];
    const guests = [
      G("f1", "family"), G("f2", "family"),
      G("a1", "friends"), G("a2", "friends"),
    ];
    const { tables: arranged, unseatedIds } = autoArrangeTables(tables, guests);

    const byId = Object.fromEntries(arranged.map((t) => [t.id, t.seats]));
    expect(byId.t1).toEqual(["f1", "f2"]); // family fills t1
    expect(byId.t2).toEqual(["a1", "a2"]); // friends fill t2
    expect(unseatedIds).toEqual([]);
  });

  test("plus-one parties are never split across tables", () => {
    const tables = [
      { id: "t1", capacity: 3 },
      { id: "t2", capacity: 4 },
    ];
    const guests = [
      G("big", "family", "attending", 3), // party of 4
      G("s1", "family"),
      G("s2", "family"),
    ];
    const { tables: arranged, unseatedIds } = autoArrangeTables(tables, guests);
    const t1 = arranged.find((t) => t.id === "t1")!;
    const t2 = arranged.find((t) => t.id === "t2")!;

    // big(4) can't fit t1(3); s1+s2 go to t1 first; big lands on t2 alone.
    expect(t1.seats).toEqual(["s1", "s2"]);
    expect(t2.seats).toEqual(["big"]);
    expect(unseatedIds).toEqual([]);
  });

  test("only attending guests are seated", () => {
    const tables = [{ id: "t1", capacity: 10 }];
    const guests = [
      G("yes", "family", "attending"),
      G("no", "family", "declined"),
      G("maybe", "friends", "maybe"),
      G("pend", "friends", "invited"),
    ];
    const { tables: arranged, unseatedIds } = autoArrangeTables(tables, guests);
    expect(arranged[0].seats).toEqual(["yes"]);
    expect(unseatedIds).toEqual([]);
  });

  test("guests that fit nowhere stay unseated", () => {
    const tables = [{ id: "t1", capacity: 2 }];
    const guests = [G("a", "x"), G("b", "x"), G("c", "x"), G("big", "x", "attending", 5)];
    const { tables: arranged, unseatedIds } = autoArrangeTables(tables, guests);
    expect(arranged[0].seats.length).toBe(2);
    expect(unseatedIds.length).toBe(2);
    expect(unseatedIds).toContain("big");
  });

  test("empty tables or guests produce empty results safely", () => {
    expect(autoArrangeTables([], [G("a", "x")]).unseatedIds).toEqual(["a"]);
    expect(autoArrangeTables([{ id: "t1", capacity: 8 }], []).unseatedIds).toEqual([]);
    expect(autoArrangeTables(null as never, null as never).tables).toEqual([]);
  });

  test("input tables are never mutated", () => {
    const tables = [{ id: "t1", capacity: 8 }];
    const guests = [G("a", "x")];
    autoArrangeTables(tables, guests);
    expect(tables[0].seats).toBeUndefined();
  });

  test("wedding sample regression: 3 tables seat 6 attending parties", () => {
    // Mirrors the sample wedding data shape (2 parties seated by hand is a
    // different flow — here all attending arrive unseated).
    const tables = [
      { id: "table-w1", capacity: 8 },
      { id: "table-w2", capacity: 8 },
      { id: "table-w3", capacity: 6 },
    ];
    const guests = [
      G("guest-w1", "family", "attending", 1),
      G("guest-w2", "family", "attending", 1),
      G("guest-w3", "friends", "attending", 0),
      G("guest-w4", "friends", "attending", 0),
      G("guest-w5", "family", "maybe", 0),
      G("guest-w10", "family", "attending", 1),
      G("guest-w11", "vendors", "attending", 1),
    ];
    const { tables: arranged, unseatedIds } = autoArrangeTables(tables, guests);

    const seatsUsed = arranged.reduce((sum, t) => {
      const weight = (id) => {
        const g = guests.find((x) => x.id === id);
        return 1 + (g ? g.plusOnes : 0);
      };
      return sum + t.seats.reduce((s, id) => s + weight(id), 0);
    }, 0);
    // 6 attending parties = 6 + 4 plus-ones = 10 seats
    expect(seatsUsed).toBe(10);
    expect(unseatedIds).toEqual([]);
    for (const t of arranged) {
      const weight = (id) => 1 + (guests.find((x) => x.id === id)?.plusOnes ?? 0);
      const used = t.seats.reduce((s, id) => s + weight(id), 0);
      expect(used).toBeLessThanOrEqual(t.capacity);
    }
  });
});
