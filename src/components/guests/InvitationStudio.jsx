import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEventContext } from '../../context/EventContext';
import { useCloudSync } from '../../context/CloudSyncContext';
import { aiAssist } from '../../services/aiAssist';
import QRCode from 'qrcode';
import { calculateGuestStats, getRsvpUrgency } from '../../utils/calculator';
import { formatEventDate } from '../../utils/formatters';
import {
  Sparkles,
  Save,
  Copy,
  Printer,
  Loader2,
  MailOpen,
  CalendarClock,
  RefreshCw,
  Wand2,
  QrCode,
  Link2,
  Globe,
  LogIn,
  CheckCircle2,
} from 'lucide-react';

const TONES = [
  { id: 'warm', label: 'Warm', hint: 'heartfelt & personal' },
  { id: 'formal', label: 'Formal', hint: 'traditional etiquette' },
  { id: 'playful', label: 'Playful', hint: 'fun & lively' },
  { id: 'elegant', label: 'Elegant', hint: 'sophisticated grace' },
];

/**
 * AI Invitation Studio — writes, previews and prints the guest-facing
 * invitation for the active event.
 *
 * Flow: pick tone (+ optional host & RSVP deadline) → GLM generates the copy
 * via /api/ai/assist (offline template fallback) → edit inline → Save to the
 * event (persisted) → Copy text or Print a palette-styled card (the theme's
 * palette drives the card art, so invitations match the celebration).
 */
