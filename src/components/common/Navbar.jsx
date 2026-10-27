import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEventContext } from '../../context/EventContext';
import { EVENT_TYPES } from '../../data/defaultData';
import {
  Sparkles,
  ChevronDown,
  Plus,
  LayoutDashboard,
  Wallet,
  Clock,
  MapPinned,
  Users,
  UsersRound,
  Images,
  Printer,
  Key,
  RotateCcw,
  Download,
  Copy,
  Trash2,
  Pencil,
  Menu,
  X,
} from 'lucide-react';
import { formatShortDate, formatCurrency } from '../../utils/formatters';
import { useCelebrationMood } from '../../hooks/useCelebrationMood';

/**
 * Application top bar — two-tier layout.
 *
 * Tier 1: brand + active-event switcher + utility actions (AI status, export, reset, menu).
 * Tier 2 (desktop >= lg): the six primary tabs, evenly sized and left-aligned.
 * Mobile (< lg): tier 2 collapses into a hamburger drawer.
 *
 * Why two tiers: the previous single row (brand + switcher + 6 tabs + utilities ≈ 1440px
 * of content) overflowed below ~1500px viewports, and `justify-between` pushed the tab
 * strip on top of the event switcher — ghost text through the translucent trigger and
 * clicks landing on the wrong control. A second row guarantees separation at any width.
 */
