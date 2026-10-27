import React from 'react';
import { useEventContext } from '../../context/EventContext';
import { calculatePaymentStats } from '../../utils/calculator';
import { CreditCard, Plus, CheckCircle2, Circle, Pencil, Trash2, CircleAlert, Sparkles } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../utils/formatters';

const KIND_META = {
  deposit: { label: 'Deposit', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  balance: { label: 'Balance', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  milestone: { label: 'Milestone', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  final: { label: 'Final', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

/** Due-date chip: overdue / soon / dated. */
const DueChip = ({ payment }) => {
  if (payment.paid) {
    return (
      <span className="text-[11px] font-semibold text-slate-400">
        Paid {payment.paidDate ? formatShortDate(payment.paidDate) : ''}
      </span>
    );
  }
  const due = calculatePaymentStats([payment]);
  if (due.overdueCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
        <CircleAlert className="w-3 h-3" aria-hidden="true" /> Overdue
      </span>
    );
  }
  if (due.nextDue) {
    const urgent = due.nextDue.diffDays <= 14;
    return (
      <span
        className={`text-[11px] font-bold rounded-full px-2 py-0.5 border ${
          urgent ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-50 border-slate-200'
        }`}
      >
        {due.nextDue.label}
      </span>
    );
  }
  return <span className="text-[11px] text-slate-400 font-semibold">No date</span>;
};

/**
 * Payment schedule ledger — deposits, balances and final payments with
 * paid toggles, overdue surfacing and a next-due callout. The Payment
 * Controller agent writes milestones here (manual rows are preserved).
 */
export const PaymentLedgerPanel = ({ onOpenAdd, onEditPayment, onNavigate }) => {
  const { activeEvent, togglePaymentPaid, deletePayment } = useEventContext();

  if (!activeEvent) return null;
  const payments = activeEvent.payments || [];
  const stats = calculatePaymentStats(payments);
  const rows = [...payments].sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? 1 : -1; // unpaid first
    return (a.dueDate || '').localeCompare(b.dueDate || '');
  });

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Committed', value: formatCurrency(stats.paidTotal + stats.outstandingTotal) },
          { label: 'Paid', value: formatCurrency(stats.paidTotal) },
          { label: 'Outstanding', value: formatCurrency(stats.outstandingTotal) },
          {
            label: 'Next due',
            value: stats.nextDue ? `${formatShortDate(stats.nextDue.date)} · ${formatCurrency(stats.nextDue.amount)}` : '—',
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-slate-200/80 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className="font-display font-extrabold text-lg text-slate-900 mt-0.5 tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Overdue banner */}
      {stats.overdueCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-xs text-rose-900">
          <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            <span className="font-bold">
              {stats.overdueCount} payment{stats.overdueCount === 1 ? '' : 's'} overdue
            </span>{' '}
            totalling {formatCurrency(stats.overdueTotal)} — settle or renegotiate the date before the next vendor
            conversation.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 max-w-xl">
          {stats.total === 0
            ? 'No milestones yet.'
            : `${stats.total - stats.paidCount} of ${stats.total} milestones open · ${formatCurrency(stats.outstandingTotal)} outstanding`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate?.('force')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            AI payment schedule
          </button>
          <button
            type="button"
            onClick={onOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Add payment
          </button>
        </div>
      </div>

      {/* Ledger */}
      {payments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <CreditCard className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
          <h3 className="font-display font-bold text-slate-700 mt-3">The ledger is empty</h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
            Track deposits and balances with their due dates so nothing lands on the final week. Add milestones by hand,
            or let the <span className="font-semibold text-emerald-700">Payment Controller</span> agent split your
            booked vendor contracts into a full schedule.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('force')}
            className="mt-4 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all"
          >
            Build it with the Agent Force
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-card overflow-hidden">
          {/* Header row (desktop) */}
          <div className="hidden md:grid grid-cols-[2.5rem_1fr_7rem_7rem_8rem_6.5rem] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="sr-only">Paid</span>
            <span>Milestone</span>
            <span>Vendor</span>
            <span className="text-right">Amount</span>
            <span>Due</span>
            <span className="text-right">Actions</span>
          </div>
          <ul>
            {rows.map((p) => {
              const kind = KIND_META[p.kind] || KIND_META.milestone;
              return (
                <li
                  key={p.id}
                  className={`group grid grid-cols-[2.5rem_1fr_auto] md:grid-cols-[2.5rem_1fr_7rem_7rem_8rem_6.5rem] gap-3 items-center px-5 py-3.5 border-b border-slate-100 last:border-b-0 transition-colors ${
                    p.paid ? 'bg-emerald-50/30' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => togglePaymentPaid(p.id)}
                    aria-label={p.paid ? `Mark "${p.label}" as unpaid` : `Mark "${p.label}" as paid`}
                    className="text-slate-400 hover:text-emerald-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-full w-fit"
                  >
                    {p.paid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <Circle className="w-5 h-5" aria-hidden="true" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p className={`text-sm font-semibold leading-snug truncate ${p.paid ? 'text-slate-400' : 'text-slate-800'}`}>
                      {p.label}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 border ${kind.cls}`}>
                        {kind.label}
                      </span>
                      {p.source === 'agent' && (
                        <span className="text-[10px] font-bold text-fuchsia-600 bg-fuchsia-50 border border-fuchsia-200 rounded-full px-1.5 py-0.5">
                          AI
                        </span>
                      )}
                      <span className="md:hidden text-[11px] text-slate-500">
                        {p.vendorName ? `${p.vendorName} · ` : ''}
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                  </div>

                  <span className="hidden md:block text-xs text-slate-600 truncate">{p.vendorName || '—'}</span>
                  <span className="hidden md:block text-sm font-bold text-slate-800 text-right tabular-nums">
                    {formatCurrency(p.amount)}
                  </span>
                  <span className="hidden md:block">
                    <DueChip payment={p} />
                  </span>

                  <div className="hidden md:flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => onEditPayment(p)}
                      aria-label={`Edit "${p.label}"`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePayment(p.id)}
                      aria-label={`Delete "${p.label}"`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {/* Totals footer */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 bg-slate-50 border-t border-slate-200 text-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid</p>
              <p className="font-display font-extrabold text-slate-800 tabular-nums">{formatCurrency(stats.paidTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
              <p className="font-display font-extrabold text-slate-800 tabular-nums">{formatCurrency(stats.outstandingTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overdue</p>
              <p className={`font-display font-extrabold tabular-nums ${stats.overdueTotal > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                {formatCurrency(stats.overdueTotal)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Event budget</p>
              <p className="font-display font-extrabold text-slate-800 tabular-nums">{formatCurrency(activeEvent.budget)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
