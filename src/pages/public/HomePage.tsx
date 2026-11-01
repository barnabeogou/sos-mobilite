import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  BadgeCheck,
  Clock3,
  Eye,
  FileCheck2,
  HandHeart,
  KeyRound,
  Lightbulb,
  MapPin,
  ReceiptText,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { homePathFor, useAuth } from '@/hooks/useAuth';
import { BRAND } from '@/config/env';
import { SignalMap } from '@/components/motion/SignalMap';
import { BrandMarquee } from '@/components/motion/BrandMarquee';
import { Reveal } from '@/components/motion/Reveal';
import { CityTiles } from '@/components/cities/CityTiles';
import { cssVars, useIntroDone, useScrollProgress } from '@/components/motion/motion';

const STEPS = [
  { icon: MapPin, title: 'Signalez', text: 'Appuyez sur SOS, choisissez le problème et partagez votre position.' },
  { icon: FileCheck2, title: 'Validez le devis', text: 'Un professionnel vérifié accepte et vous envoie un prix clair avant de se déplacer.' },
  { icon: KeyRound, title: 'Suivez', text: 'Suivez chaque étape. À son arrivée, il confirme avec votre code personnel.' },
  { icon: ReceiptText, title: 'Payez et évaluez', text: 'Vous confirmez la fin de la prestation, recevez un reçu et notez le service.' },
];

const GUARANTEES = [
  { icon: BadgeCheck, t: 'Professionnels vérifiés', d: 'Identité, coordonnées et atelier contrôlés avant toute mission.' },
  { icon: FileCheck2, t: 'Aucun supplément sans accord', d: 'Chaque montant est validé par vous avant le début des travaux.' },
  { icon: KeyRound, t: 'Code d’arrivée', d: 'Le bon professionnel rejoint le bon client, confirmé par un code.' },
  { icon: Star, t: 'Avis sur interventions réelles', d: 'Seuls les clients ayant payé une prestation peuvent noter.' },
];

const VALUES = [
  { icon: ShieldCheck, title: 'Confiance', text: 'Des professionnels sélectionnés et évalués.' },
  { icon: HandHeart, title: 'Engagement', text: 'Des prestations suivies et une qualité contrôlée.' },
  { icon: Clock3, title: 'Disponibilité', text: 'Des solutions accessibles à tout moment.' },
  { icon: Eye, title: 'Transparence', text: 'Des tarifs et prestations clairs, sans surprise.' },
  { icon: Lightbulb, title: 'Innovation', text: 'Une expérience digitale simple, rapide et efficace.' },
];

