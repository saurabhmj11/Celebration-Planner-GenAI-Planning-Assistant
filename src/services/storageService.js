import { INITIAL_EVENTS } from '../data/defaultData';

const STORAGE_KEYS = {
  EVENTS: 'celebration_planner_events_v1',
  ACTIVE_ID: 'celebration_planner_active_id_v1',
  API_KEY: 'celebration_gemini_api_key_v1',
};

/** Hard limits so a hostile import file can never bloat or poison local state. */
const IMPORT_LIMITS = {
  MAX_EVENTS: 200,
  MAX_ITEMS_PER_EVENT: 500,
  MAX_STRING_LEN: 2_000,
  MAX_BUDGET: 100_000_000,
  MAX_GUESTS: 100_000,
};

/** Clamp + sanitize a user-supplied numeric field. */
function safeNumber(value, max) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.round(n));
}

/** Trim + cap a user-supplied string field. */
function safeString(value, maxLen = IMPORT_LIMITS.MAX_STRING_LEN) {
  if (typeof value !== 'string') return '';
  return value
     
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .trim()
    .slice(0, maxLen);
}

/** Coerce a list of items with per-event item caps; drops non-objects. */
function safeItemList(value, itemLimit = IMPORT_LIMITS.MAX_ITEMS_PER_EVENT) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .slice(0, itemLimit);
}

/** Validate + normalize one imported event object. Returns null if unusable. */
function normalizeImportedEvent(ev) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return null;

  const id = safeString(ev.id, 100);
  const title = safeString(ev.title, 200);
  const type = safeString(ev.type, 50);
  if (!id || !title || !type) return null;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? ev.date : '';
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(ev.time) ? ev.time : '';

  const expenses = safeItemList(ev.expenses).map((e) => ({
    id: safeString(e.id, 100),
    category: safeString(e.category, 60),
    label: safeString(e.label, 200),
    allocated: safeNumber(e.allocated, IMPORT_LIMITS.MAX_BUDGET),
    spent: safeNumber(e.spent, IMPORT_LIMITS.MAX_BUDGET),
  }));

  const tasks = safeItemList(ev.tasks).map((t) => ({
    id: safeString(t.id, 100),
    title: safeString(t.title, 200),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : '',
    priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium',
    completed: Boolean(t.completed),
  }));

  const vendors = safeItemList(ev.vendors).map((v) => ({
    id: safeString(v.id, 100),
    name: safeString(v.name, 200),
    category: safeString(v.category, 60),
    status: safeString(v.status, 40),
    cost: safeNumber(v.cost, IMPORT_LIMITS.MAX_BUDGET),
  }));

  return {
    id,
    title,
    type,
    date,
    time,
    location: safeString(ev.location, 300),
    guestCount: safeNumber(ev.guestCount, IMPORT_LIMITS.MAX_GUESTS),
    budget: safeNumber(ev.budget, IMPORT_LIMITS.MAX_BUDGET),
    description: safeString(ev.description, 1_000),
    themeName: safeString(ev.themeName, 120),
    themeColor: /^#[0-9a-fA-F]{6}$/.test(ev.themeColor) ? ev.themeColor : '',
    expenses,
    tasks,
    vendors,
  };
}

export const storageService = {
  getEvents() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!data) {
        this.saveEvents(INITIAL_EVENTS);
        return INITIAL_EVENTS;
      }
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      this.saveEvents(INITIAL_EVENTS);
      return INITIAL_EVENTS;
    } catch (e) {
      console.warn('Failed to load events from localStorage, using initial sample data', e);
      return INITIAL_EVENTS;
    }
  },

  saveEvents(events) {
    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    } catch (e) {
      console.error('Error saving events to localStorage', e);
    }
  },

  getActiveEventId() {
    try {
      const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
      const events = this.getEvents();
      if (activeId && events.some((e) => e.id === activeId)) {
        return activeId;
      }
      return events.length > 0 ? events[0].id : null;
    } catch {
      return INITIAL_EVENTS[0]?.id || null;
    }
  },

  saveActiveEventId(id) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, String(id).slice(0, 100));
    } catch (e) {
      console.error('Error saving active event id', e);
    }
  },

  getApiKey() {
    try {
      // Check localStorage for an optional user-supplied Gemini key.
      // (No bundled env keys are exposed to the client in this deployment —
      // the app's built-in AI engine runs entirely server-side.)
      const localKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
      if (localKey && localKey.trim()) return localKey.trim();
      return '';
    } catch {
      return '';
    }
  },

  saveApiKey(key) {
    try {
      if (!key) {
        localStorage.removeItem(STORAGE_KEYS.API_KEY);
      } else {
        localStorage.setItem(STORAGE_KEYS.API_KEY, key.trim().slice(0, 200));
      }
    } catch (e) {
      console.error('Error saving API key', e);
    }
  },

  resetToSampleData() {
    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(INITIAL_EVENTS));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, INITIAL_EVENTS[0].id);
      return INITIAL_EVENTS;
    } catch (e) {
      console.error('Failed resetting to sample data', e);
      return INITIAL_EVENTS;
    }
  },

  exportData() {
    const events = this.getEvents();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `celebration_events_backup_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  /**
   * Import a JSON backup string with strict validation + normalization.
   * Rejects hostile/malformed files before they ever touch app state.
   */
  importData(jsonString) {
    try {
      if (typeof jsonString !== 'string' || jsonString.length > 5 * 1024 * 1024) {
        throw new Error('Invalid file: expected a JSON backup under 5MB.');
      }

      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Invalid file format: expected an array of events.');
      }
      if (parsed.length > IMPORT_LIMITS.MAX_EVENTS) {
        throw new Error(`Too many events: maximum ${IMPORT_LIMITS.MAX_EVENTS} allowed.`);
      }

      const cleaned = [];
      for (const raw of parsed) {
        const ev = normalizeImportedEvent(raw);
        if (!ev) {
          throw new Error('Invalid event structure: every event needs id, title, and type.');
        }
        cleaned.push(ev);
      }

      this.saveEvents(cleaned);
      this.saveActiveEventId(cleaned[0].id);
      return { success: true, events: cleaned };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Import failed.' };
    }
  },
};
