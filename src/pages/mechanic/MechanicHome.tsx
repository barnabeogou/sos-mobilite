import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, ChevronRight, Circle, Clock3, MapPin, Power, Star, Wrench } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useRealtimeInvalidate } from '@/hooks/useRealtime';
import { useNow } from '@/hooks/useNow';
import { useCategories } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, Notice, StatCard } from '@/components/ui/Display';
import { useToast } from '@/components/ui/Overlay';
import { NamedIcon, VehicleIcon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/requests/RequestParts';
import { CityHero, useMyCity } from '@/components/cities/CityHero';
import { listMyMissions, listMyPayments, listOpenProposals, respondToAssignment, setMyAvailability } from '@/services/mechanic.service';
import { useMechanicProfile, useOnboardingChecklist } from './useMechanic';
import { MISSION_ACTIVE_STATUSES, REQUEST_STATUS, VERIFICATION_STATUS } from '@/domain/status';
import { symptomLabel } from '@/domain/catalog';
import { formatDistance } from '@/domain/geo';
import { formatFCFA } from '@/domain/pricing';
import { firstName, formatCountdown, secondsLeft, timeAgo } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { OpenProposal } from '@/types/database';

export default function MechanicHome() {
  const profile = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const mech = useMechanicProfile();
  const checklist = useOnboardingChecklist();
  const approved = mech.data?.verification_status === 'approved';

  const proposals = useQuery({ queryKey: ['proposals', profile.id], queryFn: listOpenProposals, enabled: approved, refetchInterval: 15_000 });
  const missions = useQuery({ queryKey: ['missions', profile.id], queryFn: () => listMyMissions(profile.id) });
  const payments = useQuery({ queryKey: ['mechanic-payments', profile.id], queryFn: () => listMyPayments(profile.id) });
  useRealtimeInvalidate('assignments', `mechanic_id=eq.${profile.id}`, [['proposals', profile.id]], approved);
  useRealtimeInvalidate('service_requests', `assigned_mechanic_id=eq.${profile.id}`, [['missions', profile.id]]);

  const [toggling, setToggling] = useState(false);
  const city = useMyCity();
  const toggle = async () => {
    if (!mech.data) return;
    setToggling(true);
    try {
      await setMyAvailability(!mech.data.is_available);
      await qc.invalidateQueries({ queryKey: ['mechanic-profile', profile.id] });
      toast.success(mech.data.is_available ? 'Vous êtes indisponible.' : 'Vous êtes disponible : les demandes proches vont arriver.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setToggling(false);
    }
  };

  if (mech.isLoading) return <LoadingBlock />;
  if (mech.isError || !mech.data) return <ErrorState message={errorMessage(mech.error)} onRetry={() => mech.refetch()} />;

  const m = mech.data;
  const vs = VERIFICATION_STATUS[m.verification_status];
  const active = missions.data?.find((r) => MISSION_ACTIVE_STATUSES.includes(r.status));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const monthNet = (payments.data ?? [])
    .filter((p) => p.status === 'confirmed' && (p.confirmed_at ?? '') >= monthStart)
    .reduce((s, p) => s + p.mechanic_net, 0);

  return (
    <div className="space-y-6">
      <CityHero
        city={city}
        pin
        title={`Bonjour ${firstName(profile.full_name)}`}
        subtitle={
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-alert-500" aria-hidden />
            {[m.business_name || 'Espace professionnel', m.commune, profile.city].filter(Boolean).join(' · ')}
          </span>
        }
      />

      {!approved && (
        <Notice tone={vs.tone} title={vs.label}>
          <p>{vs.help}</p>
          {m.rejection_reason && <p className="mt-1">Motif : {m.rejection_reason}</p>}
        </Notice>
      )}

      {!checklist.complete && (
        <Card>
          <p className="mb-3 font-bold">Pour recevoir vos premières missions</p>
          <ul className="space-y-2">
            {checklist.items.map((i) => (
              <li key={i.key} className="flex items-center gap-2 text-sm">
                {i.done ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-silver-600" />}
                <span className={i.done ? 'text-silver-300 line-through' : 'text-white'}>{i.label}</span>
              </li>
            ))}
          </ul>
          <Link to="/pro/profil" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-electric-300">
            Compléter mon profil <ChevronRight className="h-4 w-4" />
          </Link>
        </Card>
      )}

      {/* Disponibilité */}
      <Card className={clsx(m.is_available && 'border-emerald-500/40')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-4">
          <span className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-full', m.is_available ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-silver-400')}>
            <Power className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <p className="font-bold">{m.is_available ? 'Disponible' : 'Indisponible'}</p>
            <p className="text-sm text-silver-400">
              {m.is_available
                ? `Vous recevez les demandes compatibles dans un rayon de ${Number(m.service_radius_km)} km.`
                : 'Activez votre disponibilité pour recevoir des demandes.'}
            </p>
          </div>
          </div>
          <Button variant={m.is_available ? 'secondary' : 'success'} loading={toggling} onClick={toggle} disabled={!approved}>
            {m.is_available ? 'Me rendre indisponible' : 'Me rendre disponible'}
          </Button>
        </div>
      </Card>

      {/* Mission en cours */}
      {active && (
        <Link to={`/pro/missions/${active.id}`} className="card-interactive block border-electric-500/40 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-electric-300">Mission en cours · {active.reference}</p>
            <StatusBadge status={active.status} />
          </div>
          <p className="mt-2 text-sm text-silver-300">{REQUEST_STATUS[active.status].mechanic}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-electric-300">
            Ouvrir la mission <ChevronRight className="h-4 w-4" />
          </p>
        </Link>
      )}

      {/* Propositions */}
      {approved && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Demandes à proximité</h2>
          {proposals.isLoading ? (
            <LoadingBlock />
          ) : proposals.isError ? (
            <ErrorState message={errorMessage(proposals.error)} onRetry={() => proposals.refetch()} />
          ) : !proposals.data?.length ? (
            <EmptyState icon={<Wrench className="h-6 w-6" />} title="Aucune demande pour le moment">
              {m.is_available ? 'Les nouvelles demandes compatibles apparaîtront ici en temps réel.' : 'Rendez-vous disponible pour en recevoir.'}
            </EmptyState>
          ) : (
            <div className="stagger space-y-3">
              {proposals.data.map((p) => (
                <ProposalCard
                  key={p.assignment_id}
                  proposal={p}
                  busy={Boolean(active)}
                  onAccepted={() => {
                    void qc.invalidateQueries({ queryKey: ['missions', profile.id] });
                    navigate(`/pro/missions/${p.request_id}`);
                  }}
                  onChanged={() => qc.invalidateQueries({ queryKey: ['proposals', profile.id] })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="grid grid-cols-3 gap-3">
        <StatCard label="Missions" value={m.completed_missions} icon={<Wrench className="h-4 w-4" />} />
        <StatCard label="Note" value={m.rating_count ? Number(m.rating_avg).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '—'} hint={`${m.rating_count} avis`} icon={<Star className="h-4 w-4" />} />
        <StatCard label="Ce mois" value={<span className="text-lg">{formatFCFA(monthNet)}</span>} hint="net confirmé" />
      </section>
    </div>
  );
}

function ProposalCard({ proposal: p, busy, onAccepted, onChanged }: { proposal: OpenProposal; busy: boolean; onAccepted: () => void; onChanged: () => void }) {
  const now = useNow(1000);
  const toast = useToast();
  const { data: categories } = useCategories();
  const icon = categories?.find((c) => c.slug === p.category_slug)?.icon ?? 'wrench';
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);
  const left = secondsLeft(p.expires_at, now);

  const respond = async (accept: boolean) => {
    setLoading(accept ? 'accept' : 'decline');
    try {
      await respondToAssignment(p.assignment_id, accept);
      if (accept) {
        toast.success('Mission acceptée. Envoyez votre devis au client.');
        onAccepted();
      } else onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
      onChanged();
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="border-electric-500/30">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-electric-500/15 text-electric-300">
          <NamedIcon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold">{p.category_name}</p>
            <Badge tone={left < 60 ? 'danger' : 'warning'}>
              <Clock3 className="h-3 w-3" /> {formatCountdown(left)}
            </Badge>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-silver-400">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> ≈ {formatDistance(Number(p.distance_km))}
            </span>
            <span className="inline-flex items-center gap-1">
              <VehicleIcon type={p.vehicle_type} className="h-3.5 w-3.5" /> {p.vehicle_label ?? 'Véhicule non précisé'}
            </span>
            <span>{timeAgo(p.created_at, now)}</span>
          </p>
        </div>
      </div>
      {p.symptoms.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.symptoms.map((s) => (
            <span key={s} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-silver-200">
              {symptomLabel(s)}
            </span>
          ))}
        </div>
      )}
      {p.description && <p className="mt-2 text-sm text-silver-300">{p.description}</p>}
      {p.address_hint && <p className="mt-1 text-xs text-silver-500">Repère : {p.address_hint}</p>}
      {p.photo_count > 0 && <p className="mt-1 text-xs text-silver-500">{p.photo_count} photo(s) visible(s) après acceptation</p>}
      {busy && <p className="mt-3 text-xs text-amber-300">Terminez votre mission en cours avant d’en accepter une autre.</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" loading={loading === 'decline'} onClick={() => respond(false)}>
          Refuser
        </Button>
        <Button loading={loading === 'accept'} onClick={() => respond(true)} disabled={busy || left === 0}>
          Accepter
        </Button>
      </div>
    </Card>
  );
}
