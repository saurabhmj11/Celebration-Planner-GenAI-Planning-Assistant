import React, { useMemo, useState } from 'react';
import { Users, ClipboardCopy, Mail, Plus, CheckCircle2, HelpCircle } from 'lucide-react';
import { useEventContext } from '../../context/EventContext';
import { VENDOR_CATEGORIES } from '../../data/defaultData';
import { aiAssist } from '../../services/aiAssist';
import { AiButton, AiCard, AiErrorNote, AiSkeleton, AiSourceNote, mapCategoryToFallback, useAiRequest } from './aiKit';

/**
 * AI Vendor Advisor — two capabilities in one panel:
 *  1. Vendor gap analysis: what's missing for this event type + the sharp
 *     questions to ask any vendor, applicable as real vendor rows.
 *  2. Inquiry drafting: a personalized outreach email for any vendor on the
 *     list, ready to copy.
 */
export function VendorAI() {
  const { activeEvent, addVendor, showToast } = useEventContext();
  const { status, error, run, reset, isIdle, isLoading, isDone, result } = useAiRequest();
  const [addedAll, setAddedAll] = useState(false);

  // Inquiry drafting state
  const [inquiryVendorId, setInquiryVendorId] = useState('');
  const [inquiry, setInquiry] = useState(null);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const vendors = useMemo(() => activeEvent?.vendors || [], [activeEvent?.vendors]);
  const existingCategories = useMemo(() => [...new Set(vendors.map((v) => v.category))], [vendors]);
  const selectedVendor = vendors.find((v) => v.id === inquiryVendorId) || null;

  if (!activeEvent) return null;

  const handleSuggest = () => run(() =>
    aiAssist.vendorPlan({
      eventType: activeEvent.type || 'other',
      guestCount: activeEvent.guestCount || 0,
      totalBudget: activeEvent.budget || 0,
      existingCategories,
    })
  );

  const handleAddAll = () => {
    const suggestions = result?.data?.suggestions || [];
    let added = 0;
    for (const s of suggestions) {
      addVendor({
        name: `${s.category} — to source`,
        category: mapCategoryToFallback(s.category, VENDOR_CATEGORIES) || 'rentals',
        cost: 0,
        status: 'researching',
        contactPerson: '',
        rating: 5,
        notes: `${s.why}\nEst. range: ${s.estCostRange}`,
      });
      added += 1;
    }
    if (added > 0) {
      showToast(`AI Vendor Advisor added ${added} vendor categor${added === 1 ? 'y' : 'ies'} to track! ✨`, 'success');
      setAddedAll(true);
    }
  };

  const handleDraftInquiry = async () => {
    if (!selectedVendor) return;
    setInquiryLoading(true);
    setCopied(false);
    try {
      const res = await aiAssist.vendorInquiry({
        eventType: activeEvent.type || 'other',
        eventTitle: activeEvent.title || 'our celebration',
        eventDate: activeEvent.date || undefined,
        location: activeEvent.location || undefined,
        guestCount: activeEvent.guestCount || 0,
        vendorName: selectedVendor.name,
        vendorCategory:
          VENDOR_CATEGORIES.find((c) => c.id === selectedVendor.category)?.label || selectedVendor.category,
        estCost: selectedVendor.cost || undefined,
      });
      setInquiry(res);
    } catch (_err) {
      setInquiry({ data: null, error: 'Could not draft the inquiry. Please retry.' });
    } finally {
      setInquiryLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inquiry?.data) return;
    const text = `Subject: ${inquiry.data.subject}\n\n${inquiry.data.message}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('Inquiry copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch (_err) {
      showToast('Copy failed — select the text manually.', 'error');
    }
  };

  return (
    <AiCard
      id="vendor-ai"
      icon={Users}
      title="AI Vendor Advisor"
      subtitle="Gap analysis, must-ask questions & ready-to-send inquiries"
    >
      <div aria-live="polite" className="space-y-5">
        {/* ---- Capability 1: gap analysis ---- */}
        {isIdle && (
          <div>
            <p className="text-sm text-slate-600">
              Find out which vendor categories your {activeEvent.type || 'event'} is still missing — with
              realistic cost ranges for {activeEvent.guestCount || 0} guests — and the six questions that
              expose hidden fees before you sign.
            </p>
            <div className="mt-3">
              <AiButton onClick={handleSuggest} loading={isLoading}>
                Analyze Vendor Gaps
              </AiButton>
            </div>
          </div>
        )}

        {isLoading && <AiSkeleton rows={5} />}

        {isDone && result?.data && (
          <div>
            <p className="text-sm font-semibold text-slate-800">{result.data.headline}</p>

            <ul className="mt-3 space-y-2">
              {result.data.suggestions.map((s, i) => (
                <li key={i} className="bg-white/80 border border-amber-100 rounded-2xl p-3">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">{s.category}</span>
                    <span className="text-[11px] font-bold text-amber-700">{s.estCostRange}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">{s.why}</p>
                </li>
              ))}
            </ul>

            <div className="mt-3 bg-white/80 border border-amber-100 rounded-2xl p-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" /> Ask Every Vendor
              </p>
              <ol className="space-y-1.5 list-decimal list-outside pl-4">
                {result.data.questions.map((q, i) => (
                  <li key={i} className="text-xs text-slate-700">{q}</li>
                ))}
              </ol>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <AiButton small onClick={handleAddAll}>
                {addedAll ? (
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Added</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" aria-hidden="true" /> Add all as vendor rows</span>
                )}
              </AiButton>
              <button
                type="button"
                onClick={handleSuggest}
                className="text-xs font-bold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md px-1"
              >
                Re-analyze
              </button>
            </div>

            <AiSourceNote result={result} />
          </div>
        )}

        <AiErrorNote error={error} />

        {/* ---- Capability 2: inquiry drafting ---- */}
        <div className="border-t border-amber-200/60 pt-4">
          <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
            Draft a personalized vendor inquiry
          </p>

          {vendors.length === 0 ? (
            <p className="text-[11px] text-slate-500 mt-2">Add a vendor above to unlock AI-drafted outreach messages.</p>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <label htmlFor="inquiry-vendor" className="sr-only">Choose a vendor</label>
              <select
                id="inquiry-vendor"
                value={inquiryVendorId}
                onChange={(e) => { setInquiryVendorId(e.target.value); setInquiry(null); }}
                className="text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3 py-2 min-w-0 max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <option value="">Choose a vendor…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({VENDOR_CATEGORIES.find((c) => c.id === v.category)?.label || v.category})</option>
                ))}
              </select>
              <AiButton small onClick={handleDraftInquiry} loading={inquiryLoading} disabled={!selectedVendor}>
                Draft Inquiry
              </AiButton>
            </div>
          )}

          {inquiry?.data && (
            <div className="mt-3 bg-white/90 border border-amber-200 rounded-2xl p-3.5">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subject</p>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">{inquiry.data.subject}</p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-3">Message</p>
              <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-line">{inquiry.data.message}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    copied ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <ClipboardCopy className="w-3.5 h-3.5" aria-hidden="true" />}
                  {copied ? 'Copied!' : 'Copy message'}
                </button>
                <AiSourceNote result={inquiry} />
              </div>
            </div>
          )}
          {inquiry?.error && <AiErrorNote error={inquiry.error} />}
        </div>
      </div>
    </AiCard>
  );
}
