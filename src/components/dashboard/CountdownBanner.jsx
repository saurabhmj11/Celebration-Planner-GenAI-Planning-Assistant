import React, { useState, useEffect } from 'react';
import { EVENT_TYPES } from '../../data/defaultData';
import { Calendar, MapPin, Users, Edit3, Sparkles } from 'lucide-react';

export const CountdownBanner = ({ event, onEditEvent, onOpenAiStudio }) => {
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

  const typeConfig = EVENT_TYPES.find((t) => t.id === event.type) || EVENT_TYPES[0];

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-brand-950 to-indigo-950 text-white shadow-xl border border-slate-800">
      {/* Ambient background glow accents */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
        {/* Left: Event Details */}
        <div className="space-y-4 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur-md border border-white/15 text-brand-200">
              <span className="text-sm">{typeConfig.icon}</span>
              {typeConfig.label}
            </span>

            {event.themeName && (
              <button
                onClick={onOpenAiStudio}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/15 border border-amber-400/30 text-amber-300 hover:bg-amber-400/25 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{event.themeName}</span>
              </button>
            )}

            <button
              onClick={onEditEvent}
              className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Details
            </button>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold tracking-tight leading-tight">
              {event.title}
            </h2>
            {event.description && (
              <p className="text-sm sm:text-base text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                {event.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
              <span>
                {new Date(`${event.date}T12:00:00`).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
                {event.time ? ` at ${event.time}` : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate max-w-xs">{event.location}</span>
            </div>

            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{event.guestCount || 0} Guests</span>
            </div>
          </div>
        </div>

        {/* Right: Dynamic Countdown Timer */}
        <div className="shrink-0 bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-5 sm:p-6 text-center min-w-[260px] shadow-inner">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-200 mb-3 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Celebration Countdown
          </p>

          {timeLeft.isPast ? (
            <div className="py-2">
              <div className="text-2xl font-bold text-amber-300 flex items-center justify-center gap-2">
                🎉 Event Celebration!
              </div>
              <p className="text-xs text-slate-300 mt-1">This event is today or has passed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/60 rounded-xl p-2.5 sm:p-3 border border-white/10">
                <div className="text-2xl sm:text-3xl font-display font-black text-white">
                  {timeLeft.days}
                </div>
                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-bold mt-0.5">
                  Days
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-xl p-2.5 sm:p-3 border border-white/10">
                <div className="text-2xl sm:text-3xl font-display font-black text-brand-300">
                  {timeLeft.hours}
                </div>
                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-bold mt-0.5">
                  Hours
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-xl p-2.5 sm:p-3 border border-white/10">
                <div className="text-2xl sm:text-3xl font-display font-black text-rose-300">
                  {timeLeft.minutes}
                </div>
                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-bold mt-0.5">
                  Mins
                </div>
              </div>
            </div>
          )}

          {event.themeColor && event.palette && (
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-2">
              <span className="text-[10px] font-bold text-slate-300 uppercase">Palette:</span>
              <div className="flex items-center -space-x-1.5">
                {event.palette.map((color, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: color }}
                    title={event.paletteNames?.[i] || color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
