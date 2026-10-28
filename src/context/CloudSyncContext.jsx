import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useEventContext } from './EventContext';
import { mergeRsvpResponses, rsvpSummaryText } from '../lib/sync/rsvpMerge';
import { makeId } from '../utils/ids';
import { MAX_PHOTOS_PER_EVENT, validatePhotoDataUrl } from '../lib/photos/photoModel';

/**
 * Cloud Sync Context — the client half of the cloud-persistence layer
 * (GAP 2). Owns the account session, the cloud-event index, and the sync
 * actions (push / pull-merge RSVP responses / restore / share links).
 *
 * Design notes:
 *  - The app stays localStorage-first: cloud sync is strictly opt-in.
 *  - Pushed snapshots strip photo data-URLs (photos stay on-device) so a
 *    sync payload is a few KB, not megabytes.
 *  - RSVP imports merge into the local guest list through EventContext, so
 *    the global undo engine (Ctrl+Z) covers every cloud mutation too.
 */

const CloudSyncContext = createContext(null);

const authFetch = (url, opts = {}) =>
  fetch(url, {
    ...opts,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });

/** The cloud copy of an event: full plan, but photo payloads stay on-device. */
export function snapshotForPush(event) {
  return JSON.stringify({ ...event, photos: [] });
}

export const CloudSyncProvider = ({ children }) => {
  const {
    events,
    updateEvent,
    restoreCloudEvent,
    addPhotosForEvent,
    showToast,
  } = useEventContext();
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const [user, setUser] = useState(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [cloudEvents, setCloudEvents] = useState([]);
  const [syncingIds, setSyncingIds] = useState(() => new Set());
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);

  const openCloudModal = useCallback(() => setIsCloudModalOpen(true), []);
  const closeCloudModal = useCallback(() => setIsCloudModalOpen(false), []);

  const handleAuthFailure = useCallback((payload) => {
    if (payload?.status === 401) {
      setUser(null);
      setCloudEvents([]);
      return 'Your session expired — sign in again.';
    }
    return null;
  }, []);

  /* ---------------- session ---------------- */

  const refreshCloudList = useCallback(async () => {
    try {
      const res = await authFetch('/api/sync/events', { cache: 'no-store' });
      if (res.status === 401) {
        setUser(null);
        setCloudEvents([]);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setCloudEvents(Array.isArray(data.events) ? data.events : []);
    } catch (_err) {
      /* offline — keep the last known list */
    }
  }, []);

  // Bootstrap: resolve the session cookie once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/auth/session', { cache: 'no-store' });
        const data = await res.json().catch(() => ({ user: null }));
        if (cancelled) return;
        setUser(data?.user || null);
        if (data?.user) await refreshCloudList();
      } catch (_err) {
        /* offline */
      } finally {
        if (!cancelled) setIsSessionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCloudList]);

  const register = useCallback(
    async ({ email, name, password }) => {
      try {
        const res = await authFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, name, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, error: data.error || 'Could not create account.', fields: data.fields };
        }
        setUser(data.user);
        await refreshCloudList();
        showToast(`Welcome aboard, ${data.user?.name || data.user?.email}!`, 'success');
        return { ok: true, user: data.user };
      } catch (_err) {
        return { ok: false, error: 'Network error — please try again.' };
      }
    },
    [refreshCloudList, showToast]
  );

  const signIn = useCallback(
    async ({ email, password }) => {
      try {
        const res = await authFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, error: data.error || 'Could not sign in.', fields: data.fields };
        }
        setUser(data.user);
        await refreshCloudList();
        showToast('Signed in to cloud sync.', 'success');
        return { ok: true, user: data.user };
      } catch (_err) {
        return { ok: false, error: 'Network error — please try again.' };
      }
    },
    [refreshCloudList, showToast]
  );

  const signOut = useCallback(async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch (_err) {
      /* best effort */
    }
    setUser(null);
    setCloudEvents([]);
    showToast('Signed out of cloud sync. Your events stay on this device.', 'info');
  }, [showToast]);

  /* ---------------- sync actions ---------------- */

  const pushEvent = useCallback(
    async (event) => {
      if (!user) return { ok: false, error: 'Sign in to sync your events.' };
      if (!event?.id || !event?.title) return { ok: false, error: 'This event cannot be synced.' };
      try {
        const res = await authFetch('/api/sync/events', {
          method: 'POST',
          body: JSON.stringify({
            localId: event.id,
            title: String(event.title).slice(0, 120),
            eventType: String(event.type || 'other'),
            eventDate: /^\d{4}-\d{2}-\d{2}$/.test(event.date || '') ? event.date : null,
            snapshot: snapshotForPush(event),
          }),
        });
        if (res.status === 401) {
          setUser(null);
          setCloudEvents([]);
          return { ok: false, error: 'Your session expired — sign in again.' };
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error || 'Sync failed.' };
        setCloudEvents((prev) => {
          const prior = prev.find((c) => c.localId === data.localId);
          const next = prev.filter((c) => c.localId !== data.localId);
          next.unshift({
            localId: data.localId,
            title: String(event.title).slice(0, 120),
            eventType: String(event.type || 'other'),
            eventDate: /^\d{4}-\d{2}-\d{2}$/.test(event.date || '') ? event.date : null,
            version: data.version,
            updatedAt: data.updatedAt,
            hasRsvpToken: prior?.hasRsvpToken || false,
            hasAlbumToken: prior?.hasAlbumToken || false,
            responseCount: data.responseCount ?? 0,
            guestPhotoCount: prior?.guestPhotoCount ?? 0,
          });
          return next;
        });
        return { ok: true, data };
      } catch (_err) {
        return { ok: false, error: 'Network error while syncing.' };
      }
    },
    [user]
  );

  /** Push the event, then import any new public-RSVP responses into its guest list. */
  const syncEvent = useCallback(
    async (event) => {
      if (!user) return { ok: false, error: 'Sign in to sync your events.' };
      setSyncingIds((prev) => new Set(prev).add(event.id));
      try {
        const pushed = await pushEvent(event);
        if (!pushed.ok) return pushed;

        const res = await authFetch(
          `/api/sync/events/${encodeURIComponent(event.id)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return { ok: false, error: 'Could not read cloud responses.' };
        const cloud = await res.json();
        const responses = Array.isArray(cloud.responses) ? cloud.responses : [];

        if (responses.length > 0) {
          const { guests, summary } = mergeRsvpResponses(event, responses);
          updateEvent(event.id, { guests }, { silent: true });
          showToast(rsvpSummaryText(summary), summary.confirmed > 0 ? 'success' : 'info');
          try {
            await authFetch(
              `/api/sync/events/${encodeURIComponent(event.id)}/responses/ack`,
              { method: 'POST', body: JSON.stringify({ guestKeys: responses.map((r) => r.guestKey) }) }
            );
          } catch (_err) {
            /* ack is best-effort; re-import is idempotent */
          }
        } else {
          showToast('Synced with the cloud — no new responses.', 'info');
        }
        await refreshCloudList();
        return { ok: true, imported: responses.length, summary };
      } catch (_err) {
        return { ok: false, error: 'Network error while syncing.' };
      } finally {
        setSyncingIds((prev) => {
          const next = new Set(prev);
          next.delete(event.id);
          return next;
        });
      }
    },
    [pushEvent, refreshCloudList, updateEvent, showToast, user]
  );

  /** Wholesale replace the local event with the cloud copy (undoable). */
  const restoreEvent = useCallback(
    async (localId) => {
      try {
        const res = await authFetch(`/api/sync/events/${encodeURIComponent(localId)}`, {
          cache: 'no-store',
        });
        if (res.status === 401) {
          setUser(null);
          return { ok: false, error: 'Your session expired — sign in again.' };
        }
        if (!res.ok) return { ok: false, error: 'This event is not in your cloud.' };
        const cloud = await res.json();
        const snapshot = cloud.snapshot;
        if (!snapshot?.id) return { ok: false, error: 'The cloud snapshot could not be read.' };

        const current = eventsRef.current;
        const localEvent = current.find((e) => e.id === localId);
        if (localEvent) {
          // Same device: replace the plan, keep on-device photos.
          updateEvent(localId, { ...snapshot, photos: localEvent.photos || [] }, { silent: true });
          showToast(`Restored "${snapshot.title}" from the cloud (Ctrl+Z to undo).`, 'success');
          return { ok: true, mode: 'replaced' };
        }
        // New device: import the cloud copy, keeping its id so pushes re-link.
        const id = current.some((e) => e.id === localId) ? makeId('event') : localId;
        const restored = restoreCloudEvent({ ...snapshot, id });
        return restored ? { ok: true, mode: 'added' } : { ok: false, error: 'Snapshot could not be restored.' };
      } catch (_err) {
        return { ok: false, error: 'Network error while restoring.' };
      }
    },
    [restoreCloudEvent, showToast, updateEvent]
  );

  const deleteCloudEvent = useCallback(
    async (localId) => {
      try {
        const res = await authFetch(`/api/sync/events/${encodeURIComponent(localId)}`, {
          method: 'DELETE',
        });
        if (!res.ok) return { ok: false, error: 'Could not remove from cloud.' };
        setCloudEvents((prev) => prev.filter((c) => c.localId !== localId));
        showToast('Removed from your cloud. This device keeps its copy.', 'info');
        return { ok: true };
      } catch (_err) {
        return { ok: false, error: 'Network error.' };
      }
    },
    [showToast]
  );

  /** Sync (if needed) + mint the public RSVP link for one event. */
  const ensureRsvpShare = useCallback(
    async (event) => {
      const pushed = await pushEvent(event);
      if (!pushed.ok) return pushed;
      try {
        const res = await authFetch(
          `/api/sync/events/${encodeURIComponent(event.id)}/share-rsvp`,
          { method: 'POST' }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error || 'Could not create the RSVP link.' };
        setCloudEvents((prev) =>
          prev.map((c) => (c.localId === event.id ? { ...c, hasRsvpToken: true } : c))
        );
        return { ok: true, url: data.url, token: data.token };
      } catch (_err) {
        return { ok: false, error: 'Network error while creating the link.' };
      }
    },
    [pushEvent]
  );

  /** Sync (if needed) + mint the public guest-photo album link for one event. */
  const ensureAlbumShare = useCallback(
    async (event) => {
      const pushed = await pushEvent(event);
      if (!pushed.ok) return pushed;
      try {
        const res = await authFetch(
          `/api/sync/events/${encodeURIComponent(event.id)}/share-album`,
          { method: 'POST' }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error || 'Could not create the album link.' };
        setCloudEvents((prev) =>
          prev.map((c) => (c.localId === event.id ? { ...c, hasAlbumToken: true } : c))
        );
        return { ok: true, url: data.url, token: data.token };
      } catch (_err) {
        return { ok: false, error: 'Network error while creating the link.' };
      }
    },
    [pushEvent]
  );

  /**
   * Collect guest photos from the shared album into this event's photo wall,
   * then ack (clear) what was imported so the cloud inbox stays lean.
   *
   * Import rules mirror the wall's own limits: only wall-safe data URLs are
   * accepted, and at most (MAX_PHOTOS_PER_EVENT - current) photos come over —
   * the rest stay in the cloud inbox until space frees up.
   */
  const collectGuestPhotos = useCallback(
    async (event) => {
      if (!user) return { ok: false, error: 'Sign in to collect guest photos.' };
      if (!event?.id) return { ok: false, error: 'This event cannot be collected.' };
      try {
        const res = await authFetch(
          `/api/sync/events/${encodeURIComponent(event.id)}/photos`,
          { cache: 'no-store' }
        );
        if (res.status === 401) {
          setUser(null);
          return { ok: false, error: 'Your session expired — sign in again.' };
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { ok: false, error: data.error || 'Could not read the guest-photo inbox.' };
        }
        const cloud = await res.json();
        const inbox = Array.isArray(cloud.photos) ? cloud.photos : [];
        if (inbox.length === 0) {
          showToast('No new guest photos right now.', 'info');
          return { ok: true, imported: 0 };
        }

        const currentCount = Array.isArray(event.photos) ? event.photos.length : 0;
        const capacity = Math.max(0, MAX_PHOTOS_PER_EVENT - currentCount);
        const safe = inbox.filter((p) => validatePhotoDataUrl(p?.dataUrl));
        const importable = safe.slice(0, capacity);

        if (importable.length === 0) {
          showToast(
            capacity === 0
              ? `The wall is full (${MAX_PHOTOS_PER_EVENT} photos) — remove one to make room for guest photos.`
              : 'None of the guest photos could be validated for this wall.',
            'error'
          );
          return { ok: false, imported: 0, remaining: inbox.length };
        }

        const metas = importable.map((p) => ({
          dataUrl: p.dataUrl,
          caption: [p.caption, p.uploader ? `Shared by ${p.uploader}` : null]
            .filter(Boolean)
            .join(' — ')
            .slice(0, 200),
          album: 'candids',
          createdAt: p.createdAt || new Date().toISOString(),
        }));
        const added = addPhotosForEvent(event.id, metas, { silent: true });

        if (added > 0) {
          try {
            await authFetch(
              `/api/sync/events/${encodeURIComponent(event.id)}/photos/ack`,
              { method: 'POST', body: JSON.stringify({ photoIds: importable.map((p) => p.id) }) }
            );
          } catch (_err) {
            /* ack is best-effort; re-import is harmless (photos just re-appear) */
          }
        }

        const skipped = inbox.length - added;
        showToast(
          `Collected ${added} guest photo${added === 1 ? '' : 's'} onto the wall` +
            (skipped > 0 ? ` — ${skipped} stayed in the inbox (no room or unsafe).` : '.'),
          'success'
        );
        await refreshCloudList();
        return { ok: true, imported: added, remaining: skipped };
      } catch (_err) {
        return { ok: false, error: 'Network error while collecting photos.' };
      }
    },
    [user, addPhotosForEvent, refreshCloudList, showToast]
  );

  const syncAllEvents = useCallback(async () => {
    const current = eventsRef.current;
    let okCount = 0;
    let lastError = null;
    for (const event of current) {
      const res = await syncEvent(event);
      if (res.ok) okCount += 1;
      else lastError = res.error;
    }
    return { okCount, total: current.length, lastError };
  }, [syncEvent]);

  /* ---------------- derived ---------------- */

  const cloudByLocalId = useMemo(() => {
    const map = new Map();
    for (const c of cloudEvents) map.set(c.localId, c);
    return map;
  }, [cloudEvents]);

  const pendingResponses = useMemo(
    () => cloudEvents.reduce((acc, c) => acc + (c.responseCount || 0), 0),
    [cloudEvents]
  );

  const value = useMemo(
    () => ({
      // session
      user,
      isSessionReady,
      register,
      signIn,
      signOut,
      // cloud index
      cloudEvents,
      cloudByLocalId,
      pendingResponses,
      refreshCloudList,
      // actions
      pushEvent,
      syncEvent,
      syncAllEvents,
      restoreEvent,
      deleteCloudEvent,
      ensureRsvpShare,
      ensureAlbumShare,
      collectGuestPhotos,
      syncingIds,
      // modal
      isCloudModalOpen,
      openCloudModal,
      closeCloudModal,
      handleAuthFailure,
    }),
    [
      user,
      isSessionReady,
      register,
      signIn,
      signOut,
      cloudEvents,
      cloudByLocalId,
      pendingResponses,
      refreshCloudList,
      pushEvent,
      syncEvent,
      syncAllEvents,
      restoreEvent,
      deleteCloudEvent,
      ensureRsvpShare,
      ensureAlbumShare,
      collectGuestPhotos,
      syncingIds,
      isCloudModalOpen,
      openCloudModal,
      closeCloudModal,
      handleAuthFailure,
    ]
  );

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
};

export const useCloudSync = () => {
  const context = useContext(CloudSyncContext);
  if (!context) {
    throw new Error('useCloudSync must be used within a CloudSyncProvider');
  }
  return context;
};
