'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { useTheme } from 'next-themes';
import { useEventContext } from '../../context/EventContext';
import {
  PALETTE_NAV_ITEMS,
  buildActionItems,
  buildDataItems,
  buildEventItems,
  filterPaletteItems,
  groupPaletteItems,
  GROUP_RESULT_CAP,
} from '../../lib/palette/paletteItems';
import {
  Compass,
  CalendarHeart,
  Zap,
  UserRound,
  BriefcaseBusiness,
  ListChecks,
  Receipt,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

/** One icon per palette group so results stay scannable at speed. */
const GROUP_ICONS = {
  Actions: Zap,
  'Go to': Compass,
  Events: CalendarHeart,
  Guests: UserRound,
  Vendors: BriefcaseBusiness,
  Tasks: ListChecks,
  Expenses: Receipt,
};

/** How many events show on the empty-query home screen. */
const IDLE_EVENT_CAP = 6;

/**
 * Global ⌘K / Ctrl+K command palette.
 *
 * One input that jumps between tabs, switches celebrations, searches the
 * active event's guests / vendors / tasks / expenses, and fires quick
 * actions (new event, add expense, toggle dark mode, export backup…).
 *
 * All ranking / grouping rules live in `src/lib/palette/paletteItems.js`
 * (pure + unit-tested); this component only wires actions to handlers.
 */
export const CommandPalette = ({
  open,
  onOpenChange,
  onNavigate,
  onOpenNewEvent,
  onOpenAddExpense,
  onOpenAddTask,
  onOpenAddVendor,
  onOpenApiKey,
}) => {
  const {
    events,
    activeEvent,
    activeEventId,
    setActiveEventId,
    exportEventsData,
  } = useEventContext();

  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef(null);

  // Theme state (and thus the toggle action's label) is only meaningful
  // after hydration — next-themes guards this itself, we mirror for the UI.
  useEffect(() => setMounted(true), []);

  // Fresh search box + focus the input every time the palette opens.
  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const allItems = useMemo(() => {
    const base = [
      ...buildActionItems({ resolvedTheme: mounted ? resolvedTheme : undefined }),
      ...PALETTE_NAV_ITEMS,
    ];
    const eventItems = buildEventItems(events, { activeEventId });
    if (!query.trim()) return [...base, ...eventItems.slice(0, IDLE_EVENT_CAP)];
    // Deep search: fold the active event's rows in too.
    return [...base, ...eventItems, ...buildDataItems(activeEvent)];
  }, [events, activeEvent, activeEventId, query, mounted, resolvedTheme]);

  const visible = useMemo(
    () => filterPaletteItems(allItems, query, { limitPerGroup: GROUP_RESULT_CAP }),
    [allItems, query]
  );
  const grouped = useMemo(() => groupPaletteItems(visible), [visible]);

  /** Close first, then act — so modals the actions open never sit under us. */
  const run = (action) => {
    onOpenChange?.(false);
    switch (action?.type) {
      case 'navigate':
        onNavigate?.(action.tab);
        break;
      case 'selectEvent':
        setActiveEventId?.(action.eventId);
        break;
      case 'newEvent':
        onOpenNewEvent?.();
        break;
      case 'addExpense':
        onOpenAddExpense?.();
        break;
      case 'addTask':
        onOpenAddTask?.();
        break;
      case 'addVendor':
        onOpenAddVendor?.();
        break;
      case 'toggleTheme':
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
        break;
      case 'exportBackup':
        exportEventsData?.();
        break;
      case 'aiSettings':
        onOpenApiKey?.();
        break;
      case 'printMaster':
        onNavigate?.('print');
        break;
      default:
        break;
    }
  };

  /** Escape closes; Tab stays inside the palette (single-input modal). */
  const handleRootKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange?.(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  if (!open) return null;

  return (
    /* Custom overlay + plain Command root (not Command.Dialog): cmdk's
       dialog wrapper can't render the Radix DialogTitle/Description that
       Radix requires, which logged a11y console errors on every open. */
    <div
      className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange?.(false);
      }}
      aria-hidden="true"
    >
    <Command
      label="Command palette — search events, guests, vendors, tasks and actions"
      shouldFilter={false}
      loop
      onKeyDown={handleRootKeyDown}
      className="fixed left-1/2 top-[10vh] -translate-x-1/2 z-[81] w-[min(94vw,620px)] max-h-[76vh] overflow-hidden flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl outline-none"
    >
      {/* Search input */}
      <div className="flex items-center gap-3 px-5 border-b border-slate-200">
        <Zap
          className="w-4 h-4 text-brand-600 shrink-0"
          aria-hidden="true"
        />
        <Command.Input
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          placeholder="Search tabs, events, guests, vendors, tasks, expenses…"
          aria-label="Search the command palette"
          className="flex-1 bg-transparent py-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none"
        />
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
          ESC
        </kbd>
      </div>

      {/* Results */}
      <Command.List className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 custom-scrollbar">
        {grouped.length === 0 ? (
          <Command.Empty className="px-4 py-12 text-center">
            <p className="text-sm font-semibold text-slate-700">
              No matches for “{query.trim()}”
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Try a guest name, vendor company, task, expense — or “budget”,
              “guests”, “dark”…
            </p>
          </Command.Empty>
        ) : (
          grouped.map(({ group, items }) => {
            const GroupIcon = GROUP_ICONS[group] || Compass;
            return (
              <Command.Group
                key={group}
                heading={group}
                className="mt-1 first:mt-0 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-extrabold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-400"
              >
                {items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.id}
                    onSelect={() => run(item.action)}
                    className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm cursor-pointer text-slate-700 data-[selected=true]:bg-brand-600 data-[selected=true]:text-white transition-colors"
                  >
                    <GroupIcon
                      className="w-4 h-4 shrink-0 text-slate-400 group-data-[selected=true]:text-white"
                      aria-hidden="true"
                    />
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="truncate font-semibold">{item.label}</span>
                      {item.hint && (
                        <span className="truncate text-[11px] font-medium text-slate-500 group-data-[selected=true]:text-brand-100">
                          {item.hint}
                        </span>
                      )}
                    </span>
                    <CornerDownLeft
                      className="w-3.5 h-3.5 shrink-0 opacity-0 group-data-[selected=true]:opacity-100 text-white"
                      aria-hidden="true"
                    />
                  </Command.Item>
                ))}
              </Command.Group>
            );
          })
        )}
      </Command.List>

      {/* Footer legend */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-[10px] font-semibold text-slate-500">
        <span className="flex items-center gap-1">
          <ArrowUp className="w-3 h-3" aria-hidden="true" />
          <ArrowDown className="w-3 h-3 -ml-1.5" aria-hidden="true" />
          navigate
        </span>
        <span className="flex items-center gap-1">
          <CornerDownLeft className="w-3 h-3" aria-hidden="true" />
          select
        </span>
        <span className="flex items-center gap-1">
          esc
          close
        </span>
        <span className="ml-auto hidden sm:inline text-slate-400">
          {mounted ? (query.trim() ? 'Searching this event' : 'Type to search everything') : ''}
        </span>
      </div>
    </Command>
    </div>
  );
};