export function HomePage() {
  const { profile } = useAuth();
  const introDone = useIntroDone();
  const sosTarget = profile?.role === 'client' ? '/client/sos' : profile ? homePathFor(profile) : '/inscription?suite=sos';

  return (
    <>
      {/* Héros : entrée orchestrée au lever du rideau de l'intro */}
      <section
        className="hero mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-10 md:grid-cols-[1.05fr_1fr] md:px-8 md:pt-14"
        data-in={introDone || undefined}
      >
        <div>
          <p
            className="hero-item inline-flex items-center gap-2 rounded-full border border-electric-500/30 bg-electric-500/10 px-3 py-1 text-xs font-semibold text-electric-300"
            style={cssVars({ '--i': 0 })}
          >
            <MapPin className="h-3.5 w-3.5" /> Partout en {BRAND.country}
          </p>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
            <span className="line" style={cssVars({ '--i': 1 })}>
              <span>En panne ?</span>
            </span>
            <span className="line" style={cssVars({ '--i': 2 })}>
              <span>
                <span className="text-alert-500">Un SOS</span>,
              </span>
            </span>
            <span className="line" style={cssVars({ '--i': 3 })}>
              <span>un pro vérifié,</span>
            </span>
            <span className="line" style={cssVars({ '--i': 4 })}>
              <span>un prix clair.</span>
            </span>
          </h1>
          <p className="hero-item mt-5 max-w-xl text-lg text-silver-300" style={cssVars({ '--i': 5 })}>
            {BRAND.name} met en relation automobilistes, motards et plaisanciers avec des mécaniciens et dépanneurs disponibles près d’eux —
            avec un devis à valider avant tout déplacement et un suivi jusqu’à la résolution.
          </p>
          <div className="hero-item mt-8 flex flex-wrap gap-3" style={cssVars({ '--i': 6 })}>
            <ButtonLink to={sosTarget} variant="sos" size="lg">
              Signaler une panne
            </ButtonLink>
            <ButtonLink to="/inscription/professionnel" variant="secondary" size="lg">
              Je suis professionnel
            </ButtonLink>
          </div>
          <p className="hero-item mt-6 font-display text-sm font-semibold text-silver-400" style={cssVars({ '--i': 7 })}>
            {BRAND.slogan}
          </p>
        </div>
        <SignalMap sosTarget={sosTarget} />
      </section>

      {/* Les univers de la marque */}
      <section className="py-10 md:py-14" aria-label="Nos univers">
        <Reveal as="p" className="mx-auto mb-6 max-w-6xl px-4 text-center text-sm font-semibold text-silver-400 md:px-8">
          {BRAND.tagline}
        </Reveal>
        <BrandMarquee />
      </section>

      {/* Parcours */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <Reveal as="h2" variant="mask" className="text-center text-3xl font-bold md:text-4xl">
          Du SOS à la solution
        </Reveal>
        <Reveal as="p" delay={120} className="mx-auto mt-3 max-w-xl text-center text-silver-400">
          Une demande en quelques gestes, même en situation de stress.
        </Reveal>
        <StepsTimeline />
      </section>

      {/* Garanties */}
      <section className="mx-auto max-w-6xl px-4 md:px-8">
        <Reveal className="card grid gap-6 overflow-hidden p-6 md:grid-cols-3 md:p-10">
          <div className="md:col-span-1">
            <Reveal as="h2" variant="mask" className="text-2xl font-bold md:text-3xl">
              Plus qu’un service, une solution pour chaque mobilité.
            </Reveal>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 md:col-span-2">
            {GUARANTEES.map((x, i) => (
              <Reveal as="li" key={x.t} delay={120 + i * 90} className="flex gap-3">
                <x.icon className="mt-0.5 h-5 w-5 shrink-0 text-electric-300" aria-hidden />
                <div>
                  <p className="font-semibold">{x.t}</p>
                  <p className="text-sm text-silver-400">{x.d}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* Couverture nationale */}
      <section className="mx-auto max-w-6xl px-4 pt-16 md:px-8" aria-labelledby="villes">
        <Reveal as="p" className="text-center text-xs font-bold uppercase tracking-[0.3em] text-electric-300">
          Partout en {BRAND.country}
        </Reveal>
        <Reveal as="h2" variant="mask" delay={60} className="mt-2 text-center text-3xl font-bold md:text-4xl" id="villes">
          Les grandes villes, un même réflexe : SOS
        </Reveal>
        <Reveal as="p" delay={140} className="mx-auto mt-3 max-w-xl text-center text-silver-400">
          D’Abidjan à Korhogo, de San-Pédro à Bondoukou : où que vous soyez, la demande part vers les professionnels vérifiés
          les plus proches.
        </Reveal>
        <div className="mt-8">
          <CityTiles />
        </div>
        <p className="mt-6 flex items-center justify-center gap-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-silver-500">
          <span className="h-px w-8 bg-alert-500" aria-hidden /> Toujours à vos côtés <span className="h-px w-8 bg-alert-500" aria-hidden />
        </p>
      </section>

      {/* Valeurs */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <Reveal as="h2" variant="mask" className="text-center text-3xl font-bold md:text-4xl">
          Nos valeurs
        </Reveal>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 80} className="card p-5">
              <v.icon className="h-6 w-6 text-alert-500" aria-hidden />
              <p className="mt-3 font-bold">{v.title}</p>
              <p className="mt-1 text-sm text-silver-400">{v.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Professionnels */}
      <section className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
        <Reveal className="relative overflow-hidden rounded-3xl border border-electric-500/30 bg-gradient-to-br from-night-800 to-night-950 p-8 md:p-12">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-electric-500/20 blur-3xl" aria-hidden />
          <div className="relative grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-sm font-semibold text-electric-300">Mécaniciens, garages, dépanneurs</p>
              <Reveal as="h2" variant="mask" delay={100} className="mt-2 text-3xl font-bold">
                Recevez des clients près de chez vous.
              </Reveal>
              <p className="mt-3 text-silver-300">
                Choisissez vos zones, vos horaires et vos spécialités. Acceptez les missions qui vous conviennent, envoyez vos devis et
                développez votre réputation.
              </p>
            </div>
            <div className="space-y-3">
              <ul className="space-y-2 text-sm text-silver-200">
                <li>• Inscription gratuite, commission expliquée avant activation</li>
                <li>• Profil vérifié par l’équipe SOS MOBILITÉ</li>
                <li>• Historique des missions et de vos gains</li>
              </ul>
              <ButtonLink to="/inscription/professionnel" size="lg">
                Devenir partenaire
              </ButtonLink>
            </div>
          </div>
        </Reveal>
        <p className="mt-6 text-center text-sm text-silver-500">
          Déjà inscrit ?{' '}
          <Link to="/connexion" className="font-semibold text-electric-300">
            Se connecter
          </Link>
        </p>
      </section>
    </>
  );
}

/** Frise du parcours : la ligne se remplit au défilement et chaque étape s'allume à son tour. */
function StepsTimeline() {
  const ref = useRef<HTMLOListElement>(null);
  const [reached, setReached] = useState(0);
  useScrollProgress(ref, (p) => {
    const n = Math.min(STEPS.length, Math.floor(p * STEPS.length + 0.35));
    setReached((prev) => (prev === n ? prev : n));
  });

  return (
    <ol ref={ref} className="steps relative mt-12 grid gap-9 md:grid-cols-4 md:gap-6">
      <span className="steps-track" aria-hidden>
        <span className="steps-fill" />
      </span>
      {STEPS.map((s, i) => (
        <li key={s.title} className="step relative pl-16 md:pl-0 md:text-center" data-on={i < reached || undefined}>
          <span className={clsx('step-dot absolute left-0 top-0 grid h-11 w-11 place-items-center rounded-full md:static md:mx-auto')}>
            <s.icon className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="pt-2 font-bold md:mt-4 md:pt-0">
            <span className="mr-1.5 text-silver-500">{i + 1}.</span>
            {s.title}
          </h3>
          <p className="mt-1 text-sm text-silver-400 md:mx-auto md:max-w-[15rem]">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