export const Navbar = ({ currentTab, setCurrentTab, onOpenNewEvent, onOpenApiKey, onEditCurrentEvent }) => {
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
  const mood = useCelebrationMood();

  const dropdownRef = useRef(null);
  const dropdownTriggerRef = useRef(null);
  const dropdownMenuRef = useRef(null);
  const hamburgerRef = useRef(null);
  const mobileDrawerRef = useRef(null);
  /** Set when the dropdown is opened via ArrowDown so focus moves into the list. */
  const focusFirstOptionRef = useRef(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'budget', label: 'Budget', icon: Wallet, ariaLabel: 'Budget Planner' },
    { id: 'timeline', label: 'Timeline', icon: Clock, ariaLabel: 'Timeline & Tasks' },
    { id: 'guests', label: 'Guests', icon: UsersRound, ariaLabel: 'Guests & RSVPs — invitations, replies and headcount', highlight: true },
    { id: 'photos', label: 'Photos', icon: Images, ariaLabel: 'Photo Memory Wall — share celebration moments' },
    { id: 'venues', label: 'Venues', icon: MapPinned, ariaLabel: 'AI Venue Finder', highlight: true },
    { id: 'vendors', label: 'Vendors', icon: Users, ariaLabel: 'Vendor Checklist' },
    { id: 'ai', label: 'AI Studio', icon: Sparkles, ariaLabel: 'AI Theme Studio', highlight: true },
    { id: 'print', label: 'Print', icon: Printer, ariaLabel: 'Summary Sheet' },
  ];

  const currentTypeInfo = EVENT_TYPES.find((t) => t.id === activeEvent?.type) || EVENT_TYPES[0];

  const goToTab = (tab) => {
    setCurrentTab(tab);
    setIsMobileMenuOpen(false);
  };

  const closeDropdown = useCallback((restoreFocus = true) => {
    setIsDropdownOpen(false);
    focusFirstOptionRef.current = false;
    if (restoreFocus) dropdownTriggerRef.current?.focus();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Event-switcher dropdown behaviour                                   */
  /* ------------------------------------------------------------------ */

  // Close on outside click.
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        focusFirstOptionRef.current = false;
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Escape closes the dropdown and restores focus to its trigger (a11y).
  useEffect(() => {
    if (!isDropdownOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeDropdown(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isDropdownOpen, closeDropdown]);

  // After the menu mounts from a keyboard open, move focus to the first event option.
  useEffect(() => {
    if (!isDropdownOpen || !focusFirstOptionRef.current) return;
    focusFirstOptionRef.current = false;
    dropdownMenuRef.current
      ?.querySelector('button[data-option]')
      ?.focus();
  }, [isDropdownOpen]);

  /**
   * Listbox-style keyboard support on the switcher: ArrowDown opens & enters
   * the list, arrows/Home/End cycle between event options (WCAG 2.1 pattern).
   */
  const handleSwitcherKeyDown = (e) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusFirstOptionRef.current = true;
        setIsDropdownOpen(true);
      }
      return;
    }
    const options = [
      ...(dropdownMenuRef.current?.querySelectorAll('button[data-option]') || []),
    ];
    if (!options.length) return;
    const idx = options.indexOf(document.activeElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = idx < 0 ? 0 : (idx + 1) % options.length;
    else if (e.key === 'ArrowUp') next = idx < 0 ? options.length - 1 : (idx - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next >= 0) {
      e.preventDefault();
      options[next].focus();
    }
  };

  /* ------------------------------------------------------------------ */
  /* Mobile drawer behaviour                                             */
  /* ------------------------------------------------------------------ */

  // Escape closes the drawer and restores focus to the hamburger toggle.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);

  // Clicking page content (outside header controls) closes the drawer.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onDown = (e) => {
      if (mobileDrawerRef.current?.contains(e.target)) return;
      if (hamburgerRef.current?.contains(e.target)) return;
      setIsMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isMobileMenuOpen]);

  // Crossing into desktop sizes auto-closes the drawer.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => {
      if (e.matches) setIsMobileMenuOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const selectEvent = (id) => {
    setActiveEventId(id);
    setIsDropdownOpen(false);
    dropdownTriggerRef.current?.focus();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm transition-all no-print">
      {/* ============ Tier 1: brand + event switcher + utilities ============ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-rose-500 p-0.5 shadow-md shadow-brand-500/20 flex items-center justify-center"
              aria-hidden="true"
            >
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-lg">
                ✨
              </div>
            </div>
            <div className="hidden md:block">
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-brand-900 to-brand-800 bg-clip-text text-transparent">
                  Celebration
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-800 font-bold border border-brand-200/60 uppercase tracking-wider">
                  Planner
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-600">
                GenAI Planning Assistant
              </p>
            </div>
          </div>

          {/* Active Event Dropdown — flexible width, truncates only when truly needed */}
          <div className="relative flex-1 min-w-0 flex justify-center" ref={dropdownRef}>
            <button
              ref={dropdownTriggerRef}
              type="button"
              onClick={() => setIsDropdownOpen((open) => !open)}
              onKeyDown={handleSwitcherKeyDown}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              aria-label={`Switch active celebration. Current: ${activeEvent?.title || 'none'}`}
              title={activeEvent?.title || undefined}
              className="flex items-center gap-2.5 h-10 px-3.5 w-full sm:w-auto sm:max-w-md rounded-2xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 transition-all text-left min-w-0"
            >
              <span className="text-lg shrink-0" aria-hidden="true">{currentTypeInfo?.icon}</span>
              <span
                className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: mood.accent }}
                aria-hidden="true"
                title="Celebration mood color — follows the party type, booked venue and applied theme"
              />
              <span className="truncate min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-800 truncate">
                  {activeEvent?.title || 'Select Event'}
                </span>
                <span className="block text-[11px] text-slate-600 truncate">
                  {formatShortDate(activeEvent?.date, { fallback: 'No date set' })}
                </span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                ref={dropdownMenuRef}
                className="absolute left-1/2 top-full -translate-x-1/2 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-fadeIn"
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
                          data-option="true"
                          aria-current={isCurr ? 'true' : undefined}
                          onClick={() => selectEvent(ev.id)}
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

                <div className="p-2 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onEditCurrentEvent?.();
                    }}
                    title="Edit the current celebration — date, guests, budget, venue"
                    aria-label="Edit current celebration details"
                    className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-xl flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    Edit Current
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenNewEvent();
                    }}
                    className="w-full py-2 px-3 text-xs font-semibold text-brand-800 bg-brand-100/70 hover:bg-brand-200/70 rounded-xl flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    New Celebration
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right utility actions — uniform h-9 targets */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* AI Engine Status */}
            <button
              type="button"
              onClick={onOpenApiKey}
              title="AI Engine Settings"
              aria-label="Open AI engine settings"
              className={`flex items-center gap-1.5 h-9 px-2.5 rounded-xl text-xs font-semibold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                apiKey
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
              <span className="hidden xl:inline">AI Settings</span>
              <span
                className={`w-2 h-2 rounded-full ${apiKey ? 'bg-emerald-500 shadow-sm shadow-emerald-400' : 'bg-brand-500 shadow-sm shadow-brand-400'}`}
                aria-hidden="true"
              />
              <span className="sr-only">
                {apiKey ? 'Custom AI key connected' : 'Built-in AI engine connected'}
              </span>
            </button>

            {/* Backup & Export — desktop only (drawer mirrors it on mobile) */}
            <button
              type="button"
              onClick={exportEventsData}
              title="Backup & Export All Events"
              aria-label="Backup and export all celebration events"
              className="h-9 w-9 hidden sm:flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Reset Samples — desktop only */}
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset to rich celebration samples? Any unsaved custom events will be replaced.')) {
                  resetAllToSampleData();
                }
              }}
              title="Reset Sample Data"
              aria-label="Reset to sample celebration data"
              className="h-9 w-9 hidden sm:flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className="h-9 w-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-xl lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* ============ Tier 2: primary tabs (desktop) ============ */}
      <div className="hidden lg:block border-t border-slate-100 bg-white/60">
        <nav
          aria-label="Main Navigation"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 xl:gap-1.5 h-12"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goToTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.ariaLabel || item.label}
                title={item.ariaLabel || item.label}
                style={isActive ? { backgroundColor: mood.accent } : undefined}
                className={`flex items-center gap-1.5 xl:gap-2 h-9 px-2 xl:px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'text-white shadow-md'
                    : item.highlight
                    ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.highlight ? 'text-amber-600' : 'text-slate-500'}`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
                {item.highlight && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ============ Mobile Drawer Navigation ============ */}
      {isMobileMenuOpen && (
        <nav
          ref={mobileDrawerRef}
          id="mobile-nav-drawer"
          aria-label="Mobile Navigation"
          className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-2 animate-fadeIn shadow-lg"
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
                  aria-label={item.ariaLabel || item.label}
                  style={isActive ? { backgroundColor: mood.accent } : undefined}
                  className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isActive
                      ? 'text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
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
