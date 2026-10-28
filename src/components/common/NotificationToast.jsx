import React from 'react';
import { useEventContext } from '../../context/EventContext';
import { AlertCircle, Info, Sparkles } from 'lucide-react';

export const NotificationToast = () => {
  const { toast } = useEventContext();

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce duration-300">
      <div
        className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border transition-all ${
          isSuccess
            ? 'bg-slate-900 text-white border-brand-500/50 shadow-brand-500/20'
            : isError
            ? 'bg-rose-900 text-white border-rose-500/50 shadow-rose-500/20'
            : 'bg-slate-800 text-white border-slate-700'
        }`}
      >
        <div className="p-1 rounded-lg bg-white/10">
          {isSuccess ? (
            <Sparkles className="w-5 h-5 text-amber-300 animate-spin-slow" />
          ) : isError ? (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          ) : (
            <Info className="w-5 h-5 text-brand-300" />
          )}
        </div>
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
    </div>
  );
};
