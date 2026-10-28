import React from 'react';
import { useEventContext } from '../../context/EventContext';
import { calculateSeatingStats } from '../../utils/calculator';
import { autoArrangeTables, seatWeight } from '../../lib/planning/seating';
import { Armchair, Plus, Wand2, Trash2, X, UsersRound, CircleAlert } from 'lucide-react';

/**
 * Seating chart designer — tables with weighted seats (a guest entry with
 * plus-ones occupies 1 + plusOnes chairs), an unseated pool of ATTENDING
 * guests, instant deterministic auto-arrange, and a hand-off to the
 * Seating Strategist agent for the AI pass.
 */
export const SeatingChartPanel = ({ onOpenAddTable, onNavigate }) => {
  const {
    activeEvent,
    assignSeat,
    unassignSeat,
    clearTableSeats,
    deleteTable,
    applySeatingAssignments,
  } = useEventContext();

  if (!activeEvent) return null;

  const tables = activeEvent.seating?.tables || [];
  const guests = activeEvent.guests || [];
  const stats = calculateSeatingStats(tables, guests);
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const attending = guests.filter((g) => g.rsvp === 'attending');
  const seatedIds = new Set(tables.flatMap((t) => t.seats || []));
  const unseated = attending.filter((g) => !seatedIds.has(g.id));

  const handleAutoArrange = () => {
    const { tables: arranged } = autoArrangeTables(tables, guests);
    const assignments = arranged.map((t) => ({ tableId: t.id, guestIds: t.seats }));
    applySeatingAssignments(assignments);
  };

  const tableUsage = (table) =>
    (table.seats || []).reduce((sum, id) => {
      const g = guestById.get(id);
      return sum + (g && g.rsvp === 'attending' ? seatWeight(g) : 0);
    }, 0);

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tables', value: String(stats.totalTables) },
          { label: 'Seats used', value: `${stats.takenSeats}/${stats.totalCapacity}` },
          { label: 'Seated parties', value: `${stats.seatedCount}/${stats.seatableCount}` },
          { label: 'Unseated', value: String(stats.unseatedCount) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-slate-200/80 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className="font-display font-extrabold text-lg text-slate-900 mt-0.5 tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 max-w-xl">
          Seats are weighted — “Eleanor +1” takes two chairs. Only <span className="font-semibold">attending</span>{' '}
          guests can be seated; maybe/invited guests appear once they confirm.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoArrange}
            disabled={attending.length === 0 || tables.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-sm transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
            Auto-Arrange
          </button>
          <button
            type="button"
            onClick={onOpenAddTable}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Add table
          </button>
        </div>
      </div>

      {/* Over-capacity warning */}
      {stats.overCapacityTables.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
          <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            A table is over capacity after RSVP changes (declined guests don’t free seats, but reduced plus-ones can).
            Remove a guest or raise the table’s capacity.
          </p>
        </div>
      )}

      {/* Unseated pool */}
      {unseated.length > 0 && (
        <section
          aria-label="Unseated attending guests"
          className="rounded-3xl border border-dashed border-brand-300 bg-brand-50/40 p-4"
        >
          <h3 className="text-xs font-bold text-brand-900 uppercase tracking-wider flex items-center gap-1.5">
            <UsersRound className="w-3.5 h-3.5" aria-hidden="true" />
            Attending, not yet seated ({unseated.length})
          </h3>
          <div className="flex flex-wrap gap-2 mt-3">
            {unseated.map((g) => {
              const freeTables = tables.filter((t) => tableUsage(t) + seatWeight(g) <= t.capacity);
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-1.5 rounded-full bg-white border border-brand-200 pl-3 pr-1.5 py-1.5 shadow-sm"
                >
                  <span className="text-xs font-semibold text-slate-800">
                    {g.name}
                    {g.plusOnes > 0 && <span className="text-brand-600 font-bold"> +{g.plusOnes}</span>}
                  </span>
                  <label className="sr-only" htmlFor={`seat-${g.id}`}>
                    Seat {g.name} at table
                  </label>
                  <select
                    id={`seat-${g.id}`}
                    value=""
                    onChange={(e) => e.target.value && assignSeat(e.target.value, g.id)}
                    disabled={freeTables.length === 0}
                    className="text-[11px] font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-full px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
                  >
                    <option value="">
                      {freeTables.length === 0 ? 'No space' : 'Seat at…'}
                    </option>
                    {freeTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.capacity - tableUsage(t)} free)
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          {tables.length > 0 && unseated.some((g) => !tables.some((t) => tableUsage(t) + seatWeight(g) <= t.capacity)) && (
            <p className="text-[11px] text-brand-700/80 mt-2.5">
              Some parties fit nowhere — add a table (or raise capacities), or let the Seating Strategist agent rebalance
              everything.{' '}
              <button
                type="button"
                onClick={() => onNavigate?.('force')}
                className="font-bold underline underline-offset-2 hover:text-brand-900"
              >
                Dispatch the agent
              </button>
            </p>
          )}
        </section>
      )}

      {/* Tables grid */}
      {tables.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <Armchair className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
          <h3 className="font-display font-bold text-slate-700 mt-3">No tables yet</h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
            Add the venue’s tables with their capacities, then seat guests by hand or let the{' '}
            <span className="font-semibold text-brand-700">Seating Strategist</span> agent arrange everyone in one pass —
            circles kept together, capacity respected.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={onOpenAddTable}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors"
            >
              Add the first table
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('force')}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 to-brand-600 hover:from-fuchsia-500 hover:to-brand-500 transition-all"
            >
              Ask the Agent Force
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {tables.map((table) => {
            const used = tableUsage(table);
            const pct = Math.min(100, Math.round((used / table.capacity) * 100));
            const over = used > table.capacity;
            return (
              <article
                key={table.id}
                className={`rounded-3xl border bg-white p-4 shadow-sm transition-all hover:shadow-card ${
                  over ? 'border-amber-300' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-sm text-slate-900 truncate">{table.name}</h3>
                  <div className="flex items-center gap-1 shrink-0">
                    {(table.seats || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearTableSeats(table.id)}
                        aria-label={`Clear all seats at ${table.name}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        <Wand2 className="w-3.5 h-3.5 rotate-90" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteTable(table.id)}
                      aria-label={`Delete ${table.name}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Capacity meter */}
                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                    <span>
                      {used} of {table.capacity} seats
                    </span>
                    <span className={over ? 'text-amber-600' : 'text-slate-400'}>{pct}%</span>
                  </div>
                  <div
                    className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${table.name} seat usage`}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${over ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Seat chips */}
                <div className="flex flex-wrap gap-1.5 mt-3 min-h-[2.25rem]">
                  {(table.seats || []).length === 0 && (
                    <p className="text-[11px] text-slate-400 italic self-center">Empty — ready for guests</p>
                  )}
                  {(table.seats || []).map((gid) => {
                    const g = guestById.get(gid);
                    if (!g || g.rsvp !== 'attending') return null;
                    return (
                      <span
                        key={gid}
                        className="group inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 pl-2.5 pr-1 py-1 text-[11px] font-semibold text-indigo-900"
                      >
                        {g.name}
                        {g.plusOnes > 0 && <span className="text-indigo-500 font-bold">+{g.plusOnes}</span>}
                        <button
                          type="button"
                          onClick={() => unassignSeat(gid)}
                          aria-label={`Remove ${g.name} from ${table.name}`}
                          className="w-4 h-4 rounded-full inline-flex items-center justify-center text-indigo-400 hover:text-rose-600 hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
