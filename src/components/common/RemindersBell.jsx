'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useEventContext } from '../../context/EventContext';
import {
  buildReminders,
  visibleReminders,
  withMute,
  muteKeyFor,
  countBadge,
  countSeverities,
  remindersToastText,
  toDateKey,
  MUTED_STORAGE_KEY,
} from '../../lib/reminders/reminderModel';
import {
  Bell,
  CheckCircle2,
  AlarmClock,
  CalendarClock,
  CircleDollarSign,
  ListTodo,
  PartyPopper,
  X,
} from 'lucide-react';

/**
 * Reminders Bell (GAP 8) — the always-visible nudge surface for the auto
 * reminder engine. Recomputes from the live plan on every change, badges the
 * count of overdue + urgent items, and offers one-tap jumps to the tab where
 * each reminder can be resolved. Snoozing hides one item until tomorrow
 * (date-keyed mutes in localStorage — no accounts, no server).
 */

const SEVERITY_STYLES = {
  overdue: {
    dot: 'bg-rose-500',
    chip: 'bg-rose-100 text-rose-800 border-rose-200',
    label: 'Overdue',
    icon: AlarmClock,
  },
  urgent: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-900 border-amber-200',
    label: 'Urgent',
    icon: AlarmClock,
  },
  upcoming: {
    dot: 'bg-sky-500',
    chip: 'bg-sky-100 text-sky-800 border-sky-200',
    label: 'Upcoming',
    icon: CalendarClock,
  },
  info: {
    dot: 'bg-violet-500',
    chip: 'bg-violet-100 text-violet-800 border-violet-200',
    label: 'Heads-up',
    icon: PartyPopper,
  },
};

const KIND_ICONS = {
  payment: CircleDollarSign,
  task: ListTodo,
  rsvp: Bell,
  countdown: PartyPopper,
};

export const RemindersBell = ({ setCurrentTab }) => {
  const { activeEvent } = useEventContext();
  const [isOpen, setIsOpen] = useState(false);
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(window.localStorage.getItem(MUTED_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  });
  const panelRef = useRef(null);
  const bellRef = useRef(null);

  // One clock per mount: reminders are date-scoped, not second-scoped.
  const todayDate = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(todayDate), [todayDate]);

  const built = useMemo(
    () => buildReminders(activeEvent, { today: todayDate }),
    [activeEvent, todayDate]
  );
  const visible = useMemo(
    () => visibleReminders(built.reminders, muted, todayKey),
    [built.reminders, muted, todayKey]
  );
  const badge = useMemo(() => countBadge(visible), [visible]);
  const counts = useMemo(() => countSeverities(visible), [visible]);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointer = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const persistMuted = useCallback((next) => {
    setMuted(next);
    try {
      window.localStorage.setItem(MUTED_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full/blocked — snooze still applies for this session */
    }
  }, []);

  const snooze = (reminder) => {
    persistMuted(withMute(muted, muteKeyFor(reminder.eventId || '', reminder), todayKey));
  };

  const go = (tab) => {
    if (typeof setCurrentTab === 'function') setCurrentTab(tab);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={
          badge > 0
            ? `Reminders — ${badge} item${badge === 1 ? '' : 's'} need attention`
            : 'Reminders — all clear'
        }
        aria-expanded={isOpen}
        title={
          badge > 0
            ? `${badge} reminder${badge === 1 ? '' : 's'} need${badge === 1 ? 's' : ''} attention`
            : 'Auto reminders — all clear'
        }
        className="relative h-9 w-9 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {badge > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-extrabold shadow-sm ring-2 ring-white"
            aria-hidden="true"
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Reminders"
          className="absolute right-0 top-11 z-50 w-[22rem] sm:w-[26rem] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
              Auto Reminders
            </p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close reminders"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {visible.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-700 mt-2">All clear</p>
              <p className="text-xs text-slate-400 mt-1">
                Payments, tasks and RSVP deadlines are watched automatically — nothing needs you
                right now.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {counts.overdue > 0 && `${counts.overdue} overdue · `}
                {counts.urgent > 0 && `${counts.urgent} urgent · `}
                {counts.upcoming > 0 && `${counts.upcoming} upcoming · `}
                {counts.info > 0 && `${counts.info} heads-up · `}
                snoozed items return tomorrow.
              </p>
              <ul className="space-y-2">
                {visible.map((r) => {
                  const style = SEVERITY_STYLES[r.severity] || SEVERITY_STYLES.upcoming;
                  const KindIcon = KIND_ICONS[r.kind] || Bell;
                  return (
                    <li
                      key={r.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-1 w-2 h-2 rounded-full shrink-0 ${style.dot}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 leading-snug">{r.title}</p>
                          {r.detail && (
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed truncate">
                              {r.detail}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-extrabold uppercase tracking-wide ${style.chip}`}
                            >
                              <KindIcon className="w-2.5 h-2.5" aria-hidden="true" />
                              {style.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => go(r.tab)}
                              className="text-[10px] font-extrabold text-brand-700 hover:text-brand-900 underline underline-offset-2"
                            >
                              Go fix it →
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => snooze(r)}
                          aria-label={`Snooze reminder: ${r.title}`}
                          title="Hide until tomorrow"
                          className="p-1 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};
