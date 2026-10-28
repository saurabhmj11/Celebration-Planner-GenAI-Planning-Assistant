'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { EventProvider, useEventContext } from '@/context/EventContext';
import { CloudSyncProvider, useCloudSync } from '@/context/CloudSyncContext';
import { Navbar } from '@/components/common/Navbar';
import { NotificationToast } from '@/components/common/NotificationToast';
import { ApiKeyModal } from '@/components/common/ApiKeyModal';
import { EventFormModal } from '@/components/events/EventFormModal';
import { ExpenseFormModal } from '@/components/budget/ExpenseFormModal';
import { TaskFormModal } from '@/components/timeline/TaskFormModal';
import { VendorFormModal } from '@/components/vendors/VendorFormModal';
import { CommandPalette } from '@/components/common/CommandPalette';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ServiceWorkerRegistrar } from '@/components/common/ServiceWorkerRegistrar';
import {
  buildReminders,
  visibleReminders,
  remindersToastText,
  toDateKey,
  MUTED_STORAGE_KEY,
} from '@/lib/reminders/reminderModel';

import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { BudgetPlanner } from '@/components/budget/BudgetPlanner';
import { TimelineView } from '@/components/timeline/TimelineView';
import { VendorChecklist } from '@/components/vendors/VendorChecklist';
import { VenueFinder } from '@/components/venues/VenueFinder';
import { GuestManager } from '@/components/guests/GuestManager';
import { GiftRegistry } from '@/components/gifts/GiftRegistry';
import { MoodBoard } from '@/components/moodboard/MoodBoard';
import { PhotoWall } from '@/components/photos/PhotoWall';
import { DayOfWorkbench } from '@/components/dayof/DayOfWorkbench';
import { AgentForcePanel } from '@/components/force/AgentForcePanel';
import { ThemeIdeaStudio } from '@/components/ai/ThemeIdeaStudio';
import { AssistantChat } from '@/components/ai/AssistantChat';
import { CurrencyModal } from '@/components/common/CurrencyModal';
import { CloudSyncModal } from '@/components/common/CloudSyncModal';
import { Heart } from 'lucide-react';

// The print summary is a heavy, rarely-visited surface — load it lazily.
const EventPrintSummary = dynamic(
  () =>
    import('@/components/export/EventPrintSummary').then((m) => ({
      default: m.EventPrintSummary,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-brand-600 animate-spin" aria-hidden="true" />
          <p className="text-sm text-slate-500 font-medium">Preparing your summary sheet…</p>
        </div>
      </div>
    ),
  }
);

/** Keyboard-first skip link, revealed on focus (WCAG 2.1 bypass blocks). */
const SkipLink = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-slate-900 focus:text-white focus:text-sm focus:font-bold focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white"
  >
    Skip to main content
  </a>
);

