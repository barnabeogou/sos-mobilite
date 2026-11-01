import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Check, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Display';
import { NamedIcon } from '@/components/ui/Icon';
import { REQUEST_STATUS, TIMELINE_STEPS, progressIndex } from '@/domain/status';
import { formatFCFA } from '@/domain/pricing';
import { formatDateTime, formatTime } from '@/lib/format';
import type { Quote, RequestStatus, ServiceCategory, ServiceRequest, StatusHistoryEntry } from '@/types/database';

export function StatusBadge({ status }: { status: RequestStatus }) {
  const meta = REQUEST_STATUS[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function RequestListItem({
  request,
  category,
  to,
  subtitle,
}: {
  request: ServiceRequest;
  category: ServiceCategory | undefined;
  to: string;
  subtitle?: string;
}) {
  return (
    <Link to={to} className="card-interactive flex items-center gap-4 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-night-950/60 text-electric-300 ring-1 ring-white/5">
        <NamedIcon name={category?.icon ?? 'wrench'} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-white">{category?.name ?? 'Assistance'}</span>
        <span className="block truncate text-sm text-silver-400">{subtitle ?? `${request.reference} · ${formatDateTime(request.created_at)}`}</span>
      </span>
      <StatusBadge status={request.status} />
      <ChevronRight className="hidden h-5 w-5 text-silver-500 sm:block" aria-hidden />
    </Link>
  );
}

/** Frise de suivi (Mission acceptée → En route → Diagnostic → Réparation…), cf. maquette 4. */
export function StatusTimeline({ status, history }: { status: RequestStatus; history: StatusHistoryEntry[] }) {
  const current = progressIndex(status);
  const offTrack = current < 0;
  const timeOf = (key: RequestStatus) => history.filter((h) => h.to_status === key).at(-1)?.created_at;

  return (
    <ol className="relative space-y-0">
      {TIMELINE_STEPS.map((step, i) => {
        const done = !offTrack && i < current;
        const active = !offTrack && i === current;
        const t = timeOf(step.key);
        return (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
            {i < TIMELINE_STEPS.length - 1 && (
              <span className={clsx('absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-0.5', done ? 'bg-electric-500' : 'bg-white/10')} aria-hidden />
            )}
            <span
              className={clsx(
                'relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2',
                done && 'border-electric-500 bg-electric-500 text-white',
                active && 'border-electric-400 bg-night-900 text-electric-300 ring-4 ring-electric-500/20',
                !done && !active && 'border-white/15 bg-night-900 text-transparent',
              )}
              aria-hidden
            >
              {done ? <Check className="h-4 w-4" /> : <span className={clsx('h-2 w-2 rounded-full', active ? 'bg-electric-400' : '')} />}
            </span>
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 pt-0.5">
              <p className={clsx('text-sm font-semibold', done || active ? 'text-white' : 'text-silver-500')}>{step.label}</p>
              {t && (done || active) && <span className="text-xs text-silver-500">{formatTime(t)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function QuoteBreakdown({ quote }: { quote: Quote }) {
  const lines = [
    { label: 'Diagnostic et main-d’œuvre', v: quote.labor_amount },
    { label: 'Pièces', v: quote.parts_amount },
    { label: 'Déplacement', v: quote.travel_amount },
  ].filter((l) => l.v > 0);
  return (
    <div className="space-y-2">
      {lines.map((l) => (
        <div key={l.label} className="flex justify-between text-sm">
          <span className="text-silver-400">{l.label}</span>
          <span className="font-medium text-white">{formatFCFA(l.v)}</span>
        </div>
      ))}
      <div className="flex items-baseline justify-between border-t border-white/10 pt-2">
        <span className="font-semibold text-white">Total</span>
        <span className="font-display text-xl font-bold text-white">{formatFCFA(quote.total_amount)}</span>
      </div>
      {quote.eta_minutes && <p className="text-xs text-silver-400">Arrivée estimée : environ {quote.eta_minutes} min après validation.</p>}
      {quote.notes && <p className="rounded-xl bg-night-950/50 p-3 text-sm text-silver-300">« {quote.notes} »</p>}
    </div>
  );
}
