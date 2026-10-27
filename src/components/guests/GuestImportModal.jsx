import React, { useState, useRef } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useEventContext } from '../../context/EventContext';
import { parseGuestsCsv } from '../../utils/exporters';
import { X, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Bulk guest import: paste CSV text or pick a .csv file, preview the parsed
 * rows (aliases like "yes"/"no"/"veg" are normalized), then commit them in
 * ONE state update via addGuests().
 */
export const GuestImportModal = ({ isOpen, onClose }) => {
  const { addGuests } = useEventContext();
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const panelRef = useModalFocus(isOpen, onClose);

  const parsed = isOpen ? parseGuestsCsv(csvText) : { guests: [], skipped: 0, errors: [] };

  const reset = () => {
    setCsvText('');
    setFileName('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.readAsText(file);
    // Allow re-picking the same file later.
    e.target.value = '';
  };

  const handleImport = () => {
    if (parsed.guests.length === 0) return;
    const added = addGuests(parsed.guests);
    if (added > 0) {
      reset();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Upload className="w-5 h-5 text-amber-200" aria-hidden="true" />
            </div>
            <div>
              <h3 id="guest-import-title" className="font-display font-bold text-lg">
                Import Guest List
              </h3>
              <p className="text-xs text-brand-100">
                Paste CSV or upload a file — Name column required
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close import dialog"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="guest-csv-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              CSV Text {fileName && <span className="text-brand-600 normal-case">— loaded from {fileName}</span>}
            </label>
            <textarea
              id="guest-csv-input"
              rows={6}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setFileName('');
              }}
              placeholder={`Name,Email,Phone,Group,RSVP,PlusOnes,Meal,Notes\nEleanor Vance,e@mail.com,(555) 010-1,family,yes,1,vegetarian,Aisle seat`}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Friendly values are recognized: yes / no / maybe, veg / gf / kids, family / colleagues…
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleFile}
              className="hidden"
              id="guest-csv-file"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100 rounded-xl transition-colors"
            >
              Choose .csv File…
            </button>
            {csvText && (
              <button
                type="button"
                onClick={reset}
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Parse feedback */}
          {csvText.trim() && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              {parsed.guests.length > 0 ? (
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Ready to import {parsed.guests.length} guest{parsed.guests.length === 1 ? '' : 's'}
                  {parsed.skipped > 0 && ` (${parsed.skipped} row${parsed.skipped === 1 ? '' : 's'} skipped)`}
                </p>
              ) : (
                <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  No valid guests found yet.
                </p>
              )}
              {parsed.errors.length > 0 && (
                <ul className="text-[11px] text-slate-500 space-y-0.5 list-disc list-inside">
                  {parsed.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
              {parsed.guests.length > 0 && (
                <div className="max-h-32 overflow-y-auto text-[11px] text-slate-600 space-y-0.5">
                  {parsed.guests.slice(0, 8).map((g, i) => (
                    <p key={i} className="truncate">
                      <span className="font-semibold">{g.name}</span>
                      {g.rsvp !== 'invited' && <span className="text-emerald-600"> · {g.rsvp}</span>}
                      {g.plusOnes > 0 && <span className="text-brand-600"> · +{g.plusOnes}</span>}
                      {g.meal !== 'standard' && <span className="text-slate-400"> · {g.meal}</span>}
                    </p>
                  ))}
                  {parsed.guests.length > 8 && (
                    <p className="text-slate-400">…and {parsed.guests.length - 8} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={parsed.guests.length === 0}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 rounded-xl shadow-md shadow-brand-500/25 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              Import {parsed.guests.length > 0 ? `${parsed.guests.length} Guest${parsed.guests.length === 1 ? '' : 's'}` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
