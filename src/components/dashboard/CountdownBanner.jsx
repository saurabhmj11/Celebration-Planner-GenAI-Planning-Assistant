import React, { useState, useEffect, memo } from 'react';
import { Calendar, MapPin, Users, Pencil, Sparkles } from 'lucide-react';
import { EVENT_TYPES } from '../../data/defaultData';
import { formatEventDate } from '../../utils/formatters';

/**
 * Event-type-aware hero gradients so each celebration category feels distinct.
 */
const TYPE_THEMES = {
  wedding: {
    gradient: 'from-rose-950 via-fuchsia-950 to-slate-950',
    glowA: 'bg-rose-500/25',
    glowB: 'bg-amber-500/15',
  },
  birthday: {
    gradient: 'from-violet-950 via-brand-950 to-fuchsia-950',
    glowA: 'bg-brand-500/25',
    glowB: 'bg-pink-500/15',
  },
  community: {
    gradient: 'from-emerald-950 via-teal-950 to-slate-950',
    glowA: 'bg-emerald-500/25',
    glowB: 'bg-cyan-500/15',
  },
  other: {
    gradient: 'from-slate-900 via-brand-950 to-fuchsia-950',
    glowA: 'bg-brand-500/20',
    glowB: 'bg-rose-500/15',
  },
};

const CountdownBannerComponent = ({ event, onEditEvent, onOpenAiStudio }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, isPast: false });

  useEffect(() => {
    if (!event?.date) return;

    const calculateTime = () => {
      const eventDateTime = new Date(`${event.date}T${event.time || '12:00'}:00`);
      const now = new Date();
      const diffMs = eventDateTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, isPast: true });
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diffMs / (1000 * 60)) % 60);

      setTimeLeft({ days, hours, minutes, isPast: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [event?.date, event?.time]);

  if (!event) return null;

  const typeInfo = EVENT_TYPES.find((t) => t.id === event.type) || EVENT_TYPES[0];
  const theme = TYPE_THEMES[event.type] || TYPE_THEMES.other;
  const friendlyDate = formatEventDate(event.date);

  return (
    <section
      aria-label={`${event.title} overview and countdown`}
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.gradient} text-white shadow-xl border border-slate-800/80`}
    >
      {/* Ambient background glow accents */}
      <div className={`absolute -top-24 -right-24 w-96 h-96 ${theme.glowA} rounded-full blur-3xl pointer-events-none`} aria-hidden="true" />
      <div className={`absolute -bottom-24 -left-24 w-80 h-80 ${theme.glowB} rounded-full blur-3xl pointer-events-none`} aria-hidden="true" />

      <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
        {/* Left: Event Details */}
        <div className="space-y-4 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 backdrop-blur-md border border-white/25 text-white">
              <span className="text-sm" aria-hidden="true">{typeInfo.icon}</span>
              {typeInfo.label}
            </span>

            {event.themeName && (
              <button
                type="button"
                onClick={onOpenAiStudio}
                title={`Open AI Theme Studio — current theme: ${event.themeName}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 border border-amber-300/40 text-amber-200 hover:bg-amber-400/30 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{event.themeName}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onEditEvent}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 hover:text-white px-3 py-1 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 transition-colors"
            >
              <Pencil className="w-3 h-3" aria-hidden="true" />
              Edit Details
            </button>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold tracking-tight leading-tight">
              {event.title}
            </h2>
            {event.description && (
              <p className="text-sm sm:text-base text-slate-200/95 mt-2 line-clamp-2 leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
                {event.description}
              </p>
            )}
          </div>

          <dl className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs sm:text-sm text-slate-200/95">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-300 shrink-0" aria-hidden="true" />
              <dt className="sr-only">Date and time</dt>
              <dd>
                {friendlyDate}
                {event.time ? ` at ${event.time}` : ''}
              </dd>
            </div>

            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-300 shrink-0" aria-hidden="true" />
                <dt className="sr-only">Location</dt>
                <dd className="truncate max-w-xs">{event.location}</dd>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
              <dt className="sr-only">Guest count</dt>
              <dd>{event.guestCount || 0} Guests</dd>
            </div>
          </dl>
        </div>

        {/* Right: Dynamic Countdown Timer */}
        <div
          className="shrink-0 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 sm:p-6 text-center min-w-[260px] shadow-inner motion-safe:hover:shadow-lg transition-shadow"
          role="timer"
          aria-label={
            timeLeft.isPast
              ? 'The celebration day has arrived'
              : `Countdown: ${timeLeft.days} days, ${timeLeft.hours} hours, ${timeLeft.minutes} minutes remaining`
          }
        >
          <p className="text-xs font-bold uppercase tracking-widest text-brand-200 mb-3 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
            Celebration Countdown
          </p>

          {timeLeft.isPast ? (
            <div className="py-2">
              <div className="text-2xl font-bold text-amber-300 flex items-center justify-center gap-2">
                🎉 Event Celebration!
              </div>
              <p className="text-xs text-slate-200/95 mt-1">This event is today or has passed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: timeLeft.days, label: 'Days', tone: 'text-white' },
                { value: timeLeft.hours, label: 'Hours', tone: 'text-brand-300' },
                { value: timeLeft.minutes, label: 'Mins', tone: 'text-rose-300' },
              ].map(({ value, label, tone }) => (
                <div
                  key={label}
                  className="bg-slate-900/70 rounded-xl p-2.5 sm:p-3 border border-white/15"
                >
                  <div className={`text-2xl sm:text-3xl font-display font-black ${tone}`} aria-hidden="true">
                    {value}
                  </div>
                  <div className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-300 font-bold mt-0.5">
                    <span className="sr-only">{value} </span>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {event.themeColor && event.palette && Array.isArray(event.palette) && event.palette.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-center gap-2">
              <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wide">Palette:</span>
              <div className="flex items-center -space-x-1.5" aria-hidden="true">
                {event.palette.map((color, i) => (
                  <span
                    key={`${color}-${i}`}
                    className="w-4 h-4 rounded-full border-2 border-white/90 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="sr-only">Theme colors applied from the AI Theme Studio</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

// Memo: the hero only re-renders when the event identity/date actually changes.
export const CountdownBanner = memo(CountdownBannerComponent);
