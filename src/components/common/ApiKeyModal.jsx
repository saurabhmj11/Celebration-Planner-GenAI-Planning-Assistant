import React, { useState, useEffect } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useEventContext } from '../../context/EventContext';
import { GEMINI_MODEL, categorizeGeminiError } from '../../services/geminiService.js';
import { Key, ShieldCheck, Sparkles, X, Check, ExternalLink, AlertTriangle, Clock, RefreshCw } from 'lucide-react';

export const ApiKeyModal = ({ isOpen, onClose }) => {
  const { apiKey, setApiKey, showToast } = useEventContext();
  const [inputKey, setInputKey] = useState(apiKey || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleSave = (e) => {
    e.preventDefault();
    setApiKey(inputKey.trim());
    showToast(inputKey.trim() ? 'Custom Gemini key saved!' : 'Reverted to the built-in AI engine.', 'success');
    onClose();
  };

  const handleTestKey = async () => {
    const keyToTest = inputKey.trim();
    if (!keyToTest) {
      setTestResult({
        success: false,
        title: 'Missing API Key',
        message: 'Please enter an API key to test.',
        guidance: 'Paste your key from Google AI Studio above.'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const controller = new AbortController();
    let isTimeout = false;
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      controller.abort(new DOMException('Test connection timed out after 30 seconds', 'TimeoutError'));
    }, 30000);

    try {
      console.log(`[ApiKeyModal] Testing Gemini API key with model ${GEMINI_MODEL}...`);
      // Use secure x-goog-api-key header instead of putting key in URL query params
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': keyToTest
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with OK' }] }]
        })
      });

      console.log(`[ApiKeyModal] Model ${GEMINI_MODEL} responded with HTTP status ${res.status}`);

      if (res.ok) {
        setTestResult({
          success: true,
          status: res.status,
          title: 'Connection Verified',
          message: `Model ${GEMINI_MODEL} is active, authorized & ready!`,
          guidance: 'You can now generate live celebration theme concepts.'
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        const rawMessage = errData?.error?.message || `HTTP ${res.status}`;
        console.error(`[ApiKeyModal] Test failed with status ${res.status}:`, errData?.error);
        
        const categorized = categorizeGeminiError({ status: res.status, message: rawMessage });
        setTestResult({
          success: false,
          status: res.status,
          type: categorized.type,
          title: categorized.title,
          message: categorized.userMessage,
          guidance: categorized.guidance,
          raw: rawMessage
        });
      }
    } catch (err) {
      if (isTimeout) err.isTimeout = true;
      console.error('[ApiKeyModal] Connection test exception:', err.message);
      const categorized = categorizeGeminiError(err);
      setTestResult({
        success: false,
        status: err.status || null,
        type: categorized.type,
        title: categorized.title,
        message: categorized.userMessage,
        guidance: categorized.guidance,
        raw: err.message
      });
    } finally {
      clearTimeout(timeoutId);
      setIsTesting(false);
    }
  };

  // Escape-close + focus trap + focus restore (shared modal a11y hook)
  const panelRef = useModalFocus(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Key className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 id="api-key-modal-title" className="font-display font-bold text-lg">AI Engine Settings</h3>
              <p className="text-xs text-brand-100">Built-in GenAI engine · optional Gemini key</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close API Key Settings"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Built-in GenAI Engine: Connected.</strong> The app's server-side AI engine powers six GenAI capabilities — AI Theme Studio, Budget Copilot, Milestone Planner, Vendor Advisor & inquiry drafts, Plan Review, and the 24/7 Planning Assistant. No configuration or API key is required.
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Offline-Ready:</strong> If the AI engine is busy or offline, the app instantly provides rich, curated celebration suggestions completely locally!
              </span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <span>
                <strong>Optional — Bring Your Own Key:</strong> Paste a Google Gemini API key below to generate via your own Google AI Studio quota instead. It is stored only in your browser's local storage.
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="gemini-api-key-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Optional: Google Gemini API Key
            </label>
            <div className="relative">
              <input
                id="gemini-api-key-input"
                type="password"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="AIzaSy..."
                className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400 font-mono"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center justify-between">
              <span>Target Model: <strong>{GEMINI_MODEL}</strong></span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1 hover:underline"
              >
                Get a free key from Google AI Studio
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          {/* Test Result Display with Accurate Status Distinction */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs space-y-1.5 border transition-all ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : testResult.type === 'TEMPORARY_HIGH_DEMAND'
                  ? 'bg-amber-50 text-amber-950 border-amber-300'
                  : testResult.type === 'QUOTA_EXCEEDED'
                  ? 'bg-orange-50 text-orange-950 border-orange-300'
                  : 'bg-rose-50 text-rose-950 border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : testResult.type === 'TEMPORARY_HIGH_DEMAND' ? (
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult.title}</span>
                {testResult.status && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/70 border border-current ml-auto">
                    HTTP {testResult.status}
                  </span>
                )}
              </div>

              <p className="text-xs leading-relaxed pl-6">{testResult.guidance || testResult.message}</p>

              {testResult.raw && testResult.raw !== testResult.guidance && (
                <div className="pl-6 pt-1">
                  <p className="text-[10px] font-mono opacity-80 bg-white/60 p-1.5 rounded border border-current/20">
                    Google API response: "{testResult.raw}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={isTesting || !inputKey.trim()}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-1.5"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <span>Test Connection</span>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 rounded-xl shadow-md shadow-brand-500/25 transition-all"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
