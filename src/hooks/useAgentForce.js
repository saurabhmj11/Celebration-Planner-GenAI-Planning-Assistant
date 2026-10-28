'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useEventContext } from '@/context/EventContext';
import { aiAssist } from '@/services/aiAssist';
import { AGENTS, AGENT_IDS } from '@/lib/agents/registry';
import {
  buildSeatingPayload,
  buildPaymentsPayload,
  buildRunSheetPayload,
  buildAuditPayload,
} from '@/lib/agents/payloads';

/**
 * Agent Force orchestration.
 *
 * One hook owns the whole workforce: per-agent status, a live activity feed,
 * and the apply step that turns each agent's answer into real app artifacts
 * (seating assignments, payment milestones, run-sheet cues, audit verdict).
 *
 * Live GLM first, offline engine fallback — the force never stalls.
 */

const MAX_LOG = 40;

const initialStatuses = () =>
  Object.fromEntries(AGENT_IDS.map((id) => [id, { status: 'idle', summary: '', source: '', at: null }]));

export function useAgentForce() {
  const {
    activeEvent,
    applySeatingAssignments,
    applyAgentPayments,
    applyAgentRunSheet,
    logAgentRun,
    showToast,
  } = useEventContext();

  const [statuses, setStatuses] = useState(initialStatuses);
  const [activity, setActivity] = useState([]);
  const [forceBusy, setForceBusy] = useState(false);
  const runSeq = useRef(0);

  const log = useCallback((line, agentId = 'force') => {
    runSeq.current += 1;
    setActivity((prev) => [{ id: `log-${runSeq.current}`, at: Date.now(), agentId, line }, ...prev].slice(0, MAX_LOG));
  }, []);

  const patch = useCallback((agentId, fields) => {
    setStatuses((prev) => ({ ...prev, [agentId]: { ...prev[agentId], ...fields } }));
  }, []);

  /**
   * Dispatch one agent: build payload → call assist (live/offline) →
   * write artifacts → log the run on the event.
   */
  const dispatchAgent = useCallback(
    async (agentId) => {
      const agent = AGENTS.find((a) => a.id === agentId);
      if (!agent || !activeEvent) return null;

      patch(agentId, { status: 'working', summary: '', source: '' });
      log(`${agent.icon} ${agent.name} dispatched — reading the live plan…`, agentId);

      try {
        let payload;
        let call;
        if (agentId === 'seating') {
          payload = buildSeatingPayload(activeEvent);
          call = aiAssist.seatingPlan(payload);
        } else if (agentId === 'payments') {
          payload = buildPaymentsPayload(activeEvent);
          call = aiAssist.paymentSchedule(payload);
        } else if (agentId === 'runsheet') {
          payload = buildRunSheetPayload(activeEvent);
          call = aiAssist.runSheet(payload);
        } else {
          payload = buildAuditPayload(activeEvent);
          call = aiAssist.planReview(payload);
        }

        const result = await call;
        const data = result?.data || {};
        const source = result?.source === 'live-ai' ? 'live-ai' : 'local-ai-engine';

        // ---- Apply artifacts -------------------------------------------
        let artifact = agent.deliverable;
        if (agentId === 'seating') {
          const seated = applySeatingAssignments(data.assignments || []);
          artifact = `${seated} guest ${seated === 1 ? 'party' : 'parties'} seated`;
          if ((payload.tables || []).length === 0) {
            log('⚠ No tables defined yet — add tables on the Day-Of tab first.', agentId);
            patch(agentId, { status: 'done', summary: 'No tables to assign yet — add tables on the Day-Of tab, then re-dispatch.', source });
            logAgentRun({ agentId, agentName: agent.name, status: 'done', source, summary: 'Skipped: no tables defined.', artifact: '—' });
            return { ok: true, skipped: true };
          }
        } else if (agentId === 'payments') {
          const written = applyAgentPayments(data.payments || []);
          artifact = `${written} milestones in the ledger`;
        } else if (agentId === 'runsheet') {
          const written = applyAgentRunSheet(data.items || []);
          artifact = `${written} cues on the run sheet`;
        } else {
          artifact = `Readiness ${data.score ?? '—'}/100 · ${Array.isArray(data.nextActions) ? data.nextActions.length : 0} next actions`;
        }

        const summary = String(data.summary || agent.deliverable).slice(0, 300);
        patch(agentId, { status: 'done', summary, source, at: Date.now() });
        log(
          `${agent.icon} ${agent.name} delivered: ${artifact}${source === 'local-ai-engine' ? ' (offline engine)' : ''}.`,
          agentId
        );
        logAgentRun({ agentId, agentName: agent.name, status: 'done', source, summary, artifact });

        if (source === 'local-ai-engine') {
          showToast(`${agent.name} finished via the offline engine — artifacts are in.`, 'info');
        }
        return { ok: true, data };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        patch(agentId, { status: 'error', summary: message, at: Date.now() });
        log(`✖ ${agent.name} failed: ${message}`, agentId);
        logAgentRun({ agentId, agentName: agent.name, status: 'error', source: 'local-ai-engine', summary: message, artifact: '—' });
        return { ok: false, error: message };
      }
    },
    [activeEvent, applyAgentPayments, applyAgentRunSheet, applySeatingAssignments, log, logAgentRun, patch, showToast]
  );

  /** Dispatch the whole force sequentially (feed updates after each agent). */
  const dispatchForce = useCallback(async () => {
    if (forceBusy || !activeEvent) return;
    setForceBusy(true);
    log('🚀 Agent Force deployed — 4 agents working in sequence…', 'force');
    try {
      for (const agent of AGENTS) {
        // Sequential: later agents should see earlier artifacts.
        await dispatchAgent(agent.id);
      }
      log('✅ Force run complete — check the Day-Of tab for the artifacts.', 'force');
      showToast('Agent Force run complete — seating, payments, run sheet and audit are in! 🚀', 'success');
    } finally {
      setForceBusy(false);
    }
  }, [activeEvent, dispatchAgent, forceBusy, log, showToast]);

  const resetStatuses = useCallback(() => {
    setStatuses(initialStatuses());
    setActivity([]);
  }, []);

  const isAnyWorking = useMemo(
    () => Object.values(statuses).some((s) => s.status === 'working'),
    [statuses]
  );

  return {
    agents: AGENTS,
    statuses,
    activity,
    forceBusy: forceBusy || isAnyWorking,
    dispatchAgent,
    dispatchForce,
    resetStatuses,
  };
}
