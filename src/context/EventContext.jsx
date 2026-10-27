import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { storageService } from '../services/storageService';
import { INITIAL_EVENTS } from '../data/defaultData';
import { makeId, sanitizeEvents } from '../utils/ids';
import { MAX_PHOTOS_PER_EVENT, validatePhotoDataUrl } from '../lib/photos/photoModel';

const EventContext = createContext(null);

export const EventProvider = ({ children }) => {
  // Sanitize on load: heals any data written by the old same-millisecond
  // id bug (duplicate task/vendor/expense ids) so list keys and by-id
  // mutations are always unique. Persisted back by the sync effect below.
  const [events, setEvents] = useState(() => sanitizeEvents(storageService.getEvents()));
  const [activeEventId, setActiveEventIdState] = useState(() => storageService.getActiveEventId());
  const [apiKey, setApiKeyState] = useState(() => storageService.getApiKey());
  const [toast, setToast] = useState(null);
  const quotaWarnedRef = useRef(false);

  // Sync events to localStorage — surfacing quota failures (a full localStorage
  // would otherwise silently drop the user's latest changes) exactly once
  // per failure streak instead of spamming a toast on every keystroke.
  useEffect(() => {
    const ok = storageService.saveEvents(events);
    if (!ok) {
      if (!quotaWarnedRef.current) {
        quotaWarnedRef.current = true;
        showToast('Browser storage is full — export a backup and remove a few photos to keep saving.', 'error');
      }
    } else {
      quotaWarnedRef.current = false;
    }
    // showToast is a stable useCallback; eslint exhaustive-deps on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Sync active event ID
  const setActiveEventId = useCallback((id) => {
    setActiveEventIdState(id);
    storageService.saveActiveEventId(id);
  }, []);

  // Save API key
  const setApiKey = useCallback((key) => {
    setApiKeyState(key);
    storageService.saveApiKey(key);
  }, []);

  // Show Toast
  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 3800);
  }, []);

  // Fire celebratory confetti!
  const triggerConfetti = useCallback(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']
      });
    } catch {
      // safe fallback
    }
  }, []);

  // Current active event
  const activeEvent = useMemo(() => {
    if (!events || events.length === 0) return null;
    return events.find((e) => e.id === activeEventId) || events[0];
  }, [events, activeEventId]);

  // Ensure activeEventId is valid
  useEffect(() => {
    if (events.length > 0 && (!activeEventId || !events.some((e) => e.id === activeEventId))) {
      setActiveEventIdState(events[0].id);
      storageService.saveActiveEventId(events[0].id);
    }
  }, [events, activeEventId]);

  // ---------------- EVENT ACTIONS ----------------
  const addEvent = useCallback((eventData) => {
    const newId = makeId('event');
    const newEvent = {
      ...eventData,
      id: newId,
      createdAt: new Date().toISOString(),
      expenses: eventData.expenses || [],
      tasks: eventData.tasks || [],
      vendors: eventData.vendors || [],
      guests: eventData.guests || [],
      invitation: eventData.invitation || null,
      photos: eventData.photos || [],
      budget: Number(eventData.budget) || 5000,
      guestCount: Number(eventData.guestCount) || 50,
    };

    setEvents((prev) => [newEvent, ...prev]);
    setActiveEventId(newId);
    showToast(`Created event "${newEvent.title}"!`, 'success');
    triggerConfetti();
    return newEvent;
  }, [setActiveEventId, showToast, triggerConfetti]);

  const updateEvent = useCallback((id, updatedFields) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          return {
            ...e,
            ...updatedFields,
            budget: updatedFields.budget !== undefined ? Number(updatedFields.budget) : e.budget,
            guestCount: updatedFields.guestCount !== undefined ? Number(updatedFields.guestCount) : e.guestCount,
          };
        }
        return e;
      })
    );
    showToast('Event details updated successfully!', 'success');
  }, [showToast]);

  const deleteEvent = useCallback((id) => {
    setEvents((prev) => {
      const filtered = prev.filter((e) => e.id !== id);
      if (filtered.length === 0) {
        // If deleted all, reset to default sample or empty event
        return INITIAL_EVENTS;
      }
      return filtered;
    });
    showToast('Event removed.', 'info');
  }, [showToast]);

  const duplicateEvent = useCallback((id) => {
    const source = events.find((e) => e.id === id);
    if (!source) return;

    const dupId = makeId('event');
    const duplicated = {
      ...source,
      id: dupId,
      title: `${source.title} (Copy)`,
      createdAt: new Date().toISOString(),
      expenses: source.expenses ? source.expenses.map((exp) => ({ ...exp, id: makeId('exp') })) : [],
      tasks: source.tasks ? source.tasks.map((t) => ({ ...t, id: makeId('task'), completed: false })) : [],
      vendors: source.vendors ? source.vendors.map((v) => ({ ...v, id: makeId('v') })) : [],
      guests: (source.guests || []).map((g) => ({ ...g, id: makeId('guest') })),
      invitation: source.invitation ? { ...source.invitation } : null,
      photos: (source.photos || []).map((p) => ({ ...p, id: makeId('photo') })),
    };

    setEvents((prev) => [duplicated, ...prev]);
    setActiveEventId(dupId);
    showToast(`Duplicated "${source.title}"!`, 'success');
  }, [events, setActiveEventId, showToast]);

  const resetAllToSampleData = useCallback(() => {
    const fresh = storageService.resetToSampleData();
    setEvents(fresh);
    setActiveEventIdState(fresh[0].id);
    showToast('Reset to rich celebration samples!', 'success');
    triggerConfetti();
  }, [showToast, triggerConfetti]);

  // ---------------- BUDGET & EXPENSE ACTIONS ----------------
  const addExpense = useCallback((expenseData) => {
    if (!activeEvent) return;
    const newExpense = {
      ...expenseData,
      id: makeId('exp'),
      allocated: Number(expenseData.allocated) || 0,
      spent: Number(expenseData.spent) || 0,
      paid: Boolean(expenseData.paid),
      date: expenseData.date || new Date().toISOString().slice(0, 10),
    };

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            expenses: [newExpense, ...(e.expenses || [])],
          };
        }
        return e;
      })
    );
    showToast(`Added expense "${newExpense.name}"!`, 'success');
  }, [activeEvent, showToast]);

  const updateExpense = useCallback((expenseId, updatedFields) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            expenses: (e.expenses || []).map((exp) => {
              if (exp.id === expenseId) {
                return {
                  ...exp,
                  ...updatedFields,
                  allocated: updatedFields.allocated !== undefined ? Number(updatedFields.allocated) : exp.allocated,
                  spent: updatedFields.spent !== undefined ? Number(updatedFields.spent) : exp.spent,
                };
              }
              return exp;
            }),
          };
        }
        return e;
      })
    );
    showToast('Expense updated.', 'success');
  }, [activeEvent, showToast]);

  const deleteExpense = useCallback((expenseId) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            expenses: (e.expenses || []).filter((exp) => exp.id !== expenseId),
          };
        }
        return e;
      })
    );
    showToast('Expense deleted.', 'info');
  }, [activeEvent, showToast]);

  const toggleExpensePaid = useCallback((expenseId) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            expenses: (e.expenses || []).map((exp) => {
              if (exp.id === expenseId) {
                const nextPaid = !exp.paid;
                return { ...exp, paid: nextPaid };
              }
              return exp;
            }),
          };
        }
        return e;
      })
    );
  }, [activeEvent]);

  // ---------------- TIMELINE & TASK ACTIONS ----------------
  const addTask = useCallback((taskData) => {
    if (!activeEvent) return;
    const newTask = {
      ...taskData,
      id: makeId('task'),
      completed: Boolean(taskData.completed),
      priority: taskData.priority || 'medium',
      dueDate: taskData.dueDate || activeEvent.date || '',
    };

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            tasks: [newTask, ...(e.tasks || [])],
          };
        }
        return e;
      })
    );
    showToast(`Added task "${newTask.title}"!`, 'success');
  }, [activeEvent, showToast]);

  /**
   * Bulk-add milestone tasks in a SINGLE state update (AI Milestone Planner
   * "Add Selected", future bulk flows). Ids are minted with makeId(), which
   * stays unique inside the same millisecond — the old pattern of looping
   * addTask minted identical `task-${Date.now()}` ids that duplicated React
   * keys and made toggle/delete hit every copy at once.
   * @returns {number} how many tasks were actually added.
   */
  const addTasks = useCallback((items) => {
    if (!activeEvent || !Array.isArray(items) || items.length === 0) return 0;

    const newTasks = items
      .filter((t) => t && typeof t === 'object' && String(t.title || '').trim())
      .map((t) => ({
        ...t,
        id: makeId('task'),
        completed: Boolean(t.completed),
        priority: t.priority || 'medium',
        dueDate: t.dueDate || activeEvent.date || '',
      }));

    if (newTasks.length === 0) return 0;

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return { ...e, tasks: [...newTasks, ...(e.tasks || [])] };
        }
        return e;
      })
    );
    showToast(`Added ${newTasks.length} milestone task${newTasks.length === 1 ? '' : 's'} to your timeline! ✨`, 'success');
    return newTasks.length;
  }, [activeEvent, showToast]);

  const updateTask = useCallback((taskId, updatedFields) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            tasks: (e.tasks || []).map((t) => (t.id === taskId ? { ...t, ...updatedFields } : t)),
          };
        }
        return e;
      })
    );
    showToast('Task updated.', 'success');
  }, [activeEvent, showToast]);

  const deleteTask = useCallback((taskId) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            tasks: (e.tasks || []).filter((t) => t.id !== taskId),
          };
        }
        return e;
      })
    );
    showToast('Task removed.', 'info');
  }, [activeEvent, showToast]);

  const toggleTaskComplete = useCallback((taskId) => {
    if (!activeEvent) return;
    let justCompleted = false;

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            tasks: (e.tasks || []).map((t) => {
              if (t.id === taskId) {
                const nextCompleted = !t.completed;
                if (nextCompleted) justCompleted = true;
                return { ...t, completed: nextCompleted };
              }
              return t;
            }),
          };
        }
        return e;
      })
    );

    if (justCompleted) {
      triggerConfetti();
      showToast('Milestone task completed! 🎉', 'success');
    }
  }, [activeEvent, triggerConfetti, showToast]);

  // ---------------- VENDOR ACTIONS ----------------
  const addVendor = useCallback((vendorData) => {
    if (!activeEvent) return;
    const newVendor = {
      ...vendorData,
      id: makeId('v'),
      cost: Number(vendorData.cost) || 0,
      status: vendorData.status || 'researching',
      rating: Number(vendorData.rating) || 5,
    };

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            vendors: [newVendor, ...(e.vendors || [])],
          };
        }
        return e;
      })
    );
    showToast(`Added vendor "${newVendor.name}"!`, 'success');
  }, [activeEvent, showToast]);

  const updateVendor = useCallback((vendorId, updatedFields) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            vendors: (e.vendors || []).map((v) => {
              if (v.id === vendorId) {
                return {
                  ...v,
                  ...updatedFields,
                  cost: updatedFields.cost !== undefined ? Number(updatedFields.cost) : v.cost,
                  rating: updatedFields.rating !== undefined ? Number(updatedFields.rating) : v.rating,
                };
              }
              return v;
            }),
          };
        }
        return e;
      })
    );
    showToast('Vendor updated.', 'success');
  }, [activeEvent, showToast]);

  const deleteVendor = useCallback((vendorId) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            vendors: (e.vendors || []).filter((v) => v.id !== vendorId),
          };
        }
        return e;
      })
    );
    showToast('Vendor removed.', 'info');
  }, [activeEvent, showToast]);

  const updateVendorStatus = useCallback((vendorId, status) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            vendors: (e.vendors || []).map((v) => (v.id === vendorId ? { ...v, status } : v)),
          };
        }
        return e;
      })
    );
    showToast(`Vendor status updated to ${status}!`, 'info');
  }, [activeEvent, showToast]);

  // ---------------- GUEST & RSVP ACTIONS ----------------
  // updateGuest stays silent on purpose: inline RSVP/plus-one/meal selects
  // fire it on every change and a toast per keystroke would be noise.

  const addGuest = useCallback((guestData) => {
    if (!activeEvent) return;
    const newGuest = {
      id: makeId('guest'),
      name: String(guestData.name || '').trim().slice(0, 200),
      email: String(guestData.email || '').trim().slice(0, 200),
      phone: String(guestData.phone || '').trim().slice(0, 60),
      group: guestData.group || 'friends',
      rsvp: guestData.rsvp || 'invited',
      plusOnes: Math.max(0, Math.min(10, Number(guestData.plusOnes) || 0)),
      meal: guestData.meal || 'standard',
      notes: String(guestData.notes || '').slice(0, 500),
    };
    if (!newGuest.name) return;

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return { ...e, guests: [newGuest, ...(e.guests || [])] };
        }
        return e;
      })
    );
    showToast(`Added ${newGuest.name} to the guest list!`, 'success');
  }, [activeEvent, showToast]);

  /** Bulk-add guests (CSV import) in ONE state update — mirrors addTasks. */
  const addGuests = useCallback((items) => {
    if (!activeEvent || !Array.isArray(items) || items.length === 0) return 0;

    const newGuests = items
      .filter((g) => g && typeof g === 'object' && String(g.name || '').trim())
      .map((g) => ({
        id: makeId('guest'),
        name: String(g.name).trim().slice(0, 200),
        email: String(g.email || '').trim().slice(0, 200),
        phone: String(g.phone || '').trim().slice(0, 60),
        group: g.group || 'friends',
        rsvp: g.rsvp || 'invited',
        plusOnes: Math.max(0, Math.min(10, Number(g.plusOnes) || 0)),
        meal: g.meal || 'standard',
        notes: String(g.notes || '').slice(0, 500),
      }));

    if (newGuests.length === 0) return 0;

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return { ...e, guests: [...newGuests, ...(e.guests || [])] };
        }
        return e;
      })
    );
    showToast(`Imported ${newGuests.length} guest${newGuests.length === 1 ? '' : 's'}!`, 'success');
    return newGuests.length;
  }, [activeEvent, showToast]);

  const updateGuest = useCallback((guestId, updatedFields) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            guests: (e.guests || []).map((g) => {
              if (g.id !== guestId) return g;
              const next = { ...g, ...updatedFields };
              if (updatedFields.plusOnes !== undefined) {
                next.plusOnes = Math.max(0, Math.min(10, Number(updatedFields.plusOnes) || 0));
              }
              return next;
            }),
          };
        }
        return e;
      })
    );
  }, [activeEvent]);

  const deleteGuest = useCallback((guestId) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return { ...e, guests: (e.guests || []).filter((g) => g.id !== guestId) };
        }
        return e;
      })
    );
    showToast('Guest removed from the list.', 'info');
  }, [activeEvent, showToast]);

  /** Bulk delete selected guests (checkbox selection) in one update. */
  const deleteGuests = useCallback((ids) => {
    if (!activeEvent || !Array.isArray(ids) || ids.length === 0) return;
    const kill = new Set(ids);
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return { ...e, guests: (e.guests || []).filter((g) => !kill.has(g.id)) };
        }
        return e;
      })
    );
    showToast(`Removed ${ids.length} guest${ids.length === 1 ? '' : 's'} from the list.`, 'info');
  }, [activeEvent, showToast]);

  // ---------------- INVITATION ACTIONS ----------------

  /** Save (or replace) the AI-generated invitation copy for the event. */
  const saveInvitation = useCallback((invitation) => {
    if (!activeEvent) return;
    const cleaned = {
      headline: String(invitation?.headline || '').slice(0, 200),
      message: String(invitation?.message || '').slice(0, 2_000),
      signOff: String(invitation?.signOff || '').slice(0, 120),
      rsvpDeadline: /^\d{4}-\d{2}-\d{2}$/.test(invitation?.rsvpDeadline || '') ? invitation.rsvpDeadline : '',
      generatedAt: invitation?.generatedAt || new Date().toISOString(),
      source: String(invitation?.source || 'ai').slice(0, 40),
    };
    if (!cleaned.message.trim()) {
      showToast('Add a message before saving the invitation.', 'info');
      return;
    }

    setEvents((prev) =>
      prev.map((e) => (e.id === activeEvent.id ? { ...e, invitation: cleaned } : e))
    );
    showToast('Invitation saved to this celebration! 💌', 'success');
  }, [activeEvent, showToast]);

  // ---------------- PHOTO MEMORY WALL ACTIONS ----------------

  /**
   * Bulk-add photo metadata (data URLs already downscaled + validated by
   * photoService). Enforces the per-event cap so localStorage stays healthy.
   * @returns {number} how many photos were actually added.
   */
  const addPhotos = useCallback((metas) => {
    if (!activeEvent || !Array.isArray(metas) || metas.length === 0) return 0;

    const valid = metas
      .map((m) => {
        const dataUrl = validatePhotoDataUrl(m?.dataUrl);
        if (!dataUrl) return null;
        return {
          id: makeId('photo'),
          dataUrl,
          caption: String(m.caption || '').slice(0, 200),
          album: m.album || 'candids',
          favorite: Boolean(m.favorite),
          createdAt: m.createdAt || new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (valid.length === 0) return 0;

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          const room = Math.max(0, MAX_PHOTOS_PER_EVENT - (e.photos?.length || 0));
          const accepted = valid.slice(0, room);
          return { ...e, photos: [...(e.photos || []), ...accepted] };
        }
        return e;
      })
    );
    const added = Math.min(valid.length, Math.max(0, MAX_PHOTOS_PER_EVENT - (activeEvent.photos?.length || 0)));
    if (added > 0) {
      showToast(`Added ${added} photo${added === 1 ? '' : 's'} to the memory wall! 📸`, 'success');
    }
    if (valid.length > added) {
      showToast(`Photo wall is full (${MAX_PHOTOS_PER_EVENT} max) — ${valid.length - added} not added.`, 'info');
    }
    return added;
  }, [activeEvent, showToast]);

  const updatePhoto = useCallback((photoId, updatedFields) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            photos: (e.photos || []).map((p) => (p.id === photoId ? { ...p, ...updatedFields } : p)),
          };
        }
        return e;
      })
    );
  }, [activeEvent]);

  const deletePhoto = useCallback((photoId) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return { ...e, photos: (e.photos || []).filter((p) => p.id !== photoId) };
        }
        return e;
      })
    );
    showToast('Photo removed from the wall.', 'info');
  }, [activeEvent, showToast]);

  // ---------------- APPLY THEME TO EVENT ----------------
  const applyThemeToEvent = useCallback((theme) => {
    if (!activeEvent) return;

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          // Append theme decor highlights as suggestions to tasks if requested
          const decorTasks = (theme.decorHighlights || []).map((highlight) => ({
            id: makeId('task-theme'),
            title: `Theme Decor: ${highlight}`,
            phase: 'mid',
            category: 'decoration',
            dueDate: e.date || '',
            priority: 'medium',
            completed: false,
            notes: `Inspired by theme "${theme.name}"`
          }));

          return {
            ...e,
            themeName: theme.name,
            themeTagline: theme.tagline,
            themeColor: theme.palette?.[0] || '#8b5cf6',
            palette: theme.palette,
            paletteNames: theme.paletteNames,
            tasks: [...(e.tasks || []), ...decorTasks],
            notes: (e.notes ? e.notes + '\n\n' : '') + `Theme: ${theme.name} (${theme.tagline})\nMusic recommendation: ${theme.recommendedMusic || 'N/A'}\nCatering ideas: ${theme.cateringIdeas || 'N/A'}`
          };
        }
        return e;
      })
    );

    triggerConfetti();
    showToast(`Theme "${theme.name}" applied with decor milestones added! ✨`, 'success');
  }, [activeEvent, showToast, triggerConfetti]);

  // Memoized export/import wrappers so the context value stays referentially
  // stable between renders (all other actions are already useCallback'd).
  const exportEventsData = useCallback(() => storageService.exportData(), []);
  const importEventsData = useCallback(
    (jsonStr) => {
      const res = storageService.importData(jsonStr);
      if (res.success) {
        setEvents(sanitizeEvents(res.events));
        setActiveEventIdState(res.events[0].id);
        showToast('Events successfully imported!', 'success');
        triggerConfetti();
      }
      return res;
    },
    [showToast, triggerConfetti]
  );

  // Context value — memoized so consumers only re-render when state changes.
  const value = useMemo(
    () => ({
      events,
      activeEventId,
      activeEvent,
      setActiveEventId,
      apiKey,
      setApiKey,
      toast,
      showToast,
      triggerConfetti,
      // Event CRUD
      addEvent,
      updateEvent,
      deleteEvent,
      duplicateEvent,
      resetAllToSampleData,
      exportEventsData,
      importEventsData,
      // Budget & Expense CRUD
      addExpense,
      updateExpense,
      deleteExpense,
      toggleExpensePaid,
      // Timeline & Tasks CRUD
      addTask,
      addTasks,
      updateTask,
      deleteTask,
      toggleTaskComplete,
      // Vendor CRUD
      addVendor,
      updateVendor,
      deleteVendor,
      updateVendorStatus,
      // Guest & RSVP CRUD
      addGuest,
      addGuests,
      updateGuest,
      deleteGuest,
      deleteGuests,
      // Invitation
      saveInvitation,
      // Photo memory wall
      addPhotos,
      updatePhoto,
      deletePhoto,
      // AI Theme Application
      applyThemeToEvent,
    }),
    [
      events,
      activeEventId,
      activeEvent,
      setActiveEventId,
      apiKey,
      setApiKey,
      toast,
      showToast,
      triggerConfetti,
      addEvent,
      updateEvent,
      deleteEvent,
      duplicateEvent,
      resetAllToSampleData,
      exportEventsData,
      importEventsData,
      addExpense,
      updateExpense,
      deleteExpense,
      toggleExpensePaid,
      addTask,
      addTasks,
      updateTask,
      deleteTask,
      toggleTaskComplete,
      addVendor,
      updateVendor,
      deleteVendor,
      updateVendorStatus,
      addGuest,
      addGuests,
      updateGuest,
      deleteGuest,
      deleteGuests,
      saveInvitation,
      addPhotos,
      updatePhoto,
      deletePhoto,
      applyThemeToEvent,
    ]
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
};

export const useEventContext = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEventContext must be used within an EventProvider');
  }
  return context;
};