export const InvitationStudio = ({ onBackToList }) => {
  const { activeEvent, saveInvitation, showToast } = useEventContext();
  const {
    user: cloudUser,
    isSessionReady,
    cloudByLocalId,
    ensureRsvpShare,
    syncEvent,
    syncingIds,
    openCloudModal,
  } = useCloudSync();

  const invitation = activeEvent?.invitation;

  const [tone, setTone] = useState('warm');
  const [hostName, setHostName] = useState('');
  const [rsvpDeadline, setRsvpDeadline] = useState(invitation?.rsvpDeadline || '');
  const [headline, setHeadline] = useState(invitation?.headline || '');
  const [message, setMessage] = useState(invitation?.message || '');
  const [signOff, setSignOff] = useState(invitation?.signOff || '');
  const [source, setSource] = useState(invitation?.source || '');
  const [isGenerating, setIsGenerating] = useState(false);

  const stats = useMemo(() => calculateGuestStats(activeEvent?.guests || []), [activeEvent]);
  const urgency = useMemo(() => getRsvpUrgency(rsvpDeadline), [rsvpDeadline]);

  // --- Public RSVP page sharing (cloud) ---
  const cloudInfo = cloudByLocalId.get(activeEvent?.id);
  const pendingResponses = cloudInfo?.responseCount || 0;
  const [shareBusy, setShareBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setShareUrl('');
    setQrDataUrl('');
    setLinkCopied(false);
  }, [activeEvent?.id]);

  const handleCreateLink = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      const res = await ensureRsvpShare(activeEvent);
      if (res.ok) {
        setShareUrl(res.url);
        setLinkCopied(false);
        try {
          setQrDataUrl(
            await QRCode.toDataURL(res.url, {
              width: 220,
              margin: 1,
              color: { dark: '#312e81', light: '#ffffff' },
            })
          );
        } catch {
          setQrDataUrl('');
        }
      } else if (res.error) {
        showToast(res.error, 'error');
      }
    } finally {
      setShareBusy(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2400);
      showToast('RSVP link copied — send it to your guests!', 'success');
    } catch {
      showToast('Copy failed — select the link text and copy manually.', 'error');
    }
  };

  /* Palette for the card — the event's applied theme color wins. */
  const palette = useMemo(() => {
    const base = /^#[0-9a-fA-F]{6}$/.test(activeEvent?.themeColor || '')
      ? activeEvent.themeColor
      : '#8b5cf6';
    return { primary: base, deep: '#1e293b' };
  }, [activeEvent?.themeColor]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const payload = {
        eventType: activeEvent?.type || 'other',
        eventTitle: activeEvent?.title || 'Our celebration',
        hostName: hostName.trim() || undefined,
        eventDate: activeEvent?.date || undefined,
        eventTime: activeEvent?.time || undefined,
        location: activeEvent?.location || undefined,
        guestCount: Number(activeEvent?.guestCount) || undefined,
        tone,
        themeName: activeEvent?.themeName || undefined,
        rsvpDeadline: /^\d{4}-\d{2}-\d{2}$/.test(rsvpDeadline) ? rsvpDeadline : undefined,
      };
      const result = await aiAssist.invitationCopy(payload);
      const copy = result?.data || {};
      setHeadline(copy.headline || '');
      setMessage(copy.message || '');
      setSignOff(copy.signOff || '');
      setSource(result.source === 'live-ai' ? 'ai' : 'local-ai-engine');
      showToast(
        result.source === 'live-ai'
          ? 'Invitation copy drafted by the AI — edit freely, then save.'
          : 'Live AI was unavailable — the offline writer drafted a version you can edit.',
        result.source === 'live-ai' ? 'success' : 'info'
      );
    } catch {
      showToast('Could not draft the invitation — please try again.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    saveInvitation({
      headline: headline.trim(),
      message: message.trim(),
      signOff: signOff.trim(),
      rsvpDeadline,
      source: source || 'manual',
    });
  };

  const handleCopy = async () => {
    const text = [headline, '', message, '', signOff, rsvpDeadline ? `Kindly RSVP by ${rsvpDeadline}` : '']
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast('Invitation text copied — paste it into any message or email.', 'success');
    } catch {
      showToast('Copy failed — select the text manually and copy.', 'info');
    }
  };

  const handlePrint = () => {
    if (!message.trim()) {
      showToast('Write or generate the invitation message first.', 'info');
      return;
    }
    document.body.classList.add('printing-invitation');
    const cleanup = () => {
      document.body.classList.remove('printing-invitation');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    // afterprint isn't reliable in every browser — belt and braces.
    setTimeout(cleanup, 2000);
  };

  const hasCopy = Boolean(headline.trim() || message.trim());

  const cardDate = activeEvent?.date ? formatEventDate(activeEvent.date, { weekday: 'long' }) : 'Date to be announced';

  const printableCard = hasCopy && (
    <div className="invitation-print-portal" aria-hidden="true">
      <div className="invitation-card-page min-h-screen w-full items-center justify-center bg-white p-8">
        <div
          className="mx-auto max-w-xl w-full rounded-[2rem] p-10 text-center shadow-xl"
          style={{
            background: `linear-gradient(160deg, ${palette.primary}14 0%, #ffffff 45%, ${palette.primary}0d 100%)`,
            border: `2px solid ${palette.primary}55`,
          }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-[0.35em]"
            style={{ color: palette.primary }}
          >
            You are invited
          </p>
          <h1 className="font-serif text-3xl font-bold text-slate-900 mt-4 leading-snug">
            {headline || activeEvent?.title}
          </h1>
          <p className="text-sm text-slate-500 mt-3">{activeEvent?.title}</p>
          <p className="text-sm text-slate-700 mt-6 leading-relaxed whitespace-pre-line">{message}</p>
          <div className="mt-8 pt-6 border-t" style={{ borderColor: `${palette.primary}33` }}>
            <p className="text-sm font-semibold text-slate-800">{signOff}</p>
            <p className="text-xs text-slate-500 mt-2">
              {cardDate}
              {activeEvent?.time ? ` · ${activeEvent.time}` : ''}
              {activeEvent?.location ? ` · ${activeEvent.location}` : ''}
            </p>
            {rsvpDeadline && (
              <p className="text-xs text-slate-500 mt-1">Kindly RSVP by {rsvpDeadline}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (!activeEvent) return null;

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Left: composer controls */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Choose a voice</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Invitation tone">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={tone === t.id}
                  onClick={() => setTone(t.id)}
                  className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                    tone === t.id
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span className="block text-xs font-bold text-slate-800">{t.label}</span>
                  <span className="block text-[10px] text-slate-400">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="invite-host" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Host name(s) — optional
            </label>
            <input
              id="invite-host"
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="e.g. Sophia & Liam"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label htmlFor="invite-deadline" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              RSVP deadline
            </label>
            <input
              id="invite-deadline"
              type="date"
              value={rsvpDeadline}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setRsvpDeadline(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
            {urgency && (
              <p className={`text-[11px] mt-1 font-semibold ${urgency.color.split(' ')[0]}`}>{urgency.label}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-fuchsia-600 to-brand-600 hover:from-fuchsia-700 hover:to-brand-700 rounded-xl shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 className="w-4 h-4" aria-hidden="true" />
            )}
            {isGenerating ? 'Writing your invitation…' : hasCopy ? 'Rewrite with the AI' : 'Write it with the AI'}
          </button>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            The AI reads your event details ({activeEvent.title} · {cardDate}
            {activeEvent?.location ? ` · ${activeEvent.location}` : ''}
            {activeEvent?.themeName ? ` · theme “${activeEvent.themeName}”` : ''}) and the{' '}
            {stats.totalGuests}-guest list context. Everything stays editable before you save.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Export</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!hasCopy}
              className="flex-1 min-w-[7rem] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-40"
            >
              <Copy className="w-4 h-4" aria-hidden="true" />
              Copy text
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!hasCopy}
              className="flex-1 min-w-[7rem] flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-40"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              Print card
            </button>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!message.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-brand-600 hover:from-emerald-700 hover:to-brand-700 rounded-xl shadow-md shadow-emerald-500/25 transition-all disabled:opacity-40"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            {invitation ? 'Update saved invitation' : 'Save to this celebration'}
          </button>
          {invitation && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" aria-hidden="true" />
              Saved copy in use{invitation.source === 'sample' ? ' (sample data)' : ''}
              {invitation.rsvpDeadline ? ` · RSVP by ${invitation.rsvpDeadline}` : ''} ·{' '}
              <button type="button" onClick={onBackToList} className="underline hover:no-underline font-semibold">
                back to the list
              </button>
            </p>
          )}
        </div>

        {/* Public RSVP page — cloud-backed guest link (GAP 1) */}
        <div
          className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-brand-50/60 p-5 space-y-3"
          aria-labelledby="rsvp-share-title"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p id="rsvp-share-title" className="text-[11px] font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                Public RSVP Page
              </p>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Guests open a link on their phone, find their name, and answer — responses flow
                into your guest list when you sync.
              </p>
            </div>
            {cloudInfo?.hasRsvpToken && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                <Globe className="w-3 h-3" aria-hidden="true" />
                Live
              </span>
            )}
          </div>

          {!isSessionReady ? (
            <div className="h-9 flex items-center text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
              Checking cloud sync…
            </div>
          ) : !cloudUser ? (
            <button
              type="button"
              onClick={openCloudModal}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-brand-600 hover:from-sky-700 hover:to-brand-700 rounded-xl shadow-md shadow-sky-500/25 transition-all"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              Sign in to share an RSVP link
            </button>
          ) : (
            <div className="space-y-3">
              {!shareUrl ? (
                <button
                  type="button"
                  onClick={handleCreateLink}
                  disabled={shareBusy}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-brand-600 hover:from-sky-700 hover:to-brand-700 rounded-xl shadow-md shadow-sky-500/25 transition-all disabled:opacity-60 disabled:cursor-wait"
                >
                  {shareBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Link2 className="w-4 h-4" aria-hidden="true" />
                  )}
                  {shareBusy
                    ? 'Syncing & creating your link…'
                    : cloudInfo?.hasRsvpToken
                      ? 'Show my RSVP link'
                      : 'Create public RSVP link'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      aria-label="Public RSVP link"
                      onFocus={(e) => e.target.select()}
                      className="flex-1 min-w-0 bg-transparent text-[11px] text-slate-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      aria-label="Copy the public RSVP link"
                      className="shrink-0 inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-bold rounded-lg text-white bg-gradient-to-r from-sky-600 to-brand-600 hover:from-sky-700 hover:to-brand-700 transition-all"
                    >
                      {linkCopied ? (
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      {linkCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  {qrDataUrl && (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <img
                        src={qrDataUrl}
                        alt="QR code linking to the public RSVP page"
                        className="w-20 h-20 rounded-lg border border-slate-100"
                      />
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Print this QR on table cards — guests scan, find their name, and RSVP in
                        seconds. The page shows your <strong>saved</strong> invitation copy.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {pendingResponses > 0 && (
                <button
                  type="button"
                  onClick={() => syncEvent(activeEvent)}
                  disabled={syncingIds.has(activeEvent.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 hover:bg-amber-200 rounded-xl transition-all disabled:opacity-60"
                >
                  {syncingIds.has(activeEvent.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  )}
                  Import {pendingResponses} new response{pendingResponses === 1 ? '' : 's'} into the guest list
                </button>
              )}

              {rsvpDeadline && (
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  RSVP deadline {rsvpDeadline}: the public page stops accepting answers the day
                  after it passes. Save the invitation before sharing so guests see the final copy.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: live preview */}
      <div className="lg:col-span-3">
        <div className="lg:sticky lg:top-24 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MailOpen className="w-3.5 h-3.5 text-brand-500" aria-hidden="true" />
              Live preview — edit inline
            </p>
            {source && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {source === 'ai' ? 'AI draft' : source === 'local-ai-engine' ? 'Offline draft' : source === 'sample' ? 'Sample copy' : 'Manual'}
              </span>
            )}
          </div>

          <div
            className="rounded-3xl border p-6 sm:p-8 text-center shadow-sm"
            style={{
              background: `linear-gradient(160deg, ${palette.primary}14 0%, #ffffff 45%, ${palette.primary}0d 100%)`,
              borderColor: `${palette.primary}55`,
            }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.35em]"
              style={{ color: palette.primary }}
            >
              You are invited
            </p>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Invitation headline"
              aria-label="Invitation headline"
              className="w-full mt-4 bg-transparent border-0 border-b border-slate-200 focus:border-brand-400 focus:ring-0 text-center font-serif text-2xl font-bold text-slate-900 placeholder:text-slate-300 outline-none pb-1"
            />
            <p className="text-xs text-slate-400 mt-3">
              {activeEvent.title} · {stats.totalGuests} guests invited
            </p>
            <textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="The invitation message will appear here — generate it with the AI or write your own…"
              aria-label="Invitation message"
              className="w-full mt-5 bg-white/60 border border-slate-200 rounded-2xl p-4 text-sm text-slate-700 leading-relaxed focus:ring-2 focus:ring-brand-400 outline-none resize-none placeholder:text-slate-300"
            />
            <input
              type="text"
              value={signOff}
              onChange={(e) => setSignOff(e.target.value)}
              placeholder="Sign-off — e.g. With love, Sophia & Liam"
              aria-label="Invitation sign-off"
              className="w-full mt-4 bg-transparent border-0 border-b border-dashed border-slate-200 focus:border-brand-400 focus:ring-0 text-center text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none pb-1"
            />
            <div className="mt-6 pt-4 border-t border-slate-200/80 text-xs text-slate-500 space-y-1">
              <p className="flex items-center justify-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-brand-500" aria-hidden="true" />
                {cardDate}
                {activeEvent.time ? ` · ${activeEvent.time}` : ''}
                {activeEvent.location ? ` · ${activeEvent.location}` : ''}
              </p>
              {rsvpDeadline ? (
                <p className="font-semibold text-brand-700">Kindly RSVP by {rsvpDeadline}</p>
              ) : (
                <p className="text-slate-400 italic">Set an RSVP deadline to print it on the card</p>
              )}
            </div>
          </div>

          {hasCopy && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 justify-center">
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              Prints exactly as previewed, styled with the “{activeEvent.themeName || 'celebration'}” palette.
            </p>
          )}
        </div>
      </div>

      {/* Hidden print portal (visible only while printing) */}
      {typeof document !== 'undefined' && printableCard ? createPortal(printableCard, document.body) : null}
    </div>
  );
};
