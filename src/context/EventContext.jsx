import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { storageService } from '../services/storageService';
import { INITIAL_EVENTS } from '../data/defaultData';
import { makeId, sanitizeEvents } from '../utils/ids';
import { MAX_PHOTOS_PER_EVENT, validatePhotoDataUrl } from '../lib/photos/photoModel';
import { seatWeight } from '../lib/planning/seating';
import { recordEdit, computeUndo, computeRedo, summarizeHistory } from '../lib/history/historyStack';
import { normalizeGift, claimGift } from '../lib/gifts/giftModel';
import { normalizeQuote, acceptQuoteFields, MAX_QUOTES_PER_VENDOR } from '../lib/vendors/quoteModel';
import { MAX_TILES } from '../lib/moodboard/moodModel';
import { setCurrencyConfig as applyCurrencySingleton, formatMoney } from '../lib/currency/currencyModel';

const EventContext = createContext(null);

export const EventProvider = ({ children }) => {
  // Sanitize on load: heals any data written by the old same-millisecond
  // id bug (duplicate task/vendor/expense ids) so list keys and by-id
  // mutations are always unique. Persisted back by the sync effect below.
  const [events, setEvents] = useState(() => sanitizeEvents(storageService.getEvents()));
  const [activeEventId, setActiveEventIdState] = useState(() => storageService.getActiveEventId());
  const [apiKey, setApiKeyState] = useState(() => storageService.getApiKey());
  // Display currency — hydrated into the formatters singleton BEFORE children
  // render, so every formatCurrency() call is already currency-aware.
  const [currencyConfig, setCurrencyConfigState] = useState(() => {
    const stored = storageService.getCurrency();
    applyCurrencySingleton(stored);
    return stored;
  });
  const [toast, setToast] = useState(null);
  const quotaWarnedRef = useRef(false);

  // Show Toast — declared before the effects that use it (React Compiler
  // flags access-before-declaration inside effect closures).
  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 3800);
  }, []);

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
    // Deliberately syncs on [events] only — showToast is a stable useCallback.
  }, [events]);

  // Save API key
  const setApiKey = useCallback((key) => {
    setApiKeyState(key);
    storageService.saveApiKey(key);
  }, []);

  // Sync active event ID
  const setActiveEventId = useCallback((id) => {
    setActiveEventIdState(id);
    storageService.saveActiveEventId(id);
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

  // ---------------- UNDO / REDO HISTORY ----------------
  // Snapshot-based: state updates never mutate, so storing the previous
  // `events` array reference is a complete, O(1) undo point. One effect
  // covers every action (all ~45 of them funnel through setEvents) without
  // touching a single one. History navigation sets a skip flag so restoring
  // a snapshot is not itself recorded as a brand-new edit.
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const historySkipRef = useRef(false);
  const prevEventsRef = useRef(events); // last committed value
  const [historyMeta, setHistoryMeta] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    const before = prevEventsRef.current;
    if (before === events) return; // no change (also makes StrictMode re-runs inert)
    prevEventsRef.current = events;
    if (historySkipRef.current) {
      historySkipRef.current = false; // we just navigated history — not an edit
    } else {
      const next = recordEdit(
        { undoStack: undoStackRef.current, redoStack: redoStackRef.current },
        before
      );
      undoStackRef.current = next.undoStack;
      redoStackRef.current = next.redoStack;
    }
    setHistoryMeta(
      summarizeHistory({ undoStack: undoStackRef.current, redoStack: redoStackRef.current })
    );
  }, [events]);

  const undo = useCallback(() => {
    const step = computeUndo(
      { undoStack: undoStackRef.current, redoStack: redoStackRef.current },
      events
    );
    if (!step) {
      showToast('Nothing to undo yet — make a change first.', 'info');
      return;
    }
    undoStackRef.current = step.undoStack;
    redoStackRef.current = step.redoStack;
    historySkipRef.current = true;
    setEvents(step.next);
    setHistoryMeta(summarizeHistory({ undoStack: step.undoStack, redoStack: step.redoStack }));
    showToast('Undid your last change.', 'info');
  }, [events, showToast]);

  const redo = useCallback(() => {
    const step = computeRedo(
      { undoStack: undoStackRef.current, redoStack: redoStackRef.current },
      events
    );
    if (!step) {
      showToast('Nothing to redo — your history is up to date.', 'info');
      return;
    }
    undoStackRef.current = step.undoStack;
    redoStackRef.current = step.redoStack;
    historySkipRef.current = true;
    setEvents(step.next);
    setHistoryMeta(summarizeHistory({ undoStack: step.undoStack, redoStack: step.redoStack }));
    showToast('Redid the change.', 'info');
  }, [events, showToast]);

  // ---------------- DISPLAY CURRENCY ----------------
  const setDisplayCurrency = useCallback(
    (config) => {
      const normalized = storageService.saveCurrency(config);
      applyCurrencySingleton(normalized);
      setCurrencyConfigState(normalized);
      showToast(`Money now displays in ${normalized.code}.`, 'success');
    },
    [showToast]
  );

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
      seating: { tables: eventData.seating?.tables || [] },
      payments: eventData.payments || [],
      runSheet: eventData.runSheet || [],
      agentRuns: [],
      gifts: eventData.gifts || [],
      moodboard: { tiles: eventData.moodboard?.tiles || [] },
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
    // Guest ids are re-minted below, so seat assignments must follow the map.
    const guestIdMap = new Map((source.guests || []).map((g) => [g.id, makeId('guest')]));
    const duplicated = {
      ...source,
      id: dupId,
      title: `${source.title} (Copy)`,
      createdAt: new Date().toISOString(),
      expenses: source.expenses ? source.expenses.map((exp) => ({ ...exp, id: makeId('exp') })) : [],
      tasks: source.tasks ? source.tasks.map((t) => ({ ...t, id: makeId('task'), completed: false })) : [],
      vendors: source.vendors
        ? source.vendors.map((v) => ({
            ...v,
            id: makeId('v'),
            quotes: (v.quotes || []).map((q) => ({ ...q, id: makeId('quote') })),
          }))
        : [],
      guests: (source.guests || []).map((g) => ({ ...g, id: guestIdMap.get(g.id) || makeId('guest') })),
      gifts: (source.gifts || []).map((g) => ({ ...g, id: makeId('gift') })),
      moodboard: {
        tiles: (source.moodboard?.tiles || []).map((t) => ({ ...t, id: makeId('tile') })),
      },
      invitation: source.invitation ? { ...source.invitation } : null,
      photos: (source.photos || []).map((p) => ({ ...p, id: makeId('photo') })),
      seating: {
        tables: (source.seating?.tables || []).map((t) => ({
          ...t,
          id: makeId('table'),
          seats: (t.seats || []).map((id) => guestIdMap.get(id)).filter(Boolean),
        })),
      },
      payments: (source.payments || []).map((p) => ({ ...p, id: makeId('pay') })),
      runSheet: (source.runSheet || []).map((r) => ({ ...r, id: makeId('run') })),
      agentRuns: [],
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

  // ---------------- VENDOR QUOTE ACTIONS ----------------
  // Quotes live inside their vendor (comparison across vendors happens in
  // buildCategoryComparison); the per-vendor cap guards storage health.

  const addVendorQuote = useCallback(
    (vendorId, quoteData) => {
      if (!activeEvent) return false;
      const quote = normalizeQuote(quoteData);
      if (!quote) {
        showToast('Quotes need a valid amount.', 'info');
        return false;
      }
      const finalQuote = { ...quote, id: quote.id || makeId('quote') };
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== activeEvent.id) return e;
          return {
            ...e,
            vendors: (e.vendors || []).map((v) => {
              if (v.id !== vendorId) return v;
              const quotes = [...(v.quotes || []), finalQuote];
              return {
                ...v,
                quotes: quotes.length > MAX_QUOTES_PER_VENDOR ? quotes.slice(1) : quotes,
              };
            }),
          };
        })
      );
      showToast(`Quote from "${finalQuote.company}" added (${formatMoney(finalQuote.amount)}).`, 'success');
      return true;
    },
    [activeEvent, showToast]
  );

  const deleteVendorQuote = useCallback(
    (vendorId, quoteId) => {
      if (!activeEvent) return;
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== activeEvent.id) return e;
          return {
            ...e,
            vendors: (e.vendors || []).map((v) =>
              v.id === vendorId ? { ...v, quotes: (v.quotes || []).filter((q) => q.id !== quoteId) } : v
            ),
          };
        })
      );
      showToast('Quote removed.', 'info');
    },
    [activeEvent, showToast]
  );

  /**
   * Accept a quote: syncs the vendor's cost to the quote amount, flips the
   * vendor to booked, and prepends an audit line to the vendor notes.
   */
  const acceptVendorQuote = useCallback(
    (vendorId, quoteId) => {
      if (!activeEvent) return;
      const vendor = (activeEvent.vendors || []).find((v) => v.id === vendorId);
      const quote = (vendor?.quotes || []).find((q) => q.id === quoteId);
      const fields = vendor && quote ? acceptQuoteFields(vendor, quote) : null;
      if (!fields) {
        showToast('Could not accept that quote.', 'error');
        return;
      }
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== activeEvent.id) return e;
          return {
            ...e,
            vendors: (e.vendors || []).map((v) => (v.id === vendorId ? { ...v, ...fields } : v)),
          };
        })
      );
      showToast(
        `Accepted "${quote.company || vendor.name}" at ${formatMoney(fields.cost)} — vendor booked.`,
        'success'
      );
    },
    [activeEvent, showToast]
  );

  // ---------------- GIFT REGISTRY ACTIONS ----------------

  /** Normalize + id-mint a gift record; null when the name is missing. */
  const normalizeGiftRecord = useCallback((raw) => {
    const normalized = normalizeGift(raw);
    return normalized ? { ...normalized, id: normalized.id || makeId('gift') } : null;
  }, []);

  const addGift = useCallback(
    (giftData) => {
      if (!activeEvent) return false;
      const gift = normalizeGiftRecord(giftData);
      if (!gift) {
        showToast('Give the registry item a name first.', 'info');
        return false;
      }
      setEvents((prev) =>
        prev.map((e) => (e.id === activeEvent.id ? { ...e, gifts: [gift, ...(e.gifts || [])] } : e))
      );
      showToast(`Added "${gift.name}" to the registry!`, 'success');
      return true;
    },
    [activeEvent, normalizeGiftRecord, showToast]
  );

  const updateGift = useCallback(
    (giftId, fields) => {
      if (!activeEvent) return;
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== activeEvent.id) return e;
          return {
            ...e,
            gifts: (e.gifts || []).map((g) => {
              if (g.id !== giftId) return g;
              const merged = normalizeGift({ ...g, ...fields });
              // A field wipe that kills the name is ignored — keep the original.
              return merged ? { ...merged, id: g.id } : g;
            }),
          };
        })
      );
      showToast('Registry item updated.', 'success');
    },
    [activeEvent, showToast]
  );

  const deleteGift = useCallback(
    (giftId) => {
      if (!activeEvent) return;
      setEvents((prev) =>
        prev.map((e) =>
          e.id === activeEvent.id ? { ...e, gifts: (e.gifts || []).filter((g) => g.id !== giftId) } : e
        )
      );
      showToast('Registry item removed.', 'info');
    },
    [activeEvent, showToast]
  );

  /**
   * Claim a gift for a guest ({ id, name }) or release it (guest === null).
   * The name is snapshotted so deleting the guest later never corrupts rows.
   */
  const claimGiftForGuest = useCallback(
    (giftId, guest) => {
      if (!activeEvent) return;
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== activeEvent.id) return e;
          return {
            ...e,
            gifts: (e.gifts || []).map((g) => {
              if (g.id !== giftId) return g;
              if (!guest) {
                return g.status === 'purchased' ? g : { ...g, status: 'available', claimedByGuestId: '', claimedByName: '' };
              }
              const claimed = claimGift(g, { guestId: guest.id, guestName: guest.name });
              return claimed === g ? g : { ...claimed, id: g.id };
            }),
          };
        })
      );
      if (guest) {
        showToast(`${guest.name} claimed this gift.`, 'success');
      } else {
        showToast('Claim released — the gift is available again.', 'info');
      }
    },
    [activeEvent, showToast]
  );

  // ---------------- MOOD BOARD ACTIONS ----------------
  // The board is one ordered tile array; the pure module validates each tile
  // (strict hex, http(s)-only image URLs, note caps) before it ever lands.

  const setMoodTiles = useCallback(
    (tiles) => {
      if (!activeEvent || !Array.isArray(tiles) || tiles.length > MAX_TILES) return false;
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== activeEvent.id) return e;
          const board = { ...(e.moodboard || {}), tiles };
          return { ...e, moodboard: board };
        })
      );
      return true;
    },
    [activeEvent]
  );

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

  /** Bulk-set the RSVP status of selected guests in one update. */
  const setGuestsRsvp = useCallback((ids, rsvp) => {
    if (!activeEvent || !Array.isArray(ids) || ids.length === 0) return;
    const valid = ['invited', 'attending', 'maybe', 'declined'].includes(rsvp) ? rsvp : null;
    if (!valid) return;
    const targets = new Set(ids);
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          return {
            ...e,
            guests: (e.guests || []).map((g) => (targets.has(g.id) ? { ...g, rsvp: valid } : g)),
          };
        }
        return e;
      })
    );
    showToast(`Marked ${ids.length} guest${ids.length === 1 ? '' : 's'} as "${valid}".`, 'info');
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

  // ---------------- SEATING CHART ACTIONS ----------------

  /** Mutate the active event's seating tables in one state update. */
  const mutateTables = useCallback((mapFn) => {
    if (!activeEvent) return null;
    let result = null;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEvent.id) return e;
        const nextTables = mapFn(e.seating?.tables || []);
        result = nextTables;
        return { ...e, seating: { tables: nextTables } };
      })
    );
    return result;
  }, [activeEvent]);

  const addTable = useCallback((data) => {
    if (!activeEvent) return;
    const table = {
      id: makeId('table'),
      name: String(data?.name || 'New Table').trim().slice(0, 60) || 'New Table',
      capacity: Math.max(1, Math.min(50, Math.round(Number(data?.capacity) || 8))),
      seats: [],
    };
    mutateTables((tables) => [...tables, table]);
    showToast(`Added "${table.name}" (${table.capacity} seats).`, 'success');
  }, [activeEvent, mutateTables, showToast]);

  const updateTable = useCallback((tableId, fields) => {
    if (!activeEvent) return;
    mutateTables((tables) =>
      tables.map((t) =>
        t.id === tableId
          ? {
              ...t,
              ...fields,
              name: fields.name !== undefined ? String(fields.name).slice(0, 60) : t.name,
              capacity:
                fields.capacity !== undefined
                  ? Math.max(1, Math.min(50, Math.round(Number(fields.capacity) || 8)))
                  : t.capacity,
            }
          : t
      )
    );
  }, [activeEvent, mutateTables]);

  const deleteTable = useCallback((tableId) => {
    if (!activeEvent) return;
    mutateTables((tables) => tables.filter((t) => t.id !== tableId));
    showToast('Table removed — its guests return to the unseated pool.', 'info');
  }, [activeEvent, mutateTables, showToast]);

  /** Current seat usage per table entry (attending guests only, weighted). */
  const tableUsage = useCallback((tables, guests) => {
    const byId = new Map((guests || []).map((g) => [g.id, g]));
    return new Map(
      (tables || []).map((t) => [
        t.id,
        (t.seats || []).reduce((sum, id) => {
          const g = byId.get(id);
          return sum + (g && g.rsvp === 'attending' ? seatWeight(g) : 0);
        }, 0),
      ])
    );
  }, []);

  /** Seat one guest at a table — moves them off any other table first. */
  const assignSeat = useCallback((tableId, guestId) => {
    if (!activeEvent) return;
    const guests = activeEvent.guests || [];
    const guest = guests.find((g) => g.id === guestId);
    if (!guest || guest.rsvp !== 'attending') return;
    const tables = activeEvent.seating?.tables || [];
    const target = tables.find((t) => t.id === tableId);
    if (!target) return;

    const usage = tableUsage(tables, guests);
    const currentUsage = usage.get(tableId) || 0;
    const alreadyHere = (target.seats || []).includes(guestId);
    const weight = seatWeight(guest);
    const freedElsewhere = tables.some((t) => t.id !== tableId && (t.seats || []).includes(guestId));
    const projected = alreadyHere ? currentUsage : currentUsage + weight;
    if (projected > target.capacity) {
      showToast(`"${target.name}" is full — ${target.capacity - currentUsage} seat(s) free, ${guest.name} needs ${weight}.`, 'info');
      return;
    }

    mutateTables((list) =>
      list.map((t) => {
        if (t.id === tableId) {
          if (alreadyHere) return t;
          return { ...t, seats: [...(t.seats || []), guestId] };
        }
        return { ...t, seats: (t.seats || []).filter((id) => id !== guestId) };
      })
    );
    if (!alreadyHere && !freedElsewhere) {
      showToast(`Seated ${guest.name} at ${target.name}.`, 'success');
    }
  }, [activeEvent, mutateTables, showToast, tableUsage]);

  const unassignSeat = useCallback((guestId) => {
    if (!activeEvent) return;
    mutateTables((tables) =>
      tables.map((t) => ({ ...t, seats: (t.seats || []).filter((id) => id !== guestId) }))
    );
  }, [activeEvent, mutateTables]);

  const clearTableSeats = useCallback((tableId) => {
    if (!activeEvent) return;
    mutateTables((tables) => tables.map((t) => (t.id === tableId ? { ...t, seats: [] } : t)));
  }, [activeEvent, mutateTables]);

  /**
   * Bulk-apply agent (or auto-arrange) assignments: [{ tableId, guestIds }].
   * Replaces all existing seats in one update; capacity is enforced by
   * dropping overflow parties (server already did this, but belt & braces).
   * @returns {number} guests actually seated.
   */
  const applySeatingAssignments = useCallback((assignments) => {
    if (!activeEvent || !Array.isArray(assignments)) return 0;
    const guests = activeEvent.guests || [];
    const byId = new Map(guests.map((g) => [g.id, g]));
    const seatable = new Set(guests.filter((g) => g.rsvp === 'attending').map((g) => g.id));
    const seatMap = new Map(); // guestId -> tableId
    const tableLoad = new Map();

    for (const a of assignments) {
      const table = (activeEvent.seating?.tables || []).find((t) => t.id === a?.tableId);
      if (!table) continue;
      let used = tableLoad.get(table.id) || 0;
      for (const gid of Array.isArray(a.guestIds) ? a.guestIds : []) {
        const g = byId.get(gid);
        if (!g || !seatable.has(gid) || seatMap.has(gid)) continue;
        const w = seatWeight(g);
        if (used + w > table.capacity) continue;
        seatMap.set(gid, table.id);
        used += w;
      }
      tableLoad.set(table.id, used);
    }

    mutateTables((tables) =>
      tables.map((t) => ({
        ...t,
        seats: [...seatMap.entries()].filter(([, tid]) => tid === t.id).map(([gid]) => gid),
      }))
    );

    const seated = seatMap.size;
    if (seated > 0) {
      showToast(`Seating applied — ${seated} guest ${seated === 1 ? 'party' : 'parties'} seated.`, 'success');
    }
    return seated;
  }, [activeEvent, mutateTables, showToast]);

  // ---------------- PAYMENT LEDGER ACTIONS ----------------

  const normalizePayment = useCallback((p, fallbackDate) => ({
    id: p.id || makeId('pay'),
    label: String(p.label || 'Payment').trim().slice(0, 140) || 'Payment',
    vendorName: String(p.vendorName || '').trim().slice(0, 80),
    amount: Math.max(0, Math.round(Number(p.amount) || 0)),
    kind: ['deposit', 'balance', 'milestone', 'final'].includes(p.kind) ? p.kind : 'milestone',
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) ? p.dueDate : fallbackDate,
    paid: Boolean(p.paid),
    paidDate: /^\d{4}-\d{2}-\d{2}$/.test(p.paidDate) ? p.paidDate : '',
    notes: String(p.notes || '').slice(0, 300),
    source: p.source === 'agent' ? 'agent' : 'manual',
  }), []);

  const addPayment = useCallback((data) => {
    if (!activeEvent) return;
    const payment = normalizePayment(data, activeEvent.date || new Date().toISOString().slice(0, 10));
    setEvents((prev) =>
      prev.map((e) => (e.id === activeEvent.id ? { ...e, payments: [payment, ...(e.payments || [])] } : e))
    );
    showToast(`Added payment "${payment.label}".`, 'success');
  }, [activeEvent, normalizePayment, showToast]);

  const updatePayment = useCallback((paymentId, fields) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEvent.id) return e;
        return {
          ...e,
          payments: (e.payments || []).map((p) => (p.id === paymentId ? normalizePayment({ ...p, ...fields }, activeEvent.date) : p)),
        };
      })
    );
    showToast('Payment updated.', 'success');
  }, [activeEvent, normalizePayment, showToast]);

  const deletePayment = useCallback((paymentId) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEvent.id) return e;
        return { ...e, payments: (e.payments || []).filter((p) => p.id !== paymentId) };
      })
    );
    showToast('Payment removed from the ledger.', 'info');
  }, [activeEvent, showToast]);

  const togglePaymentPaid = useCallback((paymentId) => {
    if (!activeEvent) return;
    const today = new Date().toISOString().slice(0, 10);
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEvent.id) return e;
        return {
          ...e,
          payments: (e.payments || []).map((p) =>
            p.id === paymentId ? { ...p, paid: !p.paid, paidDate: !p.paid ? today : '' } : p
          ),
        };
      })
    );
  }, [activeEvent]);

  /**
   * Agent output lands here: replaces previous agent-generated milestones,
   * preserving anything the host added by hand (source !== 'agent').
   * @returns {number} milestones written.
   */
  const applyAgentPayments = useCallback((payments) => {
    if (!activeEvent || !Array.isArray(payments) || payments.length === 0) return 0;
    const fallbackDate = activeEvent.date || new Date().toISOString().slice(0, 10);
    const generated = payments.map((p) => normalizePayment({ ...p, source: 'agent', paid: false, paidDate: '' }, fallbackDate));
    if (generated.length === 0) return 0;

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEvent.id) return e;
        const manual = (e.payments || []).filter((p) => p.source !== 'agent');
        const sorted = [...generated, ...manual].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        return { ...e, payments: sorted };
      })
    );
    showToast(`Payment schedule written — ${generated.length} milestones (manual entries kept).`, 'success');
    return generated.length;
  }, [activeEvent, normalizePayment, showToast]);

  // ---------------- DAY-OF RUN SHEET ACTIONS ----------------

  const normalizeRunItem = useCallback((r) => ({
    id: r.id || makeId('run'),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ? r.time : '',
    durationMin: Math.max(5, Math.min(240, Math.round(Number(r.durationMin) || 15))),
    activity: String(r.activity || 'Untitled cue').trim().slice(0, 200) || 'Untitled cue',
    owner: String(r.owner || 'Host').trim().slice(0, 80) || 'Host',
    notes: String(r.notes || '').slice(0, 300),
    done: Boolean(r.done),
    source: r.source === 'agent' ? 'agent' : 'manual',
  }), []);

  const addRunSheetItem = useCallback((data) => {
    if (!activeEvent) return;
    const item = normalizeRunItem(data);
    setEvents((prev) =>
      prev.map((e) => (e.id === activeEvent.id ? { ...e, runSheet: [...(e.runSheet || []), item] } : e))
    );
    showToast(`Added "${item.activity}" to the run sheet.`, 'success');
  }, [activeEvent, normalizeRunItem, showToast]);

  const updateRunSheetItem = useCallback((itemId, fields) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEvent.id) return e;
        return {
          ...e,
          runSheet: (e.runSheet || []).map((r) => (r.id === itemId ? normalizeRunItem({ ...r, ...fields }) : r)),
        };
      })
    );
    showToast('Run-sheet cue updated.', 'success');
  }, [activeEvent, normalizeRunItem, showToast]);

  const deleteRunSheetItem = useCallback((itemId) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEvent.id) return e;
        return { ...e, runSheet: (e.runSheet || []).filter((r) => r.id !== itemId) };
      })
    );
    showToast('Cue removed.', 'info');
  }, [activeEvent, showToast]);

  const toggleRunSheetItemDone = useCallback((itemId) => {
    if (!activeEvent) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEvent.id) return e;
        return {
          ...e,
          runSheet: (e.runSheet || []).map((r) => (r.id === itemId ? { ...r, done: !r.done } : r)),
        };
      })
    );
  }, [activeEvent]);

  /** Agent output: replace agent-sourced cues, keep manual ones. */
  const applyAgentRunSheet = useCallback((items) => {
    if (!activeEvent || !Array.isArray(items) || items.length === 0) return 0;
    const generated = items.map((r) => normalizeRunItem({ ...r, done: false, source: 'agent' }));
    if (generated.length === 0) return 0;

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEvent.id) return e;
        const manual = (e.runSheet || []).filter((r) => r.source !== 'agent');
        const sorted = [...generated, ...manual].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
        return { ...e, runSheet: sorted };
      })
    );
    showToast(`Run sheet written — ${generated.length} cues (manual cues kept).`, 'success');
    return generated.length;
  }, [activeEvent, normalizeRunItem, showToast]);

  // ---------------- AGENT FORCE RUN LOG ----------------

  /** Append one agent run to the event's history (capped at 20). */
  const logAgentRun = useCallback((run) => {
    if (!activeEvent) return;
    const entry = {
      id: makeId('agentrun'),
      agentId: String(run?.agentId || '').slice(0, 40),
      agentName: String(run?.agentName || 'Agent').slice(0, 80),
      status: run?.status === 'error' ? 'error' : 'done',
      source: run?.source === 'live-ai' ? 'live-ai' : 'local-ai-engine',
      summary: String(run?.summary || '').slice(0, 400),
      artifact: String(run?.artifact || '').slice(0, 200),
      at: new Date().toISOString(),
    };
    setEvents((prev) =>
      prev.map((e) => (e.id === activeEvent.id ? { ...e, agentRuns: [entry, ...(e.agentRuns || [])].slice(0, 20) } : e))
    );
  }, [activeEvent]);

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
      // Undo / redo history
      historyMeta,
      undo,
      redo,
      // Display currency
      currencyConfig,
      setDisplayCurrency,
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
      // Vendor quotes
      addVendorQuote,
      deleteVendorQuote,
      acceptVendorQuote,
      // Gift registry
      addGift,
      updateGift,
      deleteGift,
      claimGiftForGuest,
      // Mood board
      setMoodTiles,
      // Guest & RSVP CRUD
      addGuest,
      addGuests,
      updateGuest,
      deleteGuest,
      deleteGuests,
      setGuestsRsvp,
      // Invitation
      saveInvitation,
      // Photo memory wall
      addPhotos,
      updatePhoto,
      deletePhoto,
      // Seating chart
      addTable,
      updateTable,
      deleteTable,
      assignSeat,
      unassignSeat,
      clearTableSeats,
      applySeatingAssignments,
      // Payment ledger
      addPayment,
      updatePayment,
      deletePayment,
      togglePaymentPaid,
      applyAgentPayments,
      // Day-of run sheet
      addRunSheetItem,
      updateRunSheetItem,
      deleteRunSheetItem,
      toggleRunSheetItemDone,
      applyAgentRunSheet,
      // Agent Force run log
      logAgentRun,
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
      historyMeta,
      undo,
      redo,
      currencyConfig,
      setDisplayCurrency,
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
      addVendorQuote,
      deleteVendorQuote,
      acceptVendorQuote,
      addGift,
      updateGift,
      deleteGift,
      claimGiftForGuest,
      setMoodTiles,
      addGuest,
      addGuests,
      updateGuest,
      deleteGuest,
      deleteGuests,
      setGuestsRsvp,
      saveInvitation,
      addPhotos,
      updatePhoto,
      deletePhoto,
      addTable,
      updateTable,
      deleteTable,
      assignSeat,
      unassignSeat,
      clearTableSeats,
      applySeatingAssignments,
      addPayment,
      updatePayment,
      deletePayment,
      togglePaymentPaid,
      applyAgentPayments,
      addRunSheetItem,
      updateRunSheetItem,
      deleteRunSheetItem,
      toggleRunSheetItemDone,
      applyAgentRunSheet,
      logAgentRun,
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
