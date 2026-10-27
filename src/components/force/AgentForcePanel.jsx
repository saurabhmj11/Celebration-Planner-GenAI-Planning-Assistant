import React from 'react';
import { useEventContext } from '../../context/EventContext';
import { useAgentForce } from '../../hooks/useAgentForce';
import { AGENT_IDS } from '../../lib/agents/registry';
import { Bot, Rocket, CircleCheck, Loader2, CircleAlert, Clock, ArrowRight, Sparkles } from 'lucide-react';
import { formatShortDate } from '../../utils/formatters';

/**
 * Agent Force command center — the AI workforce panel.
 *
 * Four specialists, one "Deploy Force" button, a live activity feed and the
 * per-event run history. Every dispatched agent writes real artifacts into
 * the plan (seating / payments / run sheet / audit), not just prose.
 */
const StatusChip = ({ status }) => {
  if (status === 'working') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-full px-2.5 py-1">
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Working
      </span>
    );
  }
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
        <CircleCheck className="w-3 h-3" aria-hidden="true" /> Done
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2.5 py-1">
        <CircleAlert className="w-3 h-3" aria-hidden="true" /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
      <Clock className="w-3 h-3" aria-hidden="true" /> Idle
    </span>
  );
};

const timeAgo = (ts) => {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
};

export const AgentForcePanel = ({ onNavigate }) => {
  const { activeEvent } = useEventContext();
  const { agents, statuses, activity, forceBusy, dispatchAgent, dispatchForce } = useAgentForce();

  if (!activeEvent) return null;
  const runs = activeEvent.agentRuns || [];

  return (
    <div className="space-y-6">
      {/* Header / mission control */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-brand-900 to-fuchsia-950 text-white p-6 sm:p-8 shadow-card">
        <div className="absolute -top-10 -right-6 w-48 h-48 rounded-full bg-fuchsia-500/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-14 -left-8 w-56 h-56 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-white/10 border border-white/15 shrink-0">
              <Bot className="w-7 h-7 text-fuchsia-200" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-fuchsia-200/90">
                Agent Force · Mission Control
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold mt-1">
                Your AI workforce for “{activeEvent.title}”
              </h1>
              <p className="text-sm text-white/70 mt-2 max-w-2xl">
                Four specialists read the live plan — RSVPs, vendors, venue, budget — and <span className="text-white font-semibold">write real artifacts back</span>:
                seating assignments, a payment schedule, the day-of run sheet, and a readiness audit. Live GLM engine first, offline engine fallback — the force never stalls.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dispatchForce}
            disabled={forceBusy}
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-fuchsia-500 to-brand-500 hover:from-fuchsia-400 hover:to-brand-400 shadow-lg shadow-fuchsia-500/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Rocket className={`w-4.5 h-4.5 ${forceBusy ? 'animate-pulse' : ''}`} aria-hidden="true" />
            {forceBusy ? 'Force is working…' : 'Deploy Force (4 agents)'}
          </button>
        </div>
      </section>

      {/* Agent roster */}
      <section aria-label="Agent roster" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => {
          const st = statuses[agent.id] || { status: 'idle' };
          const busy = st.status === 'working' || forceBusy;
          return (
            <article
              key={agent.id}
              className={`rounded-3xl border bg-white p-5 shadow-card transition-all ${
                st.status === 'working' ? 'border-brand-300 ring-2 ring-brand-200' : 'border-slate-200/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${agent.accent} flex items-center justify-center text-xl shadow-md shrink-0`}
                    aria-hidden="true"
                  >
                    {agent.icon}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-slate-900 leading-tight">{agent.name}</h3>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{agent.role}</p>
                  </div>
                </div>
                <StatusChip status={st.status} />
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mt-3">{agent.description}</p>

              {st.summary && (
                <div
                  className={`mt-3 rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed border ${
                    st.status === 'error'
                      ? 'bg-rose-50/70 border-rose-200 text-rose-800'
                      : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  }`}
                >
                  {st.summary}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 font-semibold">
                  {st.source === 'live-ai' && '⚡ Live GLM engine'}
                  {st.source === 'local-ai-engine' && '🛟 Offline engine'}
                  {!st.source && `Deliverable: ${agent.deliverable}`}
                </span>
                <button
                  type="button"
                  onClick={() => dispatchAgent(agent.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {st.status === 'working' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  {st.status === 'working' ? 'Working…' : st.status === 'done' ? 'Re-run' : 'Dispatch'}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Live activity feed */}
        <section
          aria-label="Agent activity feed"
          className="rounded-3xl border border-slate-200/80 bg-slate-950 text-slate-200 p-5 shadow-card"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              Activity Feed
            </h3>
            <span className="text-[11px] text-slate-500 font-semibold">{activity.length} events</span>
          </div>
          <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-1.5 pr-1" role="log" aria-live="polite">
            {activity.length === 0 && (
              <p className="text-xs text-slate-500 py-6 text-center">
                Nothing yet — dispatch an agent or deploy the whole force and watch it work here.
              </p>
            )}
            {activity.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2.5 text-xs leading-relaxed">
                <span className="text-slate-600 font-mono shrink-0 tabular-nums">
                  {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={entry.line.startsWith('✖') ? 'text-rose-300' : entry.line.startsWith('⚠') ? 'text-amber-300' : 'text-slate-200'}>
                  {entry.line}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Run history (persisted per event) */}
        <section aria-label="Agent run history" className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-slate-900">Run History</h3>
            <span className="text-[11px] text-slate-400 font-semibold">saved to this event</span>
          </div>
          <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {runs.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-slate-500">No runs recorded yet for this celebration.</p>
                <p className="text-[11px] text-slate-400 mt-1">Every dispatch is logged here — summary, engine tier and artifact count.</p>
              </div>
            )}
            {runs.slice(0, 12).map((run) => {
              const agent = AGENT_IDS.includes(run.agentId)
                ? agents.find((a) => a.id === run.agentId)
                : null;
              return (
                <div key={run.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                  <span className="text-base shrink-0" aria-hidden="true">{agent?.icon || '🤖'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800">{run.agentName}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          run.status === 'error'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {run.status === 'error' ? 'error' : run.artifact}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {run.source === 'live-ai' ? '⚡ GLM' : '🛟 offline'} · {formatShortDate(run.at?.slice(0, 10))}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{run.summary}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Next step */}
      <section className="rounded-3xl border border-brand-200/70 bg-brand-50/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ArrowRight className="w-5 h-5 text-brand-600 shrink-0" aria-hidden="true" />
          <p className="text-sm text-brand-900">
            <span className="font-bold">Artifacts land on the Day-Of tab.</span>{' '}
            <span className="text-brand-800">Seating chart, payment ledger and the printable run sheet — review and tweak freely.</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.('dayof')}
          className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Open Day-Of Workbench
        </button>
      </section>
    </div>
  );
};
