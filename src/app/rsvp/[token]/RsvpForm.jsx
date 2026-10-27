'use client';

/**
 * Guest-facing RSVP form — the client island of the public portal.
 *
 * Flow: find your name (server-side lookup — the list is never exposed) →
 * answer (attending / maybe / declined + plus-ones + meal + note) → success
 * with confetti. Guests not on the list can still respond with their name;
 * the host sees them flagged as new on import.
 */

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Send,
  ArrowLeft,
  PartyPopper,
  Lock,
} from 'lucide-react';

const MEAL_OPTIONS = ['standard', 'vegetarian', 'vegan', 'gluten-free', 'kids'];

const ATTENDING_CHOICES = [
  {
    id: 'attending',
    emoji: '🎉',
    title: 'Joyfully attending',
    hint: "Count me in — I'll be there!",
  },
  {
    id: 'maybe',
    emoji: '🤔',
    title: 'Maybe — still checking',
    hint: 'Tentative for now',
  },
  {
    id: 'declined',
    emoji: '💌',
    title: 'Regretfully declining',
    hint: 'Sending love from afar',
  },
];

export function RsvpForm({ token, closed, deadline, eventTitle }) {
  // Step 1: find name / Step 2: respond / Step 3: done
  const [step, setStep] = useState(closed ? 'closed' : 'find');
  const [nameQuery, setNameQuery] = useState('');
  const [matches, setMatches] = useState(null); // null = haven't searched
  const [lookingUp, setLookingUp] = useState(false);

  const [selected, setSelected] = useState(null); // { guestKey, name } | { name }
  const [attending, setAttending] = useState('attending');
  const [plusOnes, setPlusOnes] = useState(0);
  const [meal, setMeal] = useState('standard');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const runLookup = async (e) => {
    e.preventDefault();
    const query = nameQuery.trim();
    if (query.length < 2) {
      setError('Type at least 2 letters of your name.');
      return;
    }
    setLookingUp(true);
    setError('');
    try {
      const res = await fetch('/api/public/rsvp/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nameQuery: query }),
      });
      if (res.status === 410) {
        setStep('closed');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Lookup failed — please try again.');
        return;
      }
      setMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLookingUp(false);
    }
  };

  const pickMatch = (match) => {
    setSelected({ guestKey: match.guestKey, name: match.name });
    setStep('respond');
  };

  const respondAsNewGuest = () => {
    const name = nameQuery.trim();
    if (name.length < 2) {
      setError('Type your name first.');
      return;
    }
    setSelected({ name });
    setStep('respond');
  };

  const submitResponse = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        token,
        attending,
        plusOnes,
        meal: meal || undefined,
        note: note.trim() || undefined,
      };
      if (selected.guestKey) payload.guestKey = selected.guestKey;
      else payload.name = selected.name;

      const res = await fetch('/api/public/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 410) {
        setStep('closed');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not send your RSVP — please try again.');
        return;
      }
      setStep('done');
      try {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (!reduce) {
          confetti({
            particleCount: attending === 'declined' ? 40 : 140,
            spread: attending === 'declined' ? 55 : 75,
            origin: { y: 0.7 },
            colors: ['#f43f5e', '#a855f7', '#f59e0b', '#10b981', '#3b82f6'],
          });
        }
      } catch {
        /* confetti is decorative */
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'closed') {
    return (
      <div className="text-center space-y-3 py-4" role="status">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-600">
          <Lock className="w-6 h-6" aria-hidden="true" />
        </span>
        <h2 className="text-base font-bold text-slate-800">RSVPs are closed</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          {deadline
            ? `The host asked for answers by ${deadline}. Reach out to them directly — they'd love to hear from you.`
            : 'This celebration is no longer accepting online RSVPs.'}
        </p>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="text-center space-y-3 py-4" role="status" aria-live="polite">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600">
          <PartyPopper className="w-6 h-6" aria-hidden="true" />
        </span>
        <h2 className="text-base font-bold text-slate-800">
          {attending === 'declined'
            ? 'Your regrets are sent'
            : attending === 'maybe'
              ? 'Your maybe is noted'
              : `You're on the list, ${selected?.name?.split(' ')[0] || 'friend'}!`}
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Thank you — the host will see your answer the next time they sync{' '}
          <strong>{eventTitle}</strong>. You can close this page now.
        </p>
        <button
          type="button"
          onClick={() => {
            setStep('respond');
          }}
          className="text-xs font-bold text-brand-600 underline hover:no-underline"
        >
          Change my answer
        </button>
      </div>
    );
  }

  if (step === 'find') {
    return (
      <form onSubmit={runLookup} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="rsvp-name"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
          >
            Find your name
          </label>
          <div className="flex gap-2">
            <input
              id="rsvp-name"
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Start typing your name…"
              autoComplete="name"
              aria-describedby="rsvp-find-hint"
              className="flex-1 h-12 px-4 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={lookingUp}
              className="h-12 px-5 inline-flex items-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 rounded-2xl shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60 disabled:cursor-wait"
            >
              {lookingUp ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="w-4 h-4" aria-hidden="true" />
              )}
              Find
            </button>
          </div>
          <p id="rsvp-find-hint" className="mt-1.5 text-[11px] text-slate-400">
            The host&apos;s guest list stays private — we only check whether your name is on it.
          </p>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-rose-600">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {matches && matches.length > 0 && (
          <div className="space-y-2" role="group" aria-label="Matching guests — pick yourself">
            <p className="text-xs font-bold text-slate-600">Is one of these you?</p>
            <div className="grid gap-2">
              {matches.map((m) => (
                <button
                  key={m.guestKey}
                  type="button"
                  onClick={() => pickMatch(m)}
                  className="flex items-center justify-between h-11 px-4 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-2xl hover:border-brand-400 hover:bg-brand-50 transition-all text-left"
                >
                  <span>{m.name}</span>
                  <CheckCircle2 className="w-4 h-4 text-slate-300" aria-hidden="true" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={respondAsNewGuest}
              className="text-xs font-bold text-brand-600 underline hover:no-underline"
            >
              None of these — respond with my name
            </button>
          </div>
        )}

        {matches && matches.length === 0 && (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-sm font-semibold text-slate-700">
              We couldn&apos;t find “{nameQuery.trim()}” on the list.
            </p>
            <p className="text-xs text-slate-500">
              No worries — the host can still add you when they sync.
            </p>
            <button
              type="button"
              onClick={respondAsNewGuest}
              className="text-xs font-bold text-brand-600 underline hover:no-underline"
            >
              Respond anyway with my name
            </button>
          </div>
        )}
      </form>
    );
  }

  // step === 'respond'
  const isDeclined = attending === 'declined';
  return (
    <form onSubmit={submitResponse} className="space-y-5" noValidate>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800">
          {selected?.guestKey ? `Answering as ${selected.name}` : `Answering as ${selected?.name}`}
        </p>
        <button
          type="button"
          onClick={() => {
            setStep('find');
            setMatches(null);
            setError('');
          }}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden="true" />
          Not you?
        </button>
      </div>

      <fieldset>
        <legend className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Will you join?
        </legend>
        <div className="grid gap-2" role="radiogroup" aria-label="Attendance">
          {ATTENDING_CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              role="radio"
              aria-checked={attending === choice.id}
              onClick={() => setAttending(choice.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                attending === choice.id
                  ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <span className="text-xl" aria-hidden="true">
                {choice.emoji}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-800">{choice.title}</span>
                <span className="block text-[11px] text-slate-500">{choice.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {!isDeclined && (
        <div>
          <label
            htmlFor="rsvp-plusones"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
          >
            Guests in your party (including you)
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPlusOnes((n) => Math.max(0, n - 1))}
              aria-label="Remove a plus one"
              className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-600 hover:bg-slate-100"
            >
              −
            </button>
            <input
              id="rsvp-plusones"
              type="number"
              min={0}
              max={5}
              value={plusOnes + 1}
              readOnly
              className="w-16 h-10 text-center text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl"
            />
            <button
              type="button"
              onClick={() => setPlusOnes((n) => Math.min(5, n + 1))}
              aria-label="Add a plus one"
              className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-600 hover:bg-slate-100"
            >
              +
            </button>
            <span className="text-[11px] text-slate-400">
              {plusOnes === 0
                ? 'Just you'
                : `You + ${plusOnes} ${plusOnes === 1 ? 'guest' : 'guests'}`}
            </span>
          </div>
        </div>
      )}

      <div>
        <label
          htmlFor="rsvp-meal"
          className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
        >
          Meal preference
        </label>
        <select
          id="rsvp-meal"
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
          className="w-full h-11 px-4 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none"
        >
          {MEAL_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="rsvp-note"
          className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
        >
          Note for the host <span className="text-slate-400 normal-case">(optional)</span>
        </label>
        <textarea
          id="rsvp-note"
          rows={2}
          maxLength={400}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Dietary needs, song requests, little ones joining…"
          className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none resize-none placeholder:text-slate-400"
        />
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-rose-600">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full h-12 inline-flex items-center justify-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-700 hover:to-fuchsia-700 rounded-2xl shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60 disabled:cursor-wait"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="w-4 h-4" aria-hidden="true" />
        )}
        {submitting ? 'Sending…' : 'Send my RSVP'}
      </button>
    </form>
  );
}

export default RsvpForm;
