import { INITIAL_EVENTS } from '../data/defaultData';

const STORAGE_KEYS = {
  EVENTS: 'celebration_planner_events_v1',
  ACTIVE_ID: 'celebration_planner_active_id_v1',
  API_KEY: 'celebration_gemini_api_key_v1',
};

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
      if (activeId && events.some(e => e.id === activeId)) {
        return activeId;
      }
      return events.length > 0 ? events[0].id : null;
    } catch {
      return INITIAL_EVENTS[0]?.id || null;
    }
  },

  saveActiveEventId(id) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
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
        localStorage.setItem(STORAGE_KEYS.API_KEY, key.trim());
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
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `celebration_events_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Invalid file format: Expected an array of events.');
      }
      // Basic check
      for (const ev of parsed) {
        if (!ev.id || !ev.title || !ev.type) {
          throw new Error('Invalid event structure: Missing id, title, or type.');
        }
        if (!Array.isArray(ev.expenses)) ev.expenses = [];
        if (!Array.isArray(ev.tasks)) ev.tasks = [];
        if (!Array.isArray(ev.vendors)) ev.vendors = [];
      }
      this.saveEvents(parsed);
      this.saveActiveEventId(parsed[0].id);
      return { success: true, events: parsed };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
