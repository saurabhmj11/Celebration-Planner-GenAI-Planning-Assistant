/**
 * Storage service tests — persistence resilience + import validation security.
 * Uses a minimal in-memory localStorage mock (no DOM required).
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { storageService } from "../src/services/storageService.js";
import { INITIAL_EVENTS } from "../src/data/defaultData.js";

class MemoryLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

declare global {
   
  var localStorage: Storage;
}

beforeEach(() => {
  globalThis.localStorage = new MemoryLocalStorage() as unknown as Storage;
});

afterEach(() => {
  (globalThis.localStorage as MemoryLocalStorage).clear();
});

describe("getEvents / saveEvents", () => {
  test("seeds sample data on first load", () => {
    const events = storageService.getEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].title).toBe(INITIAL_EVENTS[0].title);
    // Sample data was persisted for the next load
    const raw = globalThis.localStorage.getItem("celebration_planner_events_v1");
    expect(raw).toBeTruthy();
  });

  test("round-trips saved events", () => {
    const custom = [{ id: "x1", title: "Test Event", type: "birthday", expenses: [] }];
    storageService.saveEvents(custom);
    expect(storageService.getEvents()).toEqual(custom);
  });

  test("falls back to sample data when storage holds corrupted JSON", () => {
    globalThis.localStorage.setItem("celebration_planner_events_v1", "{corrupt!!");
    const events = storageService.getEvents();
    expect(events.length).toBeGreaterThan(0);
  });

  test("falls back to sample data when storage holds an empty array", () => {
    storageService.saveEvents([]);
    const events = storageService.getEvents();
    expect(events.length).toBeGreaterThan(0);
  });
});

describe("active event id", () => {
  test("returns the stored id when it matches a persisted event", () => {
    const custom = [
      { id: "x1", title: "A", type: "wedding" },
      { id: "x2", title: "B", type: "birthday" },
    ];
    storageService.saveEvents(custom);
    storageService.saveActiveEventId("x2");
    expect(storageService.getActiveEventId()).toBe("x2");
  });

  test("repairs a stale active id to the first event", () => {
    const custom = [{ id: "x1", title: "A", type: "community" }];
    storageService.saveEvents(custom);
    storageService.saveActiveEventId("gone-forever");
    expect(storageService.getActiveEventId()).toBe("x1");
  });
});

describe("api key handling", () => {
  test("trims keys and clears them with empty values", () => {
    storageService.saveApiKey("  secret123  ");
    expect(storageService.getApiKey()).toBe("secret123");
    storageService.saveApiKey("");
    expect(storageService.getApiKey()).toBe("");
  });
});

describe("importData — security validation", () => {
  const validBackup = JSON.stringify([
    {
      id: "b1",
      title: "Backup Wedding",
      type: "wedding",
      date: "2026-12-31",
      guestCount: 80,
      budget: 12000,
      expenses: [{ id: "e1", label: "Venue", allocated: "4000", spent: 1000, category: "venue" }],
      tasks: [{ id: "t1", title: "Book officiant", completed: "yes", dueDate: "bad-date", priority: "extreme" }],
      vendors: [{ id: "v1", name: "DJ", cost: -50, status: "contacted" }],
    },
  ]);

  test("accepts a valid backup and normalizes every field", () => {
    const result = storageService.importData(validBackup);
    expect(result.success).toBe(true);

    const ev = result.events[0];
    expect(ev.title).toBe("Backup Wedding");
    expect(ev.expenses[0].allocated).toBe(4000); // numeric-string coerced
    expect(ev.tasks[0].completed).toBe(true); // "yes" -> true
    expect(ev.tasks[0].priority).toBe("medium"); // invalid priority -> medium
    expect(ev.tasks[0].dueDate).toBe(""); // bad date dropped
    expect(ev.vendors[0].cost).toBe(0); // negative clamped
  });

  test("rejects non-JSON and non-array payloads", () => {
    expect(storageService.importData("not json").success).toBe(false);
    expect(storageService.importData('{"single":"object"}').success).toBe(false);
    expect(storageService.importData("[]").success).toBe(false);
  });

  test("rejects events missing required identity fields", () => {
    const bad = JSON.stringify([{ title: "No Id", type: "wedding" }]);
    const res = storageService.importData(bad);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Invalid event structure/i);
  });

  test("rejects oversized files and flood imports", () => {
    const tooBig = JSON.stringify(
      Array.from({ length: 500 }, (_, i) => ({ id: `e${i}`, title: `E${i}`, type: "birthday" }))
    );
    const res = storageService.importData(tooBig);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Too many events/i);

    expect(storageService.importData("x".repeat(6 * 1024 * 1024)).success).toBe(false);
  });

  test("coerces malformed collection fields into safe empty arrays", () => {
    const weird = JSON.stringify([
      {
        id: "w1",
        title: "Weird",
        type: "community",
        expenses: "junk",
        tasks: [null, "string", { id: "t1", title: "Real Task" }],
        vendors: 42,
      },
    ]);
    const res = storageService.importData(weird);
    expect(res.success).toBe(true);
    const ev = res.events[0];
    expect(ev.expenses).toEqual([]);
    expect(ev.vendors).toEqual([]);
    expect(ev.tasks).toHaveLength(1);
    expect(ev.tasks[0].title).toBe("Real Task");
  });

  test("strips control characters from imported strings", () => {
    const dirty = JSON.stringify([
      { id: "d\u00001", title: "Dirty\u0000Title\u202E", type: "wedding" },
    ]);
    const res = storageService.importData(dirty);
    expect(res.success).toBe(true);
    expect(res.events[0].title).toBe("DirtyTitle");
  });
});

describe("resetToSampleData", () => {
  test("restores the original rich sample events", () => {
    storageService.saveEvents([{ id: "z", title: "Custom", type: "birthday" }]);
    const events = storageService.resetToSampleData();
    expect(events.length).toBe(INITIAL_EVENTS.length);
    expect(storageService.getActiveEventId()).toBe(INITIAL_EVENTS[0].id);
  });
});
