import React from 'react';
import { createPortal } from 'react-dom';
import { useEventContext } from '../../context/EventContext';
import { calculateRunSheetStats } from '../../utils/calculator';
import { CalendarClock, Plus, CheckCircle2, Circle, Pencil, Trash2, Printer, Clock3, User } from 'lucide-react';
import { formatEventDate } from '../../utils/formatters';

/**
 * Day-of run sheet — the minute-by-minute cue list for the crew.
 * Each line: time · duration · activity · owner · notes, with done-toggles
 * and a print portal that prints ONLY the cue sheet for the MC & vendors.
 */
const OwnerBadge = ({ owner }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
    <User className="w-3 h-3 text-slate-400" aria-hidden="true" />
    {owner}
  </span>
);

export const RunSheetPanel = ({ onOpenAdd, onEditItem, onNavigate }) => {
  const { activeEvent, toggleRunSheetItemDone, deleteRunSheetItem } = useEventContext();

  if (!activeEvent) return null;
  const items = activeEvent.runSheet || [];
  const stats = calculateRunSheetStats(items);
  const sorted = stats.sorted.length > 0 ? stats.sorted : items;

  // Portal stays mounted (hidden by default) — the body class flips only
  // for the print dialog, so there is no mount/print race.
  const handlePrint = () => {
    document.body.classList.add('printing-runsheet');
    const cleanup = () => {
      document.body.classList.remove('printing-runsheet');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    // afterprint isn't reliable in every browser — belt and braces.
    setTimeout(cleanup, 2000);
  };

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Cue lines', value: String(stats.total) },
          { label: 'Checked off', value: `${stats.done}/${stats.total}` },
          { label: 'First cue', value: stats.firstAt || '—' },
          { label: 'Program span', value: stats.spanHours ? `${stats.spanHours}h` : '—' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-slate-200/80 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className="font-display font-extrabold text-lg text-slate-900 mt-0.5 tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {items.length === 0
            ? 'No cues yet — add the first one, or let the Day-Of Producer agent draft the whole sheet.'
            : `${stats.pending} cue${stats.pending === 1 ? '' : 's'} still open · ${stats.done} done`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            Print run sheet
          </button>
          <button
            type="button"
            onClick={onOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Add cue
          </button>
        </div>
      </div>

      {/* Cue list */}
      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <CalendarClock className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
          <h3 className="font-display font-bold text-slate-700 mt-3">The day has no cue sheet yet</h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
            A run sheet keeps vendors, the MC and helpers on the same clock. Add cues by hand, or dispatch the{' '}
            <span className="font-semibold text-brand-700">Day-Of Producer</span> agent to draft the full day from your
            venue, vendors and timeline.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('force')}
            className="mt-4 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 to-brand-600 hover:from-fuchsia-500 hover:to-brand-500 transition-all"
          >
            Open Agent Force
          </button>
        </div>
      ) : (
        <ol className="space-y-2">
          {sorted.map((item) => (
            <li
              key={item.id}
              className={`group flex items-start gap-3 rounded-2xl border px-4 py-3 bg-white transition-all ${
                item.done ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleRunSheetItemDone(item.id)}
                aria-label={item.done ? `Mark "${item.activity}" as not done` : `Mark "${item.activity}" as done`}
                className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-full"
              >
                {item.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" aria-hidden="true" />
                ) : (
                  <Circle className="w-5 h-5" aria-hidden="true" />
                )}
              </button>

              <div className="flex sm:items-center gap-3 sm:gap-4 min-w-0 flex-1 flex-wrap">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-display font-extrabold text-sm text-brand-800 tabular-nums">
                    {item.time || '--:--'}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                    <Clock3 className="w-3 h-3" aria-hidden="true" />
                    {item.durationMin}m
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-snug ${item.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {item.activity}
                  </p>
                  {item.notes && <p className="text-[11px] text-slate-500 mt-0.5">{item.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <OwnerBadge owner={item.owner} />
                  {item.source === 'agent' && (
                    <span className="text-[10px] font-bold text-fuchsia-600 bg-fuchsia-50 border border-fuchsia-200 rounded-full px-1.5 py-0.5">
                      AI
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  onClick={() => onEditItem(item)}
                  aria-label={`Edit "${item.activity}"`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteRunSheetItem(item.id)}
                  aria-label={`Delete "${item.activity}"`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Print portal — only the cue sheet reaches the printer */}
      {items.length > 0 &&
        createPortal(
          <div className="runsheet-print-portal px-8 py-10" aria-hidden="true">
            <div className="max-w-3xl mx-auto text-slate-900">
              <h1 className="text-2xl font-extrabold">Day-Of Run Sheet</h1>
              <p className="text-sm mt-1">
                {activeEvent.title} · {formatEventDate(activeEvent.date)} · Doors {activeEvent.time || 'TBD'}
                {activeEvent.location ? ` · ${activeEvent.location}` : ''}
              </p>
              <table className="w-full text-xs mt-6 border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-left">
                    <th className="py-2 pr-3 w-16">Time</th>
                    <th className="py-2 pr-3 w-16">Dur</th>
                    <th className="py-2 pr-3">Activity</th>
                    <th className="py-2 pr-3 w-36">Owner</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => (
                    <tr key={item.id} className="border-b border-slate-300 align-top">
                      <td className="py-2 pr-3 font-bold tabular-nums">{item.time || '--:--'}</td>
                      <td className="py-2 pr-3 text-slate-600">{item.durationMin}m</td>
                      <td className="py-2 pr-3 font-semibold">{item.activity}</td>
                      <td className="py-2 pr-3">{item.owner}</td>
                      <td className="py-2 text-slate-600">{item.notes || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-500 mt-6">
                Printed from Celebration &amp; Event Planner — verify times with vendors at the final walkthrough.
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