const MainAppContent = () => {
  const { activeEvent, exportEventsData, undo, redo, showToast } = useEventContext();
  const { openCloudModal } = useCloudSync();
  const [currentTab, setCurrentTab] = useState('dashboard');

  // Global ⌘K / Ctrl+K command palette
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsPaletteOpen((open) => !open);
        return;
      }
      // Undo / redo — never hijacks native text-editing undo inside inputs.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
        const target = e.target;
        const isEditable =
          target instanceof HTMLElement &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (isEditable) return;
        e.preventDefault();
        if (e.shiftKey || e.key === 'y' || e.key === 'Y') {
          redo();
        } else {
          undo();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Auto reminder nudge (GAP 8): once per session, surface what needs
  // attention for the active event. Mutes are respected so a snoozed item
  // never re-nags within the same day; the bell stays for the full list.
  const nudgedRef = useRef(false);
  useEffect(() => {
    if (nudgedRef.current || !activeEvent?.id) return;
    nudgedRef.current = true;
    let muted = {};
    try {
      muted = JSON.parse(window.localStorage.getItem(MUTED_STORAGE_KEY) || '{}');
    } catch (_err) {
      muted = {};
    }
    const todayDate = new Date();
    const built = buildReminders(activeEvent, { today: todayDate });
    const visible = visibleReminders(built.reminders, muted, toDateKey(todayDate));
    if (visible.length > 0) {
      const text = remindersToastText(visible);
      if (text) showToast(text, 'info');
    }
    // Deliberately runs once per mount — the bell recomputes live.
  }, [activeEvent?.id, showToast]);

  // Modal states
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState(null);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);

  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [vendorToEdit, setVendorToEdit] = useState(null);

  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);

  // Helper openers — all setters are stable; callbacks stay cheap.
  const handleOpenNewEvent = () => {
    setEventToEdit(null);
    setIsEventModalOpen(true);
  };

  const handleEditCurrentEvent = () => {
    setEventToEdit(activeEvent);
    setIsEventModalOpen(true);
  };

  const handleOpenAddExpense = () => {
    setExpenseToEdit(null);
    setIsExpenseModalOpen(true);
  };

  const handleEditExpense = (expense) => {
    setExpenseToEdit(expense);
    setIsExpenseModalOpen(true);
  };

  const handleOpenAddTask = () => {
    setTaskToEdit(null);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task) => {
    setTaskToEdit(task);
    setIsTaskModalOpen(true);
  };

  const handleOpenAddVendor = () => {
    setVendorToEdit(null);
    setIsVendorModalOpen(true);
  };

  const handleEditVendor = (vendor) => {
    setVendorToEdit(vendor);
    setIsVendorModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <SkipLink />

      {/* Top sticky navigation bar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNewEvent={handleOpenNewEvent}
        onOpenApiKey={() => setIsApiKeyModalOpen(true)}
        onEditCurrentEvent={handleEditCurrentEvent}
        onOpenPalette={() => setIsPaletteOpen(true)}
        onOpenCurrency={() => setIsCurrencyModalOpen(true)}
      />

      {/* Main Content Area */}
      <main
        id="main-content"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 scroll-mt-20 lg:scroll-mt-28"
      >
        {/* Tab-level safety net: one throwing component can never white-screen
            the app. key={currentTab} remounts it on every tab switch, so
            "Try Again" always starts from a clean slate. */}
        <ErrorBoundary
          key={currentTab}
          boundaryName={currentTab}
          onNavigateHome={() => setCurrentTab('dashboard')}
          onExportBackup={exportEventsData}
        >
        {currentTab === 'dashboard' && (
          <DashboardOverview
            onNavigate={setCurrentTab}
            onOpenNewEvent={handleOpenNewEvent}
            onOpenExpenseModal={handleOpenAddExpense}
            onOpenTaskModal={handleOpenAddTask}
            onOpenVendorModal={handleOpenAddVendor}
            onEditEvent={handleEditCurrentEvent}
          />
        )}

        {currentTab === 'budget' && (
          <BudgetPlanner
            onOpenExpenseModal={handleOpenAddExpense}
            onEditExpense={handleEditExpense}
          />
        )}

        {currentTab === 'timeline' && (
          <TimelineView
            onOpenTaskModal={handleOpenAddTask}
            onEditTask={handleEditTask}
          />
        )}

        {currentTab === 'venues' && <VenueFinder />}

        {currentTab === 'guests' && <GuestManager />}

        {currentTab === 'gifts' && <GiftRegistry />}

        {currentTab === 'photos' && <PhotoWall />}

        {currentTab === 'mood' && <MoodBoard />}

        {currentTab === 'dayof' && <DayOfWorkbench onNavigate={setCurrentTab} />}

        {currentTab === 'force' && <AgentForcePanel onNavigate={setCurrentTab} />}

        {currentTab === 'vendors' && (
          <VendorChecklist
            onOpenVendorModal={handleOpenAddVendor}
            onEditVendor={handleEditVendor}
          />
        )}

        {currentTab === 'ai' && (
          <ThemeIdeaStudio onOpenApiKey={() => setIsApiKeyModalOpen(true)} />
        )}

        {currentTab === 'print' && <EventPrintSummary />}
        </ErrorBoundary>
      </main>

      {/* Footer — sticks to viewport bottom; pushes down naturally on overflow */}
      <footer className="no-print mt-auto border-t border-slate-200/80 bg-white py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800 font-display">Celebration &amp; Event Planner</span>
            <span aria-hidden="true">·</span>
            <span>GenAI Planning Assistant</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="hover:text-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
            >
              AI Engine Settings
            </button>
            <button
              type="button"
              onClick={() => setCurrentTab('print')}
              className="hover:text-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
            >
              Print Summary
            </button>
            <span className="flex items-center gap-1 text-slate-400">
              Made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" aria-hidden="true" /> for celebrations
            </span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <EventFormModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        eventToEdit={eventToEdit}
      />

      <ExpenseFormModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        expenseToEdit={expenseToEdit}
      />

      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        taskToEdit={taskToEdit}
      />

      <VendorFormModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        vendorToEdit={vendorToEdit}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />

      {/* Display-currency settings (symbol + conversion) */}
      <CurrencyModal
        isOpen={isCurrencyModalOpen}
        onClose={() => setIsCurrencyModalOpen(false)}
      />

      {/* Cloud sync: account, per-event sync, RSVP-link sharing */}
      <CloudSyncModal />

      {/* ⌘K / Ctrl+K command palette — sits above everything */}
      <CommandPalette
        open={isPaletteOpen}
        onOpenChange={setIsPaletteOpen}
        onNavigate={setCurrentTab}
        onOpenNewEvent={handleOpenNewEvent}
        onOpenAddExpense={handleOpenAddExpense}
        onOpenAddTask={handleOpenAddTask}
        onOpenAddVendor={handleOpenAddVendor}
        onOpenApiKey={() => setIsApiKeyModalOpen(true)}
        onOpenCurrency={() => setIsCurrencyModalOpen(true)}
        onOpenCloudSync={openCloudModal}
      />

      {/* Floating context-aware AI assistant (all tabs) */}
      <AssistantChat />

      {/* Toast Notification Container */}
      <NotificationToast />

      {/* PWA: offline app-shell caching (production builds only) */}
      <ServiceWorkerRegistrar />
    </div>
  );
};

export default function PlannerApp() {
  return (
    <EventProvider>
      <CloudSyncProvider>
        <MainAppContent />
      </CloudSyncProvider>
    </EventProvider>
  );
}
