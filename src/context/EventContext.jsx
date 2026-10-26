import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { storageService } from '../services/storageService';
import { INITIAL_EVENTS } from '../data/defaultData';

const EventContext = createContext(null);

export const EventProvider = ({ children }) => {
  const [events, setEvents] = useState(() => storageService.getEvents());
  const [activeEventId, setActiveEventIdState] = useState(() => storageService.getActiveEventId());
  const [apiKey, setApiKeyState] = useState(() => storageService.getApiKey());
  const [toast, setToast] = useState(null);

  // Sync events to localStorage
  useEffect(() => {
    storageService.saveEvents(events);
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
    const newId = `event-${Date.now()}`;
    const newEvent = {
      ...eventData,
      id: newId,
      createdAt: new Date().toISOString(),
      expenses: eventData.expenses || [],
      tasks: eventData.tasks || [],
      vendors: eventData.vendors || [],
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

    const dupId = `event-${Date.now()}`;
    const duplicated = {
      ...source,
      id: dupId,
      title: `${source.title} (Copy)`,
      createdAt: new Date().toISOString(),
      expenses: source.expenses ? source.expenses.map(exp => ({ ...exp, id: `exp-${Date.now()}-${Math.random()}` })) : [],
      tasks: source.tasks ? source.tasks.map(t => ({ ...t, id: `task-${Date.now()}-${Math.random()}`, completed: false })) : [],
      vendors: source.vendors ? source.vendors.map(v => ({ ...v, id: `v-${Date.now()}-${Math.random()}` })) : [],
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
      id: `exp-${Date.now()}`,
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
      id: `task-${Date.now()}`,
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
      id: `v-${Date.now()}`,
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

  // ---------------- APPLY THEME TO EVENT ----------------
  const applyThemeToEvent = useCallback((theme) => {
    if (!activeEvent) return;

    setEvents((prev) =>
      prev.map((e) => {
        if (e.id === activeEvent.id) {
          // Append theme decor highlights as suggestions to tasks if requested
          const decorTasks = (theme.decorHighlights || []).map((highlight, idx) => ({
            id: `task-theme-${Date.now()}-${idx}`,
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

  // Context value
  const value = {
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
    exportEventsData: () => storageService.exportData(),
    importEventsData: (jsonStr) => {
      const res = storageService.importData(jsonStr);
      if (res.success) {
        setEvents(res.events);
        setActiveEventIdState(res.events[0].id);
        showToast('Events successfully imported!', 'success');
        triggerConfetti();
      }
      return res;
    },
    // Budget & Expense CRUD
    addExpense,
    updateExpense,
    deleteExpense,
    toggleExpensePaid,
    // Timeline & Tasks CRUD
    addTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    // Vendor CRUD
    addVendor,
    updateVendor,
    deleteVendor,
    updateVendorStatus,
    // AI Theme Application
    applyThemeToEvent,
  };

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
};

export const useEventContext = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEventContext must be used within an EventProvider');
  }
  return context;
};
