'use client';

import React, { useState } from 'react';
import { EventProvider, useEventContext } from '@/context/EventContext';
import { Navbar } from '@/components/common/Navbar';
import { NotificationToast } from '@/components/common/NotificationToast';
import { ApiKeyModal } from '@/components/common/ApiKeyModal';
import { EventFormModal } from '@/components/events/EventFormModal';
import { ExpenseFormModal } from '@/components/budget/ExpenseFormModal';
import { TaskFormModal } from '@/components/timeline/TaskFormModal';
import { VendorFormModal } from '@/components/vendors/VendorFormModal';

import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { BudgetPlanner } from '@/components/budget/BudgetPlanner';
import { TimelineView } from '@/components/timeline/TimelineView';
import { VendorChecklist } from '@/components/vendors/VendorChecklist';
import { ThemeIdeaStudio } from '@/components/ai/ThemeIdeaStudio';
import { EventPrintSummary } from '@/components/export/EventPrintSummary';
import { Heart } from 'lucide-react';

const MainAppContent = () => {
  const { activeEvent } = useEventContext();
  const [currentTab, setCurrentTab] = useState('dashboard');

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

  // Helper openers
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
      {/* Top sticky navigation bar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNewEvent={handleOpenNewEvent}
        onOpenApiKey={() => setIsApiKeyModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentTab === 'dashboard' && (
          <DashboardOverview
            onNavigate={(tab) => setCurrentTab(tab)}
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
      </main>

      {/* Footer */}
      <footer className="no-print mt-auto border-t border-slate-200/80 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800 font-display">Celebration &amp; Event Planner</span>
            <span>·</span>
            <span>GenAI Planning Assistant</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="hover:text-brand-600 transition-colors"
            >
              AI Engine Settings
            </button>
            <button
              onClick={() => setCurrentTab('print')}
              className="hover:text-brand-600 transition-colors"
            >
              Print Summary
            </button>
            <span className="flex items-center gap-1 text-slate-400">
              Made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for celebrations
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

      {/* Toast Notification Container */}
      <NotificationToast />
    </div>
  );
};

export default function PlannerApp() {
  return (
    <EventProvider>
      <MainAppContent />
    </EventProvider>
  );
}
