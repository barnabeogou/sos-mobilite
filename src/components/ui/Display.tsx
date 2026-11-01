import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AlertCircle, Inbox, Loader2, Star } from 'lucide-react';
import type { Tone } from '@/domain/status';
import { initials } from '@/lib/format';

export function Card({ className, children, as: As = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' }) {
  return <As className={clsx('card p-5', className)}>{children}</As>;
}

const tones: Record<Tone, string> = {
  neutral: 'bg-white/5 text-silver-300 ring-white/10',
  info: 'bg-electric-500/10 text-electric-300 ring-electric-500/30',
  progress: 'bg-electric-500/15 text-electric-300 ring-electric-500/40',
  success: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  danger: 'bg-alert-500/10 text-alert-400 ring-alert-500/40',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function Spinner({ className, label = 'Chargement…' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={clsx('inline-flex items-center gap-2 text-silver-400', className)}>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingBlock({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-silver-400">
      <Loader2 className="h-7 w-7 animate-spin text-electric-400" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-silver-400">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="font-display font-semibold text-white">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-silver-400">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-alert-500/30 bg-alert-500/10 p-4 text-sm text-alert-400">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 font-semibold underline underline-offset-2">
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}

export function Notice({ tone = 'info', icon, title, children, className }: { tone?: Tone; icon?: ReactNode; title?: ReactNode; children?: ReactNode; className?: string }) {
  const map: Record<Tone, string> = {
    neutral: 'border-white/10 bg-white/[0.03] text-silver-200',
    info: 'border-electric-500/30 bg-electric-500/[0.08] text-silver-100',
    progress: 'border-electric-500/30 bg-electric-500/[0.08] text-silver-100',
    success: 'border-emerald-500/30 bg-emerald-500/[0.08] text-silver-100',
    warning: 'border-amber-500/30 bg-amber-500/[0.08] text-silver-100',
    danger: 'border-alert-500/40 bg-alert-500/[0.08] text-silver-100',
  };
  return (
    <div className={clsx('flex gap-3 rounded-2xl border p-4 text-sm', map[tone], className)}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold text-white">{title}</p>}
        {children && <div className="text-silver-300">{children}</div>}
      </div>
    </div>
  );
}

export function Avatar({ name, src, size = 44, className }: { name: string | null | undefined; src?: string | null; size?: number; className?: string }) {
  return src ? (
    <img src={src} alt="" width={size} height={size} className={clsx('shrink-0 rounded-full object-cover ring-2 ring-white/10', className)} style={{ width: size, height: size }} />
  ) : (
    <span
      className={clsx('grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-electric-500 to-night-700 font-display font-bold text-white ring-2 ring-white/10', className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  if (!count) return <span className={clsx('text-xs text-silver-500', className)}>Nouveau</span>;
  return (
    <span className={clsx('inline-flex items-center gap-1 text-sm text-silver-200', className)}>
      <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
      <span className="font-semibold text-white">{Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
      {count !== undefined && <span className="text-silver-500">({count})</span>}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Note">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sur 5`}
          onClick={() => onChange(n)}
          className="rounded-lg p-1 transition hover:scale-110"
        >
          <Star className={clsx('h-9 w-9', n <= value ? 'fill-amber-400 text-amber-400' : 'text-silver-600')} />
        </button>
      ))}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'neutral' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: Tone }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-silver-400">
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
        {icon && <span className={clsx(tone === 'danger' && 'text-alert-400', tone === 'warning' && 'text-amber-300')}>{icon}</span>}
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-silver-500">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-bold text-white md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-silver-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={clsx('flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-night-950/50 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition',
            value === o.value ? 'bg-electric-500 text-white shadow-glow' : 'text-silver-300 hover:text-white',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DefinitionList({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-white/5">
      {items.map((it, i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <dt className="text-silver-400">{it.label}</dt>
          <dd className="text-right font-medium text-white">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
