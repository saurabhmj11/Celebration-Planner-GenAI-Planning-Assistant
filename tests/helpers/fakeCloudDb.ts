/**
 * In-memory fakes of the Prisma subsets the cloud handlers touch.
 *
 * They implement EXACTLY the method shapes the route factories call (with
 * Prisma's nested where syntax), so every wire-level contract can be tested
 * without a live database. No .test. in the filename — bun treats it as a
 * helper, not a suite.
 */

export interface FakeUserRow {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
}

export interface FakeSessionRow {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface FakeEventRow {
  id: string;
  userId: string;
  localId: string;
  title: string;
  eventType: string;
  eventDate: string | null;
  snapshot: string;
  version: number;
  rsvpToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeResponseRow {
  id: string;
  eventId: string;
  guestKey: string;
  name: string;
  attending: string;
  plusOnes: number;
  meal: string | null;
  note: string | null;
  isNewGuest: boolean;
  submittedAt: Date;
  updatedAt: Date;
}

export function makeAuthDb() {
  const users = new Map<string, FakeUserRow>();
  const sessions = new Map<string, FakeSessionRow>();
  let userSeq = 0;
  let sessionSeq = 0;

  const db = {
    user: {
      findUnique: async ({ where }: any) => {
        if (where?.email) return users.get(where.email) ?? null;
        if (where?.id) return [...users.values()].find((u) => u.id === where.id) ?? null;
        return null;
      },
      create: async ({ data }: any) => {
        const row: FakeUserRow = {
          id: `user-${++userSeq}`,
          email: data.email,
          name: data.name ?? null,
          passwordHash: data.passwordHash,
        };
        users.set(row.email, row);
        return row;
      },
    },
    session: {
      create: async ({ data }: any) => {
        const row: FakeSessionRow = {
          id: `session-${++sessionSeq}`,
          token: data.token,
          userId: data.userId,
          expiresAt: new Date(data.expiresAt),
        };
        sessions.set(row.token, row);
        return row;
      },
      delete: async ({ where }: any) => {
        if (where?.token) sessions.delete(where.token);
        else if (where?.id) {
          for (const [token, row] of sessions) {
            if (row.id === where.id) sessions.delete(token);
          }
        }
        return {};
      },
      findUnique: async ({ where }: any) => {
        const row = sessions.get(where?.token);
        if (!row) return null;
        const user = [...users.values()].find((u) => u.id === row.userId);
        return {
          ...row,
          user: user ? { id: user.id, email: user.email, name: user.name } : null,
        };
      },
    },
  };

  return { db, users, sessions };
}

export function makeSyncDb(seed: {
  users?: FakeUserRow[];
  events?: FakeEventRow[];
  responses?: FakeResponseRow[];
} = {}) {
  const users = new Map<string, FakeUserRow>();
  const events = new Map<string, FakeEventRow>(); // key: `${userId}:${localId}`
  const responses = new Map<string, FakeResponseRow>(); // key: `${eventId}:${guestKey}`
  let eventSeq = 0;
  let responseSeq = 0;
  let sessionSeq = 0;
  const sessions = new Map<string, FakeSessionRow>();

  for (const u of seed.users ?? []) users.set(u.email, u);
  for (const e of seed.events ?? []) events.set(`${e.userId}:${e.localId}`, e);
  for (const r of seed.responses ?? []) responses.set(`${r.eventId}:${r.guestKey}`, r);

  const findEvent = (where: any): FakeEventRow | null => {
    if (where?.userId_localId) {
      return events.get(`${where.userId_localId.userId}:${where.userId_localId.localId}`) ?? null;
    }
    if (where?.rsvpToken) {
      return [...events.values()].find((e) => e.rsvpToken === where.rsvpToken) ?? null;
    }
    if (where?.id) {
      return [...events.values()].find((e) => e.id === where.id) ?? null;
    }
    return null;
  };

  const db = {
    session: {
      findUnique: async ({ where }: any) => {
        const row = sessions.get(where?.token);
        if (!row) return null;
        const user = [...users.values()].find((u) => u.id === row.userId);
        return {
          ...row,
          user: user ? { id: user.id, email: user.email, name: user.name } : null,
        };
      },
      delete: async ({ where }: any) => {
        if (where?.token) sessions.delete(where.token);
        return {};
      },
    },
    syncedEvent: {
      findUnique: async ({ where }: any) => findEvent(where),
      findMany: async ({ where, orderBy }: any) => {
        const rows = [...events.values()].filter((e) => !where?.userId || e.userId === where.userId);
        if (orderBy?.updatedAt === "desc") {
          rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }
        return rows;
      },
      create: async ({ data }: any) => {
        const row: FakeEventRow = {
          id: `evt-${++eventSeq}`,
          userId: data.userId,
          localId: data.localId,
          title: data.title,
          eventType: data.eventType,
          eventDate: data.eventDate ?? null,
          snapshot: data.snapshot,
          version: data.version ?? 1,
          rsvpToken: data.rsvpToken ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        events.set(`${row.userId}:${row.localId}`, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = findEvent(where);
        if (!row) throw new Error("Record not found");
        const inc = (data.version as unknown as { increment?: number })?.increment;
        const next: FakeEventRow = {
          ...row,
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.eventType !== undefined ? { eventType: data.eventType } : {}),
          ...(data.eventDate !== undefined ? { eventDate: data.eventDate } : {}),
          ...(data.snapshot !== undefined ? { snapshot: data.snapshot } : {}),
          ...(data.rsvpToken !== undefined ? { rsvpToken: data.rsvpToken } : {}),
          ...(inc ? { version: row.version + inc } : {}),
          updatedAt: new Date(),
        };
        events.set(`${row.userId}:${row.localId}`, next);
        return next;
      },
      delete: async ({ where }: any) => {
        const row = findEvent(where);
        if (!row) throw new Error("Record not found");
        events.delete(`${row.userId}:${row.localId}`);
        for (const [key, r] of responses) {
          if (r.eventId === row.id) responses.delete(key);
        }
        return row;
      },
    },
    rsvpResponse: {
      count: async ({ where }: any) => {
        let rows = [...responses.values()];
        if (where?.eventId) rows = rows.filter((r) => r.eventId === where.eventId);
        if (where?.guestKey?.in) {
          rows = rows.filter((r) => where.guestKey.in.includes(r.guestKey));
        }
        return rows.length;
      },
      findMany: async ({ where, orderBy }: any) => {
        let rows = [...responses.values()];
        if (where?.eventId) rows = rows.filter((r) => r.eventId === where.eventId);
        if (where?.guestKey?.in) {
          rows = rows.filter((r) => where.guestKey.in.includes(r.guestKey));
        }
        if (orderBy?.submittedAt === "asc") {
          rows.sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
        }
        return rows;
      },
      deleteMany: async ({ where }: any) => {
        let removed = 0;
        for (const [key, r] of responses) {
          if (r.eventId !== where?.eventId) continue;
          if (where.guestKey?.in && !where.guestKey.in.includes(r.guestKey)) continue;
          responses.delete(key);
          removed += 1;
        }
        return { count: removed };
      },
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.eventId_guestKey.eventId}:${where.eventId_guestKey.guestKey}`;
        const existing = responses.get(key);
        if (existing) {
          const next: FakeResponseRow = {
            ...existing,
            ...("name" in update ? { name: update.name } : {}),
            ...("attending" in update ? { attending: update.attending } : {}),
            ...("plusOnes" in update ? { plusOnes: update.plusOnes } : {}),
            ...("meal" in update ? { meal: update.meal } : {}),
            ...("note" in update ? { note: update.note } : {}),
            ...("isNewGuest" in update ? { isNewGuest: update.isNewGuest } : {}),
            updatedAt: new Date(update.updatedAt ?? Date.now()),
          };
          responses.set(key, next);
          return next;
        }
        const row: FakeResponseRow = {
          id: `resp-${++responseSeq}`,
          eventId: create.eventId,
          guestKey: create.guestKey,
          name: create.name,
          attending: create.attending,
          plusOnes: create.plusOnes ?? 0,
          meal: create.meal ?? null,
          note: create.note ?? null,
          isNewGuest: create.isNewGuest ?? false,
          submittedAt: new Date(create.submittedAt ?? Date.now()),
          updatedAt: new Date(create.updatedAt ?? Date.now()),
        };
        responses.set(key, row);
        return row;
      },
    },
  };

  /** Utility: plant a live session for a user and return its cookie token. */
  let sessionTokenSeq = 0;
  const loginAs = (email: string): string => {
    const user = users.get(email);
    if (!user) throw new Error(`loginAs: unknown user ${email}`);
    // Unique 64-char hex token per session — padded counter keeps it deterministic.
    const token = (++sessionTokenSeq).toString(16).padStart(64, "0");
    sessions.set(token, {
      id: `session-${++sessionSeq}`,
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    });
    return token;
  };

  return { db, users, events, responses, sessions, loginAs };
}

/** Build a Request with a JSON body + optional session cookie. */
export function jsonRequest(
  url: string,
  method: string,
  body: unknown,
  sessionToken?: string
): Request {
  return new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(sessionToken ? { cookie: `planner_session=${sessionToken}` } : {}),
    },
  });
}
