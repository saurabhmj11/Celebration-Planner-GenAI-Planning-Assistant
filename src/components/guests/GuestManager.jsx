import React, { useState, useMemo } from 'react';
import { useEventContext } from '../../context/EventContext';
import { RSVP_STATUSES, MEAL_OPTIONS, GUEST_GROUPS } from '../../data/defaultData';
import { calculateGuestStats, getRsvpUrgency } from '../../utils/calculator';
import { guestsToCsv, buildIcsCalendar, downloadTextFile, slugify } from '../../utils/exporters';
import { formatCurrency } from '../../utils/formatters';
import { GuestFormModal } from './GuestFormModal';
import { GuestImportModal } from './GuestImportModal';
import { InvitationStudio } from './InvitationStudio';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  CalendarPlus,
  Search,
  Trash2,
  Pencil,
  CheckCircle2,
  MailQuestion,
  UtensilsCrossed,
  UsersRound,
  ListChecks,
  MailOpen,
  AlertTriangle,
} from 'lucide-react';

/**
 * Guests & Invitations workspace — one tab, two coordinated views:
 *  - "list": live guest list with inline RSVP / plus-one / meal editing,
 *    bulk actions, CSV import & export, .ics calendar download, a live
 *    headcount panel that flows into the catering budget, and an
 *    RSVP-deadline chase banner.
 *  - "invitation": the AI Invitation Studio (see InvitationStudio.jsx).
 */
