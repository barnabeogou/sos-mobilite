import { ButtonLink } from '@/components/ui/Button';
import { BrandLogo } from '@/components/brand/BrandLogo';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-5 text-center">
      <BrandLogo />
      <p className="font-display text-7xl font-extrabold text-white/10">404</p>
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="text-silver-400">Le lien est peut-être incorrect ou la page a été déplacée.</p>
      <ButtonLink to="/">Retour à l’accueil</ButtonLink>
    </div>
  );
}
