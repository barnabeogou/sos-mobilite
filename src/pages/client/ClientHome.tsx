import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, ChevronRight, MapPin, ShieldAlert } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/queries';
import { useRealtimeInvalidate } from '@/hooks/useRealtime';
import { SosButton } from '@/components/brand/SosButton';
import { NamedIcon } from '@/components/ui/Icon';
import { EmptyState, ErrorState, Notice } from '@/components/ui/Display';
import { RequestListItem, StatusBadge } from '@/components/requests/RequestParts';
import { listMyRequests } from '@/services/requests.service';
import { listMaintenance, listMyVehicles } from '@/services/vehicles.service';
import { computeReminders, daysLabel } from '@/domain/reminders';
import { EMERGENCY_NOTICE, QUICK_SERVICES } from '@/domain/catalog';
import { isActive, REQUEST_STATUS } from '@/domain/status';
import { errorMessage } from '@/lib/errors';
import { firstName } from '@/lib/format';

export default function ClientHome() {
  const profile = useProfile();
  const { data: categories } = useCategories();
  const requests = useQuery({ queryKey: ['my-requests', profile.id], queryFn: () => listMyRequests(profile.id) });
  const vehicles = useQuery({ queryKey: ['vehicles', profile.id], queryFn: () => listMyVehicles(profile.id) });
  const maintenance = useQuery({ queryKey: ['maintenance', profile.id], queryFn: () => listMaintenance(profile.id) });
  useRealtimeInvalidate('service_requests', `client_id=eq.${profile.id}`, [['my-requests', profile.id]]);

  const catById = new Map((categories ?? []).map((c) => [c.id, c]));
  const active = requests.data?.find((r) => isActive(r.status));
  const recent = (requests.data ?? []).filter((r) => r.id !== active?.id).slice(0, 3);
  const reminders = computeReminders(vehicles.data ?? [], maintenance.data ?? []);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold md:text-3xl">Salut {firstName(profile.full_name) || 'à vous'}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-silver-400">
          <MapPin className="h-4 w-4" aria-hidden />
          {[profile.commune, profile.city].filter(Boolean).join(', ')}
        </p>
      </section>

      {active ? (
        <Link to={`/client/demandes/${active.id}`} className="card-interactive block border-electric-500/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-electric-300">Intervention en cours</p>
            <StatusBadge status={active.status} />
          </div>
          <p className="mt-2 text-lg font-bold">{catById.get(active.category_id)?.name ?? 'Assistance'}</p>
          <p className="mt-1 text-sm text-silver-300">{REQUEST_STATUS[active.status].client}</p>
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-electric-300">
            Suivre l’intervention <ChevronRight className="h-4 w-4" />
          </p>
        </Link>
      ) : (
        <section className="flex flex-col items-center">
          <SosButton to="/client/sos" />
          <div className="grid w-full max-w-md grid-cols-3 gap-3">
            {QUICK_SERVICES.map((slug) => {
              const c = categories?.find((x) => x.slug === slug);
              if (!c) return null;
              return (
                <Link key={slug} to={`/client/sos?service=${c.id}`} className="card-interactive flex flex-col items-center gap-2 px-2 py-4 text-center">
                  <NamedIcon name={c.icon} className="h-6 w-6 text-electric-300" />
                  <span className="text-xs font-semibold leading-tight">{c.slug === 'crevaison' ? 'Pneu crevé' : c.slug === 'batterie' ? 'Batterie' : c.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {reminders.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Rappels</h2>
          {reminders.slice(0, 3).map((r) => (
            <Link key={`${r.vehicleId}-${r.title}`} to="/client/vehicules">
              <Notice
                tone={r.level === 'overdue' ? 'danger' : 'warning'}
                icon={<AlarmClock className={r.level === 'overdue' ? 'h-5 w-5 text-alert-400' : 'h-5 w-5 text-amber-300'} />}
                title={r.title}
                className="mb-2"
              >
                Échéance {daysLabel(r.daysLeft)}.
              </Notice>
            </Link>
          ))}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Dernières interventions</h2>
          <Link to="/client/historique" className="text-sm font-semibold text-electric-300">
            Voir tout
          </Link>
        </div>
        {requests.isError ? (
          <ErrorState message={errorMessage(requests.error)} onRetry={() => requests.refetch()} />
        ) : recent.length === 0 ? (
          <EmptyState title="Aucune intervention pour l’instant">Vos demandes d’assistance apparaîtront ici.</EmptyState>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <RequestListItem key={r.id} request={r} category={catById.get(r.category_id)} to={`/client/demandes/${r.id}`} />
            ))}
          </div>
        )}
      </section>

      <p className="flex gap-2 text-xs text-silver-500">
        <ShieldAlert className="h-4 w-4 shrink-0 text-alert-500" aria-hidden />
        {EMERGENCY_NOTICE}
      </p>
    </div>
  );
}
