import React, { useState } from 'react';
import { useEventContext } from '../../context/EventContext';
import { RunSheetPanel } from './RunSheetPanel';
import { SeatingChartPanel } from './SeatingChartPanel';
import { PaymentLedgerPanel } from './PaymentLedgerPanel';
import { PaymentFormModal } from './PaymentFormModal';
import { RunSheetItemModal } from './RunSheetItemModal';
import { TableFormModal } from './TableFormModal';
import { CalendarClock, Armchair, CreditCard, Printer } from 'lucide-react';
import { formatEventDate } from '../../utils/formatters';

/**
 * Day-Of Workbench — everything the host needs for the event day itself,
 * in one tab with three segments: Run Sheet · Seating · Payments.
 * The Agent Force writes its artifacts here; the host reviews and tweaks.
 */
const SEGMENTS = [
  { id: 'runsheet', label: 'Run Sheet', icon: CalendarClock },
  { id: 'seating', label: 'Seating', icon: Armchair },
  { id: 'payments', label: 'Payments', icon: CreditCard },
];

export const DayOfWorkbench = ({ onNavigate }) => {
  const { activeEvent } = useEventContext();
  const [segment, setSegment] = useState('runsheet');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState(null);

  const [isRunItemModalOpen, setIsRunItemModalOpen] = useState(false);
  const [runItemToEdit, setRunItemToEdit] = useState(null);

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);

  if (!activeEvent) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold text-brand-700 uppercase tracking-[0.18em]">Day-Of Readiness</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">Day-Of Workbench</h1>
          <p className="text-sm text-slate-500 mt-1.5 max-w-2xl">
            The minute-by-minute plan for <span className="font-semibold text-slate-700">{activeEvent.title}</span> —{' '}
            {formatEventDate(activeEvent.date)} at {activeEvent.time || 'TBD'}. Run sheet for the crew, seating for the
            tables, and the payment ledger so nothing is left to the last week.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.('force')}
          className="shrink-0 inline-flex items-center gap-2 self-start px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 to-brand-600 hover:from-fuchsia-500 hover:to-brand-500 shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Printer className="w-4 h-4" aria-hidden="true" />
          Let the Agent Force draft these
        </button>
      </div>

      {/* Segment switcher */}
      <div
        role="tablist"
        aria-label="Day-of workbench sections"
        className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/80 border border-slate-200/80 w-fit"
      >
        {SEGMENTS.map((seg) => {
          const Icon = seg.icon;
          const active = segment === seg.id;
          return (
            <button
              key={seg.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSegment(seg.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                active ? 'bg-white text-brand-800 shadow-sm border border-brand-200' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {seg.label}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      {segment === 'runsheet' && (
        <RunSheetPanel
          onOpenAdd={() => {
            setRunItemToEdit(null);
            setIsRunItemModalOpen(true);
          }}
          onEditItem={(item) => {
            setRunItemToEdit(item);
            setIsRunItemModalOpen(true);
          }}
          onNavigate={onNavigate}
        />
      )}
      {segment === 'seating' && (
        <SeatingChartPanel
          onOpenAddTable={() => setIsTableModalOpen(true)}
          onNavigate={onNavigate}
        />
      )}
      {segment === 'payments' && (
        <PaymentLedgerPanel
          onOpenAdd={() => {
            setPaymentToEdit(null);
            setIsPaymentModalOpen(true);
          }}
          onEditPayment={(p) => {
            setPaymentToEdit(p);
            setIsPaymentModalOpen(true);
          }}
          onNavigate={onNavigate}
        />
      )}

      {/* Modals */}
      <RunSheetItemModal
        isOpen={isRunItemModalOpen}
        onClose={() => setIsRunItemModalOpen(false)}
        itemToEdit={runItemToEdit}
      />
      <TableFormModal isOpen={isTableModalOpen} onClose={() => setIsTableModalOpen(false)} />
      <PaymentFormModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        paymentToEdit={paymentToEdit}
      />
    </div>
  );
};
