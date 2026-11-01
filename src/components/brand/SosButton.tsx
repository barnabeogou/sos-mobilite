import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { CarFront } from 'lucide-react';

type SosSize = 'md' | 'lg' | 'fluid';

const DIMS: Record<SosSize, string> = {
  lg: 'h-56 w-56 sm:h-64 sm:w-64',
  md: 'h-44 w-44',
  // Proportionnel au conteneur (carte « signal » du héros).
  fluid: 'aspect-square w-[56%]',
};

/** Le grand bouton SOS (parcours principal, cf. maquettes). */
export function SosButton({ to, size = 'lg', label = 'Signaler une panne' }: { to: string; size?: SosSize; label?: string }) {
  const dim = DIMS[size];
  const small = size === 'md';
  return (
    <div className={clsx('grid place-items-center', size === 'fluid' ? 'absolute inset-0' : 'relative py-6')}>
      <span className={clsx('absolute rounded-full bg-alert-500/25 animate-sos-pulse', dim)} aria-hidden />
      <span className={clsx('absolute rounded-full border border-alert-500/20', dim, 'scale-[1.18]')} aria-hidden />
      <Link
        to={to}
        className={clsx(
          'relative grid place-items-center rounded-full text-center text-white shadow-sos transition active:scale-95',
          'bg-[radial-gradient(circle_at_35%_30%,#FF4D57_0%,#E30613_45%,#8F030B_100%)] ring-4 ring-alert-500/40 hover:brightness-110',
          dim,
        )}
        aria-label={`SOS — ${label}`}
      >
        <span className="flex flex-col items-center">
          <CarFront className={small ? 'h-7 w-7' : 'h-9 w-9'} aria-hidden />
          <span className={clsx('font-display font-extrabold leading-none tracking-tight', small ? 'mt-1 text-5xl' : 'mt-2 text-6xl')}>SOS</span>
          <span className="mt-2 text-sm font-medium text-white/90">{label}</span>
        </span>
      </Link>
    </div>
  );
}
