import React, { useState, useEffect } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useEventContext } from '../../context/EventContext';
import { CURRENCIES, effectiveRate, currencyOf, formatMoney } from '../../lib/currency/currencyModel';
import { formatCurrency } from '../../utils/formatters';
import { X, Coins, Info, RotateCcw } from 'lucide-react';

/**
 * Display-currency settings: pick the currency, choose whether amounts are
 * converted through an editable rate or just re-formatted, and tune the
 * rate. Amounts always stay stored in USD — this layer is display-only, so
 * switching currency can never corrupt a budget.
 */
export const CurrencyModal = ({ isOpen, onClose }) => {
  const { currencyConfig, setDisplayCurrency } = useEventContext();

  const [draftCode, setDraftCode] = useState(currencyConfig.code);
  const [draftConvert, setDraftConvert] = useState(currencyConfig.convert);
  const [draftRate, setDraftRate] = useState(() => String(effectiveRate(currencyConfig, currencyConfig.code)));

  useEffect(() => {
    if (!isOpen) return;
    setDraftCode(currencyConfig.code);
    setDraftConvert(currencyConfig.convert);
    setDraftRate(String(effectiveRate(currencyConfig, currencyConfig.code)));
  }, [isOpen, currencyConfig]);

  const panelRef = useModalFocus(isOpen, onClose);

  if (!isOpen) return null;

  const meta = currencyOf(draftCode);

  const pickCurrency = (code) => {
    setDraftCode(code);
    // Show the effective (override-or-default) rate for the newly picked code.
    setDraftRate(String(effectiveRate(currencyConfig, code)));
  };

  const resetRate = () => {
    setDraftRate(String(currencyOf(draftCode).defaultRate));
  };

  const handleSave = () => {
    const rates = { ...currencyConfig.rates };
    const parsed = Number(draftRate);
    if (Number.isFinite(parsed) && parsed > 0 && parsed !== meta.defaultRate) {
      rates[draftCode] = parsed;
    } else {
      delete rates[draftCode]; // default rate — no override needed
    }
    setDisplayCurrency({ code: draftCode, convert: draftConvert, rates });
    onClose();
  };

  const previewAmount = 32000; // the sample wedding budget — instantly recognizable
  const previewConfig = {
    code: draftCode,
    convert: draftConvert,
    rates: Number.isFinite(Number(draftRate)) && Number(draftRate) > 0 ? { [draftCode]: Number(draftRate) } : {},
  };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="currency-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Coins className="w-5 h-5 text-amber-300" aria-hidden="true" />
            </div>
            <div>
              <h3 id="currency-modal-title" className="font-display font-bold text-lg">
                Display Currency
              </h3>
              <p className="text-xs text-emerald-100">How money shows across every tab</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close currency settings"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Choose your currency</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="group" aria-label="Currency choices">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => pickCurrency(c.code)}
                  aria-pressed={draftCode === c.code}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    draftCode === c.code
                      ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base font-extrabold text-slate-800" aria-hidden="true">{c.symbol}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-800">{c.code}</span>
                    <span className="block text-[10px] text-slate-500 truncate">{c.name}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Convert toggle */}
          <label className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={draftConvert}
              onChange={(e) => setDraftConvert(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
            />
            <span>
              <span className="block text-xs font-bold text-slate-800">
                Convert amounts using the exchange rate
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                On: $32,000 shows as {formatMoney(previewAmount, { ...previewConfig, convert: true })}.
                Off: same numbers, new symbol — {formatMoney(previewAmount, { ...previewConfig, convert: false })}.
              </span>
            </span>
          </label>

          {/* Rate editor */}
          <div>
            <label htmlFor="currency-rate" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              USD → {draftCode} rate {draftCode === 'USD' && <span className="text-slate-400 normal-case">(fixed at 1)</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="currency-rate"
                type="number"
                min="0.0001"
                step="0.0001"
                value={draftCode === 'USD' ? '1' : draftRate}
                disabled={draftCode === 'USD'}
                onChange={(e) => setDraftRate(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              />
              {draftCode !== 'USD' && (
                <button
                  type="button"
                  onClick={resetRate}
                  title={`Reset to the built-in rate (${meta.defaultRate})`}
                  className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Default
                </button>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Preview</p>
            <p className="text-sm text-slate-700 mt-1">
              Sample wedding budget: <span className="font-extrabold text-slate-900">{formatCurrency(previewAmount)}</span>
              <span className="text-slate-400 mx-2" aria-hidden="true">→</span>
              <span className="font-extrabold text-emerald-800">{formatMoney(previewAmount, previewConfig)}</span>
            </p>
          </div>

          {/* Explainer */}
          <div className="flex items-start gap-2.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
            <Info className="w-4 h-4 shrink-0 text-slate-400 mt-px" aria-hidden="true" />
            <p>
              Your amounts stay stored in USD — currency settings only change how they are displayed, so
              nothing can corrupt your budget. Built-in rates are sensible defaults: adjust the rate above to
              match today&apos;s exchange rate, or turn conversion off to keep the raw numbers.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-lg shadow-emerald-500/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Save Currency
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
