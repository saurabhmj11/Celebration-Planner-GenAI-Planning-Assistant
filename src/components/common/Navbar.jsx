import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEventContext } from '../../context/EventContext';
import { EVENT_TYPES } from '../../data/defaultData';
import {
  Sparkles,
  Calendar,
  ChevronDown,
  Plus,
  LayoutDashboard,
  Wallet,
  Clock,
  Users,
  Printer,
  Key,
  RotateCcw,
  Download,
  Copy,
  Trash2,
  Menu,
  X,
} from 'lucide-react';
import { formatShortDate, formatCurrency, truncateText } from '../../utils/formatters';

export const Navbar = ({ currentTab, setCurrentTab, onOpenNewEvent, onOpenApiKey }) => {
  const {
    events,
    activeEventId,
    activeEvent,
    setActiveEventId,
    duplicateEvent,
    deleteEvent,
    resetAllToSampleData,
    exportEventsData,
    apiKey,
  } = useEventContext();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const dropdownTriggerRef = useRef(null);

  // Close the dropdown from Escape, restoring focus to its trigger (a11y).
  const handleDropdownEscape = useCallback((e) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      dropdownTriggerRef.current?.focus();
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleDropdownEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleDropdownEscape);
    };
  }, [isDropdownOpen, handleDropdownEscape]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'budget', label: 'Budget Planner', icon: Wallet },
    { id: 'timeline', label: 'Timeline & Tasks', icon: Clock },
    { id: 'vendors', label: 'Vendor Checklist', icon: Users },
    { id: 'ai', label: 'AI Theme Studio', icon: Sparkles, highlight: true },
    { id: 'print', label: 'Summary Sheet', icon: Printer },
  ];

  const currentTypeInfo = EVENT_TYPES.find((t) => t.id === activeEvent?.type) || EVENT_TYPES[0];

  const goToTab = (tab) => {
    setCurrentTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm transition-all no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Left: Brand & Event Selector */}
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            {/* Brand Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <div
                className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-rose-500 p-0.5 shadow-md shadow-brand-500/20 flex items-center justify-center"
                aria-hidden="true"
              >
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-xl">
                  ✨
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <h1 className="font-display font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-brand-900 to-brand-800 bg-clip-text text-transparent">
                    Celebration
                  </h1>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-800 font-bold border border-brand-200/60 uppercase tracking-wider">
                    Planner
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-600">
                  GenAI Planning Assistant
                </p>
              </div>
            </div>

            {/* Active Event Dropdown */}
            <div className="relative min-w-0" ref={dropdownRef}>
              <button
                ref={dropdownTriggerRef}
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                aria-haspopup="listbox"
                aria-expanded={isDropdownOpen}
                aria-label={`Switch active celebration. Current: ${activeEvent?.title || 'none'}`}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 transition-all text-left max-w-[180px] sm:max-w-xs min-w-0"
              >
                <span className="text-lg shrink-0" aria-hidden="true">{currentTypeInfo?.icon}</span>
                <span className="truncate min-w-0">
                  <span className="block text-xs font-bold text-slate-800 truncate">
                    {activeEvent?.title || 'Select Event'}
                  </span>
                  <span className="block text-[11px] text-slate-600 truncate">
                    {formatShortDate(activeEvent?.date, { fallback: 'No date set' })}
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 ml-1 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-fadeIn"
                  role="listbox"
                  aria-label="Your celebrations"
                >
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Your Celebrations ({events.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenNewEvent();
                      }}
                      className="text-xs font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      New Event
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto py-1 custom-scrollbar">
                    {events.map((ev) => {
                      const isCurr = ev.id === activeEventId;
                      const type = EVENT_TYPES.find((t) => t.id === ev.type);
                      return (
                        <div
                          key={ev.id}
                          className={`flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors ${
                            isCurr ? 'bg-brand-50/70 border-l-4 border-brand-600' : ''
                          }`}
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={isCurr}
                            onClick={() => {
                              setActiveEventId(ev.id);
                              setIsDropdownOpen(false);
                            }}
                            className="flex items-center gap-2.5 text-left flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 rounded-lg"
                          >
                            <span className="text-base shrink-0" aria-hidden="true">{type?.icon || '🎉'}</span>
                            <span className="truncate">
                              <span className={`block text-xs truncate ${isCurr ? 'font-bold text-brand-900' : 'font-medium text-slate-700'}`}>
                                {ev.title}
                              </span>
                              <span className="block text-[10px] text-slate-600">
                                {formatShortDate(ev.date)} · {formatCurrency(ev.budget)}
                              </span>
                            </span>
                          </button>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              type="button"
                              title="Duplicate Event"
                              aria-label={`Duplicate event ${ev.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateEvent(ev.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            {events.length > 1 && (
                              <button
                                type="button"
                                title="Delete Event"
                                aria-label={`Delete event ${ev.title}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Are you sure you want to delete "${ev.title}"? This cannot be undone.`)) {
                                    deleteEvent(ev.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-2 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenNewEvent();
                      }}
                      className="w-full py-2 px-3 text-xs font-semibold text-brand-800 bg-brand-100/70 hover:bg-brand-200/70 rounded-xl flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      Create New Celebration
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25 ring-2 ring-brand-600/30'
                      : item.highlight
                      ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-amber-600' : 'text-slate-500'}`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                  {item.highlight && !isActive && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Icons & Mobile Hamburger */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* AI Engine Status Button */}
            <button
              type="button"
              onClick={onOpenApiKey}
              title="AI Engine Settings"
              aria-label="Open AI engine settings"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                apiKey
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
              <span className="hidden sm:inline">AI Settings</span>
              <span
                className={`w-2 h-2 rounded-full ${apiKey ? 'bg-emerald-500 shadow-sm shadow-emerald-400' : 'bg-brand-500 shadow-sm shadow-brand-400'}`}
                title={apiKey ? 'Custom Gemini key connected' : 'Built-in GenAI engine connected'}
                aria-hidden="true"
              />
              <span className="sr-only">
                {apiKey ? 'Custom AI key connected' : 'Built-in AI engine connected'}
              </span>
            </button>

            {/* Quick Actions (Reset & Export) — desktop only */}
            <button
              type="button"
              onClick={exportEventsData}
              title="Backup & Export All Events"
              aria-label="Backup and export all celebration events"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 hidden sm:flex items-center"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm('Reset to rich celebration samples? Any unsaved custom events will be replaced.')) {
                  resetAllToSampleData();
                }
              }}
              title="Reset Sample Data"
              aria-label="Reset to sample celebration data"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 hidden sm:flex items-center"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <nav
          id="mobile-nav-drawer"
          aria-label="Mobile Navigation"
          className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-2 animate-fadeIn"
        >
          <div className="grid grid-cols-2 gap-2 pb-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-start gap-4 pt-3 border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={() => {
                onOpenNewEvent();
                setIsMobileMenuOpen(false);
              }}
              className="text-brand-700 font-bold flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> New Event
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenApiKey();
                setIsMobileMenuOpen(false);
              }}
              className="text-slate-600 font-semibold flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
            >
              <Key className="w-4 h-4" aria-hidden="true" /> AI Key Settings
            </button>
            <button
              type="button"
              onClick={() => {
                exportEventsData();
                setIsMobileMenuOpen(false);
              }}
              className="text-slate-600 font-semibold flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
            >
              <Download className="w-4 h-4" aria-hidden="true" /> Export
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset to rich celebration samples? Any unsaved custom events will be replaced.')) {
                  resetAllToSampleData();
                }
                setIsMobileMenuOpen(false);
              }}
              className="text-slate-600 font-semibold flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Reset Samples
            </button>
          </div>
        </nav>
      )}
    </header>
  );
};
