import React, { useState, useMemo } from 'react';
import { useEventContext } from '../../context/EventContext';
import { GIFT_PRIORITIES, GIFT_STATUSES, giftStats, matchesGift } from '../../lib/gifts/giftModel';
import { GiftFormModal } from './GiftFormModal';
import { formatCurrency, truncateText } from '../../utils/formatters';
import {
  Gift,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Store,
  CheckCircle2,
  HandHeart,
  Undo2,
} from 'lucide-react';

/**
 * Gift Registry tab — what the hosts would love to receive, with guest
 * claims. Every mutation flows through EventContext, so the global undo
 * (Ctrl+Z) covers registry edits too.
 */
export const GiftRegistry = () => {
  const {
    activeEvent,
    updateGift,
    deleteGift,
    claimGiftForGuest,
  } = useEventContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [giftToEdit, setGiftToEdit] = useState(null);

  const gifts = useMemo(() => activeEvent?.gifts || [], [activeEvent?.gifts]);
  const guestList = useMemo(() => activeEvent?.guests || [], [activeEvent?.guests]);

  const stats = useMemo(() => giftStats(gifts), [gifts]);

  const filteredGifts = useMemo(
    () =>
      gifts.filter(
        (g) =>
          (statusFilter === 'all' || g.status === statusFilter) &&
          matchesGift(g, searchTerm)
      ),
    [gifts, statusFilter, searchTerm]
  );

  if (!activeEvent) return null;

  const openAdd = () => {
    setGiftToEdit(null);
    setIsModalOpen(true);
  };

  const openEdit = (gift) => {
    setGiftToEdit(gift);
    setIsModalOpen(true);
  };

  const priorityInfo = (id) => GIFT_PRIORITIES.find((p) => p.id === id) || GIFT_PRIORITIES[1];
  const statusInfo = (id) => GIFT_STATUSES.find((s) => s.id === id) || GIFT_STATUSES[0];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900">
              Gift Registry
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200">
              {stats.claimed + stats.purchased} / {stats.total} Secured
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track wish-list items and see which guest claimed what — every change is undoable with Ctrl+Z
          </p>
        </div>

        <button
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-brand-600 hover:from-fuchsia-700 hover:to-brand-700 text-white font-bold text-xs shadow-lg shadow-fuchsia-500/25 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add Gift Item</span>
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registry Value</p>
          <h3 className="text-2xl font-display font-black text-slate-900 mt-1">
            {formatCurrency(stats.totalValue)}
          </h3>
          <p className="text-[11px] text-slate-500 mt-2">{stats.total} item{stats.total === 1 ? '' : 's'} on the wish list</p>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Claimed / Bought</p>
          <h3 className="text-2xl font-display font-black text-brand-600 mt-1">
            {stats.claimed + stats.purchased}
          </h3>
          <p className="text-[11px] text-slate-500 mt-2">
            {stats.securedPercent}% of the registry value secured ({formatCurrency(stats.securedValue)})
          </p>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Still Available</p>
          <h3 className="text-2xl font-display font-black text-emerald-600 mt-1">
            {stats.available}
          </h3>
          <p className="text-[11px] text-slate-500 mt-2">Waiting for a generous guest to claim</p>
        </div>
      </div>

      {/* Search + status filter */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search gifts, stores, notes…"
              aria-label="Search the gift registry"
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
            {[{ id: 'all', label: 'All' }, ...GIFT_STATUSES].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatusFilter(s.id)}
                aria-pressed={statusFilter === s.id}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  statusFilter === s.id
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {s.label}{s.id !== 'all' ? ` (${stats[s.id] ?? 0})` : ` (${stats.total})`}
              </button>
            ))}
          </div>
        </div>

        {/* Gift grid */}
        {filteredGifts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Gift className="w-10 h-10 mx-auto text-slate-300" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-600">
              {gifts.length === 0 ? 'Your registry is empty' : 'No gifts match this filter'}
            </p>
            <p className="text-xs text-slate-400">
              {gifts.length === 0
                ? 'Add wish-list items so guests know exactly what would make the celebration brighter.'
                : 'Try clearing the search or switching the status filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {filteredGifts.map((gift) => {
              const prio = priorityInfo(gift.priority);
              const stat = statusInfo(gift.status);
              return (
                <div
                  key={gift.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${prio.color}`}
                      >
                        <Gift className="w-3 h-3" aria-hidden="true" />
                        {prio.label}
                      </span>
                      <select
                        value={gift.status}
                        onChange={(e) => updateGift(gift.id, { status: e.target.value })}
                        aria-label={`Status of ${gift.name}`}
                        className={`text-[10px] font-bold px-2 py-1 rounded-full border outline-none cursor-pointer ${stat.color}`}
                      >
                        {GIFT_STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <h4 className="font-display font-extrabold text-base text-slate-900">{gift.name}</h4>
                      {gift.store && (
                        <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <Store className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          {gift.url ? (
                            <a
                              href={gift.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-brand-600 hover:underline inline-flex items-center gap-1"
                            >
                              {truncateText(gift.store, 30)}
                              <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                            </a>
                          ) : (
                            gift.store
                          )}
                        </p>
                      )}
                    </div>

                    {gift.notes && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl line-clamp-2 border border-slate-100">
                        {gift.notes}
                      </p>
                    )}
                  </div>

                  {/* Claim row */}
                  <div className="space-y-2">
                    {gift.status === 'available' ? (
                      <div className="flex items-center gap-2">
                        <HandHeart className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                        <select
                          value=""
                          onChange={(e) => {
                            const g = guestList.find((x) => x.id === e.target.value);
                            if (g) claimGiftForGuest(gift.id, g);
                          }}
                          aria-label={`Claim ${gift.name} for a guest`}
                          className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 font-medium text-slate-600 outline-none cursor-pointer focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">Assign a claimer…</option>
                          {guestList.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            gift.status === 'purchased' ? 'text-brand-700' : 'text-amber-700'
                          }`}
                        >
                          {gift.status === 'purchased' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <HandHeart className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          {gift.claimedByName ? truncateText(gift.claimedByName, 24) : 'Claimed'}
                        </span>
                        {gift.status !== 'purchased' && (
                          <button
                            type="button"
                            onClick={() => claimGiftForGuest(gift.id, null)}
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-600 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded-md px-1"
                            title="Release this claim"
                            aria-label={`Release the claim on ${gift.name}`}
                          >
                            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                            Release
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer: price + actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Price</span>
                      <span className="text-sm font-extrabold text-slate-900">{formatCurrency(gift.price)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(gift)}
                        title="Edit item"
                        aria-label={`Edit ${gift.name}`}
                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove "${gift.name}" from the registry? (Ctrl+Z brings it back)`)) {
                            deleteGift(gift.id);
                          }
                        }}
                        title="Remove item"
                        aria-label={`Remove ${gift.name}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <GiftFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        giftToEdit={giftToEdit}
      />
    </div>
  );
};
