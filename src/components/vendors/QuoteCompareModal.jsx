import React, { useState, useEffect, useMemo } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useEventContext } from '../../context/EventContext';
import { VENDOR_CATEGORIES } from '../../data/defaultData';
import { buildCategoryComparison, quoteStats } from '../../lib/vendors/quoteModel';
import { formatCurrency, formatShortDate } from '../../utils/formatters';
import {
  X,
  Scale,
  Plus,
  Star,
  Trash2,
  CheckCircle2,
  BadgeDollarSign,
  TrendingDown,
} from 'lucide-react';

/**
 * Side-by-side vendor quote comparison. Opens scoped to one category (the
 * button on a vendor card passes that vendor's category) or shows every
 * category that has quotes. Accepting a quote syncs the vendor's cost + flips
 * it to booked (undoable via Ctrl+Z like every mutation).
 */
export const QuoteCompareModal = ({ isOpen, onClose, initialCategory = null }) => {
  const { activeEvent, addVendorQuote, deleteVendorQuote, acceptVendorQuote } = useEventContext();

  const [category, setCategory] = useState(initialCategory);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');

  const [quoteForm, setQuoteForm] = useState({
    vendorId: '',
    company: '',
    amount: '',
    date: '',
    inclusions: '',
  });

  const vendors = useMemo(() => activeEvent?.vendors || [], [activeEvent?.vendors]);

  // All category blocks that actually carry quotes.
  const allBlocks = useMemo(() => buildCategoryComparison(vendors), [vendors]);
  const availableCategories = useMemo(() => allBlocks.map((b) => b.category), [allBlocks]);

  // Keep the selected category valid whenever data changes.
  useEffect(() => {
    if (!isOpen) return;
    if (availableCategories.length === 0) {
      setCategory(null);
      return;
    }
    if (!category || !availableCategories.includes(category)) {
      setCategory(initialCategory && availableCategories.includes(initialCategory) ? initialCategory : availableCategories[0]);
    }
  }, [isOpen, availableCategories, category, initialCategory]);

  // Reset the add form when the category or open-state changes.
  useEffect(() => {
    if (!isOpen) return;
    setShowAddForm(false);
    setFormError('');
    const candidates = vendors.filter((v) => v.category === category);
    setQuoteForm({
      vendorId: candidates[0]?.id || '',
      company: candidates[0]?.name || '',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      inclusions: '',
    });
  }, [isOpen, category, vendors]);

  const panelRef = useModalFocus(isOpen, onClose);

  const categoryVendors = useMemo(
    () => vendors.filter((v) => v.category === category),
    [vendors, category]
  );

  if (!isOpen) return null;

  const block = allBlocks.find((b) => b.category === category) || null;
  const stats = block ? block.stats : quoteStats([]);
  const categoryLabel = (id) =>
    VENDOR_CATEGORIES.find((c) => c.id === id)?.label || id;

  const submitQuote = (e) => {
    e.preventDefault();
    if (!quoteForm.vendorId) {
      setFormError('Pick which vendor this quote belongs to.');
      return;
    }
    const amount = Number(quoteForm.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError('Enter a valid amount (0 or more).');
      return;
    }
    const ok = addVendorQuote(quoteForm.vendorId, {
      company: quoteForm.company || vendors.find((v) => v.id === quoteForm.vendorId)?.name,
      amount,
      date: quoteForm.date,
      inclusions: quoteForm.inclusions,
      source: 'manual',
    });
    if (ok) {
      setShowAddForm(false);
      setFormError('');
      setQuoteForm((f) => ({ ...f, company: '', amount: '', inclusions: '' }));
    } else {
      setFormError('Could not save that quote — check the amount.');
    }
  };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-compare-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-rose-600 to-brand-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Scale className="w-5 h-5 text-amber-300" aria-hidden="true" />
            </div>
            <div>
              <h3 id="quote-compare-title" className="font-display font-bold text-lg">
                Compare Vendor Quotes
              </h3>
              <p className="text-xs text-rose-100">
                {allBlocks.length} categor{allBlocks.length === 1 ? 'y' : 'ies'} with quotes · best value highlighted
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quote comparison"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto custom-scrollbar p-6 space-y-5">
          {allBlocks.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Scale className="w-10 h-10 mx-auto text-slate-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-600">No quotes recorded yet</p>
              <p className="text-xs text-slate-400">
                Add a quote to any vendor below, then compare offers side by side before you book.
              </p>
            </div>
          ) : (
            <>
              {/* Category chips */}
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quote category">
                {allBlocks.map((b) => (
                  <button
                    key={b.category}
                    type="button"
                    onClick={() => setCategory(b.category)}
                    aria-pressed={category === b.category}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      category === b.category
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {categoryLabel(b.category)} · {b.rows.length}
                  </button>
                ))}
              </div>

              {block && (
                <>
                  {/* Stats strip */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                        <BadgeDollarSign className="w-3 h-3" aria-hidden="true" /> Best Value
                      </p>
                      <p className="text-base font-extrabold text-emerald-800 mt-0.5">{formatCurrency(stats.lowest)}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Average</p>
                      <p className="text-base font-extrabold text-amber-800 mt-0.5">{formatCurrency(stats.average)}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Spread</p>
                      <p className="text-base font-extrabold text-slate-700 mt-0.5">{formatCurrency(stats.spread)}</p>
                    </div>
                  </div>

                  {/* Comparison rows */}
                  <div className="space-y-2.5">
                    {block.rows.map((row) => (
                      <div
                        key={`${row.vendorId}:${row.quoteId}`}
                        className={`rounded-2xl border p-4 transition-all ${
                          row.isLowest
                            ? 'border-emerald-300 bg-emerald-50/60 shadow-sm'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-display font-extrabold text-sm text-slate-900">{row.company}</span>
                              {row.isLowest && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <TrendingDown className="w-3 h-3" aria-hidden="true" /> Best value
                                </span>
                              )}
                              {row.isTopRated && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" /> Top rated
                                </span>
                              )}
                              {row.savingsVsTop > 0 && (
                                <span className="text-[10px] font-bold text-slate-500">
                                  saves {formatCurrency(row.savingsVsTop)} vs priciest
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              via {row.vendorName} · {row.date ? formatShortDate(row.date) : 'no date'} · quote for {categoryLabel(block.category)}
                            </p>
                            {row.inclusions && (
                              <p className="text-[11px] text-slate-600 mt-1.5 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5 line-clamp-2">
                                {row.inclusions}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-base font-extrabold text-slate-900">{formatCurrency(row.amount)}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => acceptVendorQuote(row.vendorId, row.quoteId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteVendorQuote(row.vendorId, row.quoteId)}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Add quote */}
          <div className="border-t border-slate-100 pt-4">
            {!showAddForm ? (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                disabled={vendors.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                {vendors.length === 0 ? 'Add a vendor first to record quotes' : 'Record another quote'}
              </button>
            ) : (
              <form onSubmit={submitQuote} className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">New quote</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="quote-vendor" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Vendor <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="quote-vendor"
                      value={quoteForm.vendorId}
                      onChange={(e) => {
                        const v = vendors.find((x) => x.id === e.target.value);
                        setQuoteForm((f) => ({ ...f, vendorId: e.target.value, company: v?.name || f.company }));
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Choose a vendor…</option>
                      {(categoryVendors.length > 0 ? categoryVendors : vendors).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({categoryLabel(v.category)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="quote-company" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Quoting company
                    </label>
                    <input
                      id="quote-company"
                      type="text"
                      value={quoteForm.company}
                      onChange={(e) => setQuoteForm((f) => ({ ...f, company: e.target.value }))}
                      placeholder="e.g. Golden Harvest Catering"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="quote-amount" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Amount (USD) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="quote-amount"
                      type="number"
                      min="0"
                      step="1"
                      value={quoteForm.amount}
                      onChange={(e) => setQuoteForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="e.g. 4500"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="quote-date" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Quote date
                    </label>
                    <input
                      id="quote-date"
                      type="date"
                      value={quoteForm.date}
                      onChange={(e) => setQuoteForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="quote-inclusions" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    What it includes
                  </label>
                  <input
                    id="quote-inclusions"
                    type="text"
                    value={quoteForm.inclusions}
                    onChange={(e) => setQuoteForm((f) => ({ ...f, inclusions: e.target.value }))}
                    placeholder="e.g. Dinner for 100, service staff, cake cutting"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                {formError && <p className="text-xs text-rose-600 font-semibold">{formError}</p>}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-brand-600 hover:from-rose-700 hover:to-brand-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    Save quote
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
