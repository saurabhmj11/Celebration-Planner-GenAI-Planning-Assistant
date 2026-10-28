import React, { useState, useMemo } from 'react';
import { useEventContext } from '../../context/EventContext';
import { VENDOR_CATEGORIES, VENDOR_STATUSES } from '../../data/defaultData';
import { calculateVendorStats } from '../../utils/calculator';
import { VendorAI } from '../ai/VendorAI';
import { QuoteCompareModal } from './QuoteCompareModal';
import { formatCurrency } from '../../utils/formatters';
import {
  Users,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  User,
  Star,
  Edit2,
  Trash2,
  ArrowUpDown,
  Scale
} from 'lucide-react';

export const VendorChecklist = ({ onOpenVendorModal, onEditVendor }) => {
  const { activeEvent, deleteVendor, updateVendorStatus } = useEventContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('cost'); // cost, name, rating
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareCategory, setCompareCategory] = useState(null);

  const vendors = useMemo(() => activeEvent?.vendors || [], [activeEvent?.vendors]);
  const { totalVendors, bookedCount, totalCommittedCost } = useMemo(
    () => calculateVendorStats(vendors),
    [vendors]
  );
  const totalQuotes = useMemo(
    () => vendors.reduce((sum, v) => sum + (Array.isArray(v.quotes) ? v.quotes.length : 0), 0),
    [vendors]
  );

  const openCompare = (category = null) => {
    setCompareCategory(category);
    setIsCompareOpen(true);
  };

  // Filtered & Sorted
  const filteredVendors = useMemo(() => {
    return vendors
      .filter((v) => {
        const matchesSearch =
          v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (v.contactPerson && v.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (v.notes && v.notes.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = selectedCategory === 'all' || v.category === selectedCategory;
        const matchesStatus = selectedStatus === 'all' || v.status === selectedStatus;
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'cost') return (b.cost || 0) - (a.cost || 0);
        if (sortBy === 'rating') return (b.rating || 5) - (a.rating || 5);
        return a.name.localeCompare(b.name);
      });
  }, [vendors, searchTerm, selectedCategory, selectedStatus, sortBy]);

  if (!activeEvent) return null;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* AI Vendor Advisor */}
      <VendorAI />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900">
              Vendor Checklist & Directory
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              {bookedCount} / {totalVendors} Booked
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track suppliers, catering, venue contacts, quotes, and booking confirmations
          </p>
        </div>

        <button
          onClick={onOpenVendorModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-brand-600 hover:from-rose-700 hover:to-brand-700 text-white font-bold text-xs shadow-lg shadow-rose-500/25 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Vendor Partner</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => openCompare(null)}
          disabled={totalQuotes === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold text-brand-800 bg-brand-50 border border-brand-200 hover:bg-brand-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Scale className="w-4 h-4" aria-hidden="true" />
          <span>Compare Quotes ({totalQuotes})</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Vendor Partners</p>
          <h3 className="text-2xl font-display font-black text-slate-900 mt-1">
            {totalVendors}
          </h3>
          <p className="text-[11px] text-slate-500 mt-2">Suppliers across all categories</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirmed Bookings</p>
          <h3 className="text-2xl font-display font-black text-rose-600 mt-1">
            {bookedCount}
          </h3>
          <p className="text-[11px] text-slate-500 mt-2">
            {totalVendors > 0 ? `${Math.round((bookedCount / totalVendors) * 100)}% secured` : 'No vendors yet'}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Committed Quotes</p>
          <h3 className="text-2xl font-display font-black text-slate-900 mt-1">
            {formatCurrency(totalCommittedCost)}
          </h3>
          <p className="text-[11px] text-slate-500 mt-2">
            Budget ceiling: {formatCurrency(activeEvent.budget)}
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vendors by name, contact, notes..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent font-medium text-slate-700 outline-none text-xs"
              >
                <option value="all">All Categories</option>
                {VENDOR_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent font-medium text-slate-700 outline-none text-xs"
              >
                <option value="all">All Booking Statuses</option>
                {VENDOR_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent font-medium text-slate-700 outline-none text-xs"
              >
                <option value="cost">Sort by Cost</option>
                <option value="name">Sort by Name</option>
                <option value="rating">Sort by Rating</option>
              </select>
            </div>
          </div>
        </div>

        {/* Vendors Grid */}
        {filteredVendors.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No vendors found</p>
            <p className="text-xs text-slate-400">
              {searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all'
                ? 'Try adjusting your search query or filters'
                : 'Click "+ Add Vendor Partner" to begin building your celebration vendor roster'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {filteredVendors.map((vendor) => {
              const cat = VENDOR_CATEGORIES.find((c) => c.id === vendor.category) || VENDOR_CATEGORIES[0];
              const statusObj = VENDOR_STATUSES.find((s) => s.id === vendor.status) || VENDOR_STATUSES[0];

              return (
                <div
                  key={vendor.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header Row: Category Badge & Status selector */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>

                      {/* Interactive inline status change */}
                      <select
                        value={vendor.status}
                        onChange={(e) => updateVendorStatus(vendor.id, e.target.value)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-full border outline-none cursor-pointer ${statusObj.color}`}
                      >
                        {VENDOR_STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Vendor Name & Star Rating */}
                    <div>
                      <h4 className="font-display font-extrabold text-base text-slate-900">
                        {vendor.name}
                      </h4>
                      <div className="flex items-center gap-1 mt-1 text-amber-400">
                        {[...Array(vendor.rating || 5)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                        ))}
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                      {vendor.contactPerson && (
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-700">{vendor.contactPerson}</span>
                        </div>
                      )}

                      {vendor.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <a
                            href={`tel:${vendor.phone}`}
                            className="hover:text-brand-600 hover:underline"
                          >
                            {vendor.phone}
                          </a>
                        </div>
                      )}

                      {vendor.email && (
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <a
                            href={`mailto:${vendor.email}`}
                            className="hover:text-brand-600 hover:underline truncate"
                          >
                            {vendor.email}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {vendor.notes && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl line-clamp-2 border border-slate-100">
                        {vendor.notes}
                      </p>
                    )}
                  </div>

                  {/* Card Footer: Quote & Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Estimated Quote
                      </span>
                      <span className="text-sm font-extrabold text-slate-900">
                        {formatCurrency(vendor.cost)}
                      </span>
                      {Array.isArray(vendor.quotes) && vendor.quotes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => openCompare(vendor.category)}
                          className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors align-middle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          title={`Compare ${vendor.quotes.length} quote${vendor.quotes.length === 1 ? '' : 's'} in this category`}
                        >
                          <Scale className="w-3 h-3" aria-hidden="true" />
                          {vendor.quotes.length} quote{vendor.quotes.length === 1 ? '' : 's'}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditVendor(vendor)}
                        title="Edit Vendor"
                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove vendor "${vendor.name}"?`)) {
                            deleteVendor(vendor.id);
                          }
                        }}
                        title="Remove Vendor"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <QuoteCompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        initialCategory={compareCategory}
      />
    </div>
  );
};
