import { useState } from 'react';
import clsx from 'clsx';

/**
 * Logo SOS MOBILITÉ.
 * Emplacement du logo officiel : public/brand/logo-sos-mobilite.png
 * Tant que le fichier n'est pas fourni, un logotype texte temporaire est affiché.
 */
export function BrandLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [officialMissing, setOfficialMissing] = useState(false);

  if (!officialMissing) {
    return (
      <img
        src="/brand/logo-sos-mobilite.png"
        alt="SOS MOBILITÉ"
        className={clsx(compact ? 'h-8' : 'h-10', 'w-auto', className)}
        onError={() => setOfficialMissing(true)}
      />
    );
  }

  return (
    <span className={clsx('inline-flex items-center gap-2.5 leading-none', className)} aria-label="SOS MOBILITÉ">
      <span
        className={clsx(
          'grid place-items-center rounded-full border-[3px] border-alert-500 font-display font-extrabold text-white',
          compact ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs',
        )}
        aria-hidden
      >
        SOS
      </span>
      <span className="flex flex-col">
        <span className={clsx('font-display font-extrabold tracking-tight text-white', compact ? 'text-base' : 'text-lg')}>
          SOS <span className="text-alert-500">MOBILITÉ</span>
        </span>
        {!compact && <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-silver-400">Votre tranquillité, notre engagement</span>}
      </span>
    </span>
  );
}