export const GuestManager = () => {
  const { activeEvent, updateGuest, deleteGuest, deleteGuests, setGuestsRsvp, showToast } = useEventContext();

  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [rsvpFilter, setRsvpFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestToEdit, setGuestToEdit] = useState(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const guests = activeEvent?.guests || [];

  /* Live RSVP math ------------------------------------------------------ */
  const stats = useMemo(() => calculateGuestStats(guests), [guests]);

  const rsvpDeadline = activeEvent?.invitation?.rsvpDeadline || '';
  const urgency = useMemo(() => getRsvpUrgency(rsvpDeadline), [rsvpDeadline]);

  /* Catering reality check: live headcount against the catering budget. */
  const catering = useMemo(() => {
    const rows = (activeEvent?.expenses || []).filter((x) => x.category === 'catering');
    const allocated = rows.reduce((s, x) => s + (Number(x.allocated) || 0), 0);
    const spent = rows.reduce((s, x) => s + (Number(x.spent) || 0), 0);
    const perGuest = stats.attendingHeadcount > 0 ? allocated / stats.attendingHeadcount : 0;
    return { allocated, spent, perGuest };
  }, [activeEvent, stats.attendingHeadcount]);

  /* Filtered list -------------------------------------------------------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (groupFilter !== 'all' && g.group !== groupFilter) return false;
      if (rsvpFilter !== 'all' && g.rsvp !== rsvpFilter) return false;
      if (
        q &&
        ![g.name, g.email, g.phone, g.notes].some((v) =>
          String(v || '').toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [guests, search, groupFilter, rsvpFilter]);

  /* Handlers -------------------------------------------------------------- */
  const openAddGuest = () => {
    setGuestToEdit(null);
    setIsGuestModalOpen(true);
  };

  const openEditGuest = (guest) => {
    setGuestToEdit(guest);
    setIsGuestModalOpen(true);
  };

  const handleExportCsv = () => {
    if (guests.length === 0) {
      showToast('No guests to export yet — add a few first.', 'info');
      return;
    }
    downloadTextFile(
      `${slugify(activeEvent.title)}-guest-list.csv`,
      guestsToCsv(guests),
      'text/csv;charset=utf-8'
    );
  };

  const handleDownloadIcs = () => {
    const ics = buildIcsCalendar(activeEvent, { rsvpDeadline });
    downloadTextFile(
      `${slugify(activeEvent.title)}-invitation.ics`,
      ics,
      'text/calendar;charset=utf-8'
    );
    showToast('Calendar file saved — open it to add the celebration (and RSVP reminder) to your calendar.', 'success');
  };

  const toggleSelected = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((g) => selected.includes(g.id));

  const toggleSelectAll = () => {
    setSelected((prev) =>
      allFilteredSelected ? prev.filter((id) => !filtered.some((g) => g.id === id)) : [
        ...new Set([...prev, ...filtered.map((g) => g.id)]),
      ]
    );
  };

  const handleBulkRsvp = (rsvp) => {
    setGuestsRsvp(selected, rsvp);
    setSelected([]);
  };

  const handleBulkDelete = () => {
    if (
      window.confirm(
        `Remove ${selected.length} guest${selected.length === 1 ? '' : 's'} from the list? This cannot be undone.`
      )
    ) {
      deleteGuests(selected);
      setSelected([]);
    }
  };

  const chasePending = () => {
    setRsvpFilter('invited');
    setSearch('');
    setGroupFilter('all');
  };

  const rsvpMeta = (id) => RSVP_STATUSES.find((s) => s.id === id) || RSVP_STATUSES[0];
  const groupMeta = (id) => GUEST_GROUPS.find((g) => g.id === id) || GUEST_GROUPS[1];
  const mealMeta = (id) => MEAL_OPTIONS.find((m) => m.id === id) || MEAL_OPTIONS[0];

  /* Render ---------------------------------------------------------------- */
  if (!activeEvent) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 flex items-center gap-1.5">
            <Users className="w-4 h-4" aria-hidden="true" />
            Invitations &amp; Guests
          </p>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 mt-1">
            Guest List &amp; RSVPs
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {stats.totalGuests} guest{stats.totalGuests === 1 ? '' : 's'} tracked ·{' '}
            <span className="font-semibold text-emerald-600">{stats.attendingHeadcount} confirmed seats</span>{' '}
            for {activeEvent.title}
          </p>
        </div>

        {/* View switcher */}
        <div
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl self-start"
          role="tablist"
          aria-label="Guest tools"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ListChecks className="w-4 h-4" aria-hidden="true" />
            Guest List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'invitation'}
            onClick={() => setView('invitation')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              view === 'invitation'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MailOpen className="w-4 h-4" aria-hidden="true" />
            Invitation Studio
          </button>
        </div>
      </div>

      {view === 'invitation' ? (
        <InvitationStudio onBackToList={() => setView('list')} />
      ) : (
        <>
          {/* RSVP deadline banner */}
          {urgency && stats.pending > 0 && (
            <div
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${urgency.color}`}
            >
              <p className="text-xs font-semibold flex items-center gap-2">
                <MailQuestion className="w-4 h-4 shrink-0" aria-hidden="true" />
                {urgency.label} — {stats.pending} guest{stats.pending === 1 ? '' : 's'} still to reply.
              </p>
              <button
                type="button"
                onClick={chasePending}
                className="text-xs font-bold underline underline-offset-2 hover:no-underline shrink-0 self-start sm:self-auto"
              >
                Show the chase list →
              </button>
            </div>
          )}
          {urgency?.status === 'overdue' && stats.pending === 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              The RSVP deadline has passed — all replies are in ({stats.responseRate}% responded).
            </div>
          )}

          {/* Live headcount panel */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <UsersRound className="w-3.5 h-3.5" aria-hidden="true" />
                Attending Seats
              </p>
              <p className="font-display font-extrabold text-3xl text-emerald-700 mt-1" data-testid="attending-headcount">
                {stats.attendingHeadcount}
              </p>
              <p className="text-[11px] text-emerald-600/80 mt-0.5">
                {stats.byStatus.attending} guests + {stats.plusOnesAttending} plus-ones
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Response Rate</p>
              <p className="font-display font-extrabold text-3xl text-slate-800 mt-1">{stats.responseRate}%</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {stats.responded} of {stats.totalGuests} replied
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Awaiting Reply</p>
              <p className="font-display font-extrabold text-3xl text-amber-600 mt-1">{stats.pending}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">invited, not yet answered</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Maybe</p>
              <p className="font-display font-extrabold text-3xl text-slate-800 mt-1">{stats.byStatus.maybe}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">holding the date</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Declined</p>
              <p className="font-display font-extrabold text-3xl text-slate-800 mt-1">{stats.byStatus.declined}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">regrets sent</p>
            </div>
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 flex items-center gap-1">
                <UtensilsCrossed className="w-3.5 h-3.5" aria-hidden="true" />
                Cost / Attending Seat
              </p>
              <p className="font-display font-extrabold text-2xl text-brand-700 mt-1">
                {catering.allocated > 0 && stats.attendingHeadcount > 0
                  ? formatCurrency(catering.perGuest)
                  : '—'}
              </p>
              <p className="text-[11px] text-brand-600/80 mt-0.5">
                {catering.allocated > 0
                  ? `${formatCurrency(catering.allocated)} catering budget`
                  : 'add catering expenses to see this'}
              </p>
            </div>
          </div>

          {/* Meal counts + capacity warning */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Attending meals:</span>
            {Object.keys(stats.mealCounts).length === 0 && (
              <span className="text-slate-400 italic">no attending guests yet</span>
            )}
            {MEAL_OPTIONS.filter((m) => stats.mealCounts[m.id] > 0).map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold"
              >
                <span aria-hidden="true">{m.icon}</span> {m.label} × {stats.mealCounts[m.id]}
              </span>
            ))}
            {stats.attendingHeadcount > Number(activeEvent.guestCount) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                Headcount exceeds the planned {activeEvent.guestCount} — update the venue/catering headcount.
              </span>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, notes…"
                aria-label="Search guests"
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                aria-label="Filter by group"
                className="px-3 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="all">All groups</option>
                {GUEST_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.icon} {g.label}
                  </option>
                ))}
              </select>
              <select
                value={rsvpFilter}
                onChange={(e) => setRsvpFilter(e.target.value)}
                aria-label="Filter by RSVP status"
                className="px-3 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="all">All RSVPs</option>
                {RSVP_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={openAddGuest}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-brand-600 hover:from-emerald-700 hover:to-brand-700 rounded-xl shadow-md shadow-emerald-500/20 transition-all"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                Add Guest
              </button>
              <button
                type="button"
                onClick={() => setIsImportOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100 rounded-xl transition-colors"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                Import
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                title="Download the guest list as CSV"
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleDownloadIcs}
                title="Download a calendar invite (.ics) with an RSVP-deadline reminder"
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                .ics
              </button>
            </div>
          </div>

          {/* Bulk action bar */}
          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-xs">
              <span className="font-bold text-brand-800">{selected.length} selected</span>
              <span className="w-px h-4 bg-brand-200" aria-hidden="true" />
              <button
                type="button"
                onClick={() => handleBulkRsvp('attending')}
                className="flex items-center gap-1 px-2.5 py-1.5 font-semibold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Mark Attending
              </button>
              <button
                type="button"
                onClick={() => handleBulkRsvp('declined')}
                className="px-2.5 py-1.5 font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors"
              >
                Mark Declined
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1 px-2.5 py-1.5 font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Remove
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="ml-auto font-semibold text-brand-700 underline underline-offset-2 hover:no-underline"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Guest rows */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white/60">
              <Users className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
              <h3 className="font-display font-bold text-lg text-slate-700 mt-3">
                {guests.length === 0 ? 'No guests yet' : 'No guests match your filters'}
              </h3>
              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                {guests.length === 0
                  ? 'Add guests one by one, or import your whole list from a CSV — RSVPs, plus-ones and meals are tracked here and flow straight into your catering numbers.'
                  : 'Try clearing the search or filters to see the full list.'}
              </p>
              {guests.length === 0 && (
                <div className="flex items-center justify-center gap-3 mt-5">
                  <button
                    type="button"
                    onClick={openAddGuest}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-brand-600 rounded-xl shadow-md shadow-emerald-500/20"
                  >
                    Add your first guest
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportOpen(true)}
                    className="px-5 py-2.5 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-xl"
                  >
                    Import from CSV
                  </button>
                </div>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((guest) => {
                const isSelected = selected.includes(guest.id);
                const rs = rsvpMeta(guest.rsvp);
                const gs = groupMeta(guest.group);
                return (
                  <li
                    key={guest.id}
                    className={`rounded-2xl border bg-white p-3 sm:p-4 transition-all ${
                      isSelected ? 'border-brand-400 ring-1 ring-brand-200' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 md:items-center">
                      {/* Select + identity */}
                      <div className="md:col-span-4 flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(guest.id)}
                          aria-label={`Select ${guest.name}`}
                          className="mt-1 w-4 h-4 accent-brand-600 rounded cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-800 truncate">{guest.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {[guest.email, guest.phone].filter(Boolean).join(' · ') || 'no contact details'}
                          </p>
                          {guest.notes && (
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2" title={guest.notes}>
                              {guest.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Group chip */}
                      <div className="md:col-span-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600">
                          <span aria-hidden="true">{gs.icon}</span> {gs.label}
                        </span>
                      </div>

                      {/* RSVP select */}
                      <div className="md:col-span-2">
                        <label className="sr-only" htmlFor={`rsvp-${guest.id}`}>
                          RSVP status for {guest.name}
                        </label>
                        <select
                          id={`rsvp-${guest.id}`}
                          value={guest.rsvp}
                          onChange={(e) => updateGuest(guest.id, { rsvp: e.target.value })}
                          className={`w-full px-2.5 py-1.5 text-xs font-bold border rounded-lg outline-none focus:ring-2 focus:ring-brand-400 ${rs.color}`}
                        >
                          {RSVP_STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Plus-ones */}
                      <div className="md:col-span-1">
                        <label className="sr-only" htmlFor={`plusones-${guest.id}`}>
                          Plus-ones for {guest.name}
                        </label>
                        <input
                          id={`plusones-${guest.id}`}
                          type="number"
                          min="0"
                          max="10"
                          value={guest.plusOnes}
                          onChange={(e) =>
                            updateGuest(guest.id, {
                              plusOnes: Math.max(0, Math.min(10, Number(e.target.value) || 0)),
                            })
                          }
                          title="Plus-ones / extra seats"
                          className="w-full px-2.5 py-1.5 text-xs font-bold text-center bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-400 outline-none"
                        />
                      </div>

                      {/* Meal select */}
                      <div className="md:col-span-1">
                        <label className="sr-only" htmlFor={`meal-${guest.id}`}>
                          Meal preference for {guest.name}
                        </label>
                        <select
                          id={`meal-${guest.id}`}
                          value={guest.meal}
                          onChange={(e) => updateGuest(guest.id, { meal: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-400 outline-none"
                          title="Meal preference"
                        >
                          {MEAL_OPTIONS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.icon} {m.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Row actions */}
                      <div className="md:col-span-2 flex md:justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditGuest(guest)}
                          aria-label={`Edit ${guest.name}`}
                          className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteGuest(guest.id)}
                          aria-label={`Remove ${guest.name}`}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer summary */}
          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-500">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-brand-600 rounded cursor-pointer"
                />
                {allFilteredSelected ? 'Deselect' : 'Select'} all {filtered.length} shown
              </label>
              <p>
                Showing {filtered.length} of {guests.length} guests · plus-ones are extra seats on top of the
                listed guest (max 10 each)
              </p>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <GuestFormModal
        isOpen={isGuestModalOpen}
        onClose={() => setIsGuestModalOpen(false)}
        guestToEdit={guestToEdit}
      />
      <GuestImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
};
