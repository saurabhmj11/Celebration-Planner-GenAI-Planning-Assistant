import React, { useState, useRef, useEffect } from 'react';
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
  X
} from 'lucide-react';

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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'budget', label: 'Budget Planner', icon: Wallet },
    { id: 'timeline', label: 'Timeline & Tasks', icon: Clock },
    { id: 'vendors', label: 'Vendor Checklist', icon: Users },
    { id: 'ai', label: 'AI Theme Studio', icon: Sparkles, highlight: true },
    { id: 'print', label: 'Summary Sheet', icon: Printer },
  ];

  const currentTypeInfo = EVENT_TYPES.find((t) => t.id === activeEvent?.type) || EVENT_TYPES[0];

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm transition-all no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Left: Brand & Event Selector */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Brand Logo */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-rose-500 p-0.5 shadow-md shadow-brand-500/20 flex items-center justify-center">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-xl">
                  ✨
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <h1 className="font-display font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-brand-900 to-indigo-900 bg-clip-text text-transparent">
                    Celebration
                  </h1>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-bold border border-brand-200/60 uppercase tracking-wider">
                    Planner
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-600">
                  GenAI Planning Assistant
                </p>
              </div>
            </div>

            {/* Active Event Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 transition-all text-left max-w-[210px] sm:max-w-xs"
              >
                <span className="text-lg shrink-0">{currentTypeInfo?.icon}</span>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {activeEvent?.title || 'Select Event'}
                  </p>
                  <p className="text-[11px] text-slate-600 truncate flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 text-brand-500" />
                    {activeEvent?.date || 'No date set'}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-fadeIn">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Your Celebrations ({events.length})
                    </span>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenNewEvent();
                      }}
                      className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Event
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto py-1">
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
                            onClick={() => {
                              setActiveEventId(ev.id);
                              setIsDropdownOpen(false);
                            }}
                            className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                          >
                            <span className="text-base shrink-0">{type?.icon || '🎉'}</span>
                            <div className="truncate">
                              <p className={`text-xs truncate ${isCurr ? 'font-bold text-brand-900' : 'font-medium text-slate-700'}`}>
                                {ev.title}
                              </p>
                              <p className="text-[10px] text-slate-600">{ev.date} · ${ev.budget?.toLocaleString()}</p>
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              title="Duplicate Event"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateEvent(ev.id);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {events.length > 1 && (
                              <button
                                title="Delete Event"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Are you sure you want to delete "${ev.title}"?`)) {
                                    deleteEvent(ev.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-2 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenNewEvent();
                      }}
                      className="w-full py-2 px-3 text-xs font-semibold text-brand-700 bg-brand-100/70 hover:bg-brand-200/70 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
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
                  onClick={() => setCurrentTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25 ring-2 ring-brand-600/30'
                      : item.highlight
                      ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-amber-500' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.highlight && !isActive && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Icons & Mobile Hamburger */}
          <div className="flex items-center gap-2">
            {/* Gemini API Indicator / Key Button */}
            <button
              onClick={onOpenApiKey}
              title="AI Engine Settings"
              aria-label="Open AI engine settings"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                apiKey
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-brand-600" />
              <span className="hidden sm:inline">AI Settings</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  apiKey ? 'bg-emerald-500 shadow-sm shadow-emerald-400' : 'bg-brand-500 shadow-sm shadow-brand-400'
                }`}
                title={apiKey ? 'Custom Gemini key connected' : 'Built-in GenAI engine connected'}
              />
            </button>

            {/* Quick Actions (Reset & Export) */}
            <button
              onClick={exportEventsData}
              title="Backup & Export All Events"
              aria-label="Backup and export all celebration events"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors hidden sm:flex items-center"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (confirm('Reset to rich celebration samples? Any unsaved custom events will be replaced.')) {
                  resetAllToSampleData();
                }
              }}
              title="Reset Sample Data"
              aria-label="Reset to sample celebration data"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors hidden sm:flex items-center"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
              className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl lg:hidden"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-2 animate-fadeIn">
          <div className="grid grid-cols-2 gap-2 pb-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <button
              onClick={() => {
                onOpenNewEvent();
                setIsMobileMenuOpen(false);
              }}
              className="text-brand-600 font-bold flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> New Event
            </button>
            <button
              onClick={() => {
                onOpenApiKey();
                setIsMobileMenuOpen(false);
              }}
              className="text-slate-600 font-semibold flex items-center gap-1"
            >
              <Key className="w-4 h-4" /> AI Key Settings
            </button>
            <button
              onClick={() => {
                exportEventsData();
                setIsMobileMenuOpen(false);
              }}
              className="text-slate-600 font-semibold flex items-center gap-1"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
