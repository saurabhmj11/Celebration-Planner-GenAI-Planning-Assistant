import React, { useState } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useCloudSync } from '../../context/CloudSyncContext';
import { useEventContext } from '../../context/EventContext';
import { EVENT_TYPES } from '../../data/defaultData';
import {
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  Loader2,
  LogOut,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Sparkles,
} from 'lucide-react';

/**
 * Cloud Sync modal — the account + sync control room (GAP 2).
 *
 * Signed out: register / sign-in forms. Signed in: per-event sync status with
 * push ("Sync now"), public-RSVP import, cloud restore and cloud removal,
 * plus a cloud-only section for events that live in the cloud but not on
 * this device (cross-device restore).
 */

const inputBase =
  'w-full h-11 px-4 pl-10 text-sm bg-slate-50 border rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-400';
const inputTone = (hasError) =>
  hasError ? 'border-rose-400 bg-rose-50/60 focus:ring-rose-400' : 'border-slate-200';

const typeLabel = (typeId) =>
  EVENT_TYPES.find((t) => t.id === typeId)?.label || 'Celebration';

const relTime = (iso) => {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(diff)) return '';
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString();
  } catch (_err) {
    return '';
  }
};

export const CloudSyncModal = () => {
  const {
    isCloudModalOpen,
    closeCloudModal,
    user,
    isSessionReady,
    register,
    signIn,
    signOut,
    cloudByLocalId,
    cloudEvents,
    syncEvent,
    syncAllEvents,
    restoreEvent,
    deleteCloudEvent,
    syncingIds,
    pendingResponses,
  } = useCloudSync();
  const { events } = useEventContext();

  const panelRef = useModalFocus(isCloudModalOpen, closeCloudModal);

  // --- auth form state ---
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  if (!isCloudModalOpen) return null;

  const submitAuth = async (e) => {
    e.preventDefault();
    if (authBusy) return;
    setAuthError('');
    setAuthBusy(true);
    try {
      const res =
        mode === 'register'
          ? await register({ email: email.trim(), name: name.trim(), password })
          : await signIn({ email: email.trim(), password });
      if (!res.ok) {
        setAuthError(res.error || 'Something went wrong.');
        return;
      }
      // Reset the form for next time.
      setEmail('');
      setName('');
      setPassword('');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSyncAll = async () => {
    if (bulkBusy) return;
    setBulkBusy(true);
    try {
      await syncAllEvents();
    } finally {
      setBulkBusy(false);
    }
  };

  const cloudOnlyRows = cloudEvents.filter(
    (c) => !events.some((e) => e.id === c.localId)
  );

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8 dark:bg-slate-900">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-sky-600 via-brand-600 to-fuchsia-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md">
              <Cloud className="w-5 h-5 text-sky-100" aria-hidden="true" />
            </div>
            <div>
              <h2 id="cloud-modal-title" className="font-display font-bold text-lg leading-tight">
                Cloud Sync
              </h2>
              <p className="text-xs text-white/80">
                Your events on every device — plus public RSVP links.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCloudModal}
            aria-label="Close cloud sync dialog"
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 md:p-7 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* ---------- Signed out: register / sign in ---------- */}
          {!isSessionReady ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            </div>
          ) : !user ? (
            <div className="max-w-md mx-auto">
              <div className="flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Account access">
                {[
                  { id: 'signin', label: 'Sign in' },
                  { id: 'register', label: 'Create account' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={mode === tab.id}
                    onClick={() => {
                      setMode(tab.id);
                      setAuthError('');
                    }}
                    className={`flex-1 h-10 rounded-xl text-sm font-bold transition-all ${
                      mode === tab.id
                        ? 'bg-white text-brand-700 shadow dark:bg-slate-900 dark:text-brand-300'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <form onSubmit={submitAuth} className="mt-5 space-y-4" noValidate>
                {mode === 'register' && (
                  <div>
                    <label htmlFor="cloud-name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 dark:text-slate-300">
                      Your name <span className="text-slate-400 normal-case">(optional)</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
                      <input
                        id="cloud-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={80}
                        autoComplete="name"
                        placeholder="Maya Kapoor"
                        className={inputBase + ' ' + inputTone(false)}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label htmlFor="cloud-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 dark:text-slate-300">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
                    <input
                      id="cloud-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="you@example.com"
                      aria-invalid={Boolean(authError)}
                      className={inputBase + ' ' + inputTone(Boolean(authError))}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="cloud-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 dark:text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
                    <input
                      id="cloud-password"
                      type={showPw ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      placeholder={mode === 'register' ? '8+ chars, a letter & a number' : 'Your password'}
                      aria-invalid={Boolean(authError)}
                      className={inputBase + ' pr-12 ' + inputTone(Boolean(authError))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-3 p-0.5 text-slate-400 hover:text-slate-600 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {authError && (
                  <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-rose-600">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full h-12 inline-flex items-center justify-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-sky-600 to-brand-600 hover:from-sky-700 hover:to-brand-700 rounded-2xl shadow-lg shadow-brand-500/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-wait"
                >
                  {authBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      {mode === 'register' ? 'Creating account…' : 'Signing in…'}
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" aria-hidden="true" />
                      {mode === 'register' ? 'Create account & sync' : 'Sign in'}
                    </>
                  )}
                </button>
              </form>

              <ul className="mt-6 space-y-2">
                {[
                  'Pick up your events on any device',
                  'Share a public RSVP page guests can answer from their phone',
                  'Photos stay on this device — the cloud holds your plan',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            /* ---------- Signed in: sync control room ---------- */
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    <Cloud className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-900 truncate dark:text-emerald-200">
                      {user.name || user.email}
                    </p>
                    <p className="text-[11px] text-emerald-700/80 truncate dark:text-emerald-400/80">
                      {user.email} · cloud sync active
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-bold text-emerald-800 bg-white/80 border border-emerald-300 rounded-xl hover:bg-white transition-colors dark:text-emerald-300 dark:bg-slate-900/60 dark:border-emerald-900"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  Sign out
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                  <strong className="text-slate-700 dark:text-slate-200">Sync now</strong> uploads this
                  device&apos;s plan and imports any new public-RSVP responses into your guest list.
                </p>
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={bulkBusy || events.length === 0}
                  className="inline-flex items-center gap-2 h-10 px-4 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-brand-600 hover:from-sky-700 hover:to-brand-700 rounded-xl shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60 disabled:cursor-wait"
                >
                  {bulkBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  )}
                  Sync all ({events.length})
                </button>
              </div>

              {/* Local events */}
              <ul className="space-y-2.5" aria-label="Your events">
                {events.map((event) => {
                  const cloud = cloudByLocalId.get(event.id);
                  const syncing = syncingIds.has(event.id);
                  const pending = cloud?.responseCount || 0;
                  return (
                    <li
                      key={event.id}
                      className={`rounded-2xl border p-3.5 transition-colors ${
                        pending > 0
                          ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/20'
                          : 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate dark:text-slate-100">
                            {event.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {typeLabel(event.type)}
                            {cloud ? (
                              <>
                                {' '}· v{cloud.version} synced {relTime(cloud.updatedAt)}
                                {cloud.hasRsvpToken ? ' · RSVP page live' : ''}
                              </>
                            ) : (
                              ' · not synced yet'
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {pending > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-1 text-[10px] font-extrabold text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300">
                              <Sparkles className="w-3 h-3" aria-hidden="true" />
                              {pending} new response{pending === 1 ? '' : 's'}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => syncEvent(event)}
                            disabled={syncing}
                            aria-label={`Sync ${event.title} now`}
                            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-brand-600 hover:from-sky-700 hover:to-brand-700 rounded-xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-wait"
                          >
                            {syncing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            {cloud ? 'Sync now' : 'Sync this event'}
                          </button>
                          {cloud && (
                            <>
                              <button
                                type="button"
                                onClick={() => restoreEvent(event.id)}
                                aria-label={`Restore ${event.title} from the cloud`}
                                title="Replace this device's copy with the cloud copy (Ctrl+Z undoes it)"
                                className="inline-flex items-center h-9 px-3 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors dark:text-slate-300 dark:bg-slate-900 dark:border-slate-700"
                              >
                                <CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />
                                Restore
                              </button>
                              {confirmRemoveId === event.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    deleteCloudEvent(event.id);
                                    setConfirmRemoveId(null);
                                  }}
                                  autoFocus
                                  className="inline-flex items-center h-9 px-3 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  Confirm removal
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemoveId(event.id)}
                                  aria-label={`Remove ${event.title} from the cloud`}
                                  title="Remove from cloud (this device keeps its copy)"
                                  className="inline-flex items-center h-9 px-2.5 text-slate-400 hover:text-rose-500 bg-white border border-slate-200 rounded-xl transition-colors dark:bg-slate-900 dark:border-slate-700"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Cloud-only events (other devices) */}
              {cloudOnlyRows.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 dark:text-slate-400">
                    In your cloud, not on this device
                  </h3>
                  <ul className="space-y-2">
                    {cloudOnlyRows.map((cloud) => (
                      <li
                        key={cloud.localId}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-sky-300 bg-sky-50/60 p-3.5 dark:border-sky-800 dark:bg-sky-950/20"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate dark:text-slate-100">
                            {cloud.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {typeLabel(cloud.eventType)} · v{cloud.version} · saved {relTime(cloud.updatedAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => restoreEvent(cloud.localId)}
                          className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-brand-600 hover:from-sky-700 hover:to-brand-700 rounded-xl shadow-sm"
                        >
                          <CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />
                          Restore to this device
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                Snapshots exclude photo files (they stay in this browser). Everything else — plan,
                guests, budget, vendors, gifts, timeline, seating — travels with every sync. Any
                restore or RSVP import can be undone with Ctrl+Z.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CloudSyncModal;
