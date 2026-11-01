import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, ClipboardList, Clock3, MessageSquareWarning, Star, Users, Wrench } from 'lucide-react';
import { useCategories } from '@/hooks/queries';
import { useRealtimeInvalidate } from '@/hooks/useRealtime';
import { ErrorState, LoadingBlock, PageHeader, StatCard } from '@/components/ui/Display';
import { RequestListItem } from '@/components/requests/RequestParts';
import { getStats, listRequests } from '@/services/admin.service';
import { formatFCFA } from '@/domain/pricing';
import { errorMessage } from '@/lib/errors';

export default function AdminOverview() {
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: getStats, refetchInterval: 60_000 });
  const active = useQuery({ queryKey: ['admin-requests', 'active', ''], queryFn: () => listRequests({ status: 'active' }) });
  const { data: categories } = useCategories(true);
  useRealtimeInvalidate('service_requests', undefined, [['admin-stats'], ['admin-requests']]);

  if (stats.isLoading) return <LoadingBlock />;
  if (stats.isError || !stats.data) return <ErrorState message={errorMessage(stats.error)} onRetry={() => stats.refetch()} />;
  const s = stats.data;
  const catById = new Map((categories ?? []).map((c) => [c.id, c]));
  const searching = (active.data ?? []).filter((r) => r.status === 'searching' || r.status === 'disputed');

  return (
    <>
      <PageHeader title="Vue d’ensemble" subtitle="Indicateurs de pilotage de la plateforme." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Demandes aujourd’hui" value={s.requests_today} hint={`${s.requests_total} au total`} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="En cours" value={s.requests_active} hint={`${s.requests_searching} en recherche`} icon={<Clock3 className="h-4 w-4" />} tone={s.requests_searching ? 'warning' : 'neutral'} />
        <StatCard label="Interventions terminées" value={s.interventions_done} icon={<BadgeCheck className="h-4 w-4" />} />
        <StatCard label="Litiges" value={s.requests_disputed} icon={<AlertTriangle className="h-4 w-4" />} tone={s.requests_disputed ? 'danger' : 'neutral'} />
        <StatCard label="Clients" value={s.clients} icon={<Users className="h-4 w-4" />} />
        <StatCard
          label="Professionnels"
          value={s.mechanics_approved}
          hint={`${s.mechanics_available} disponibles · ${s.mechanics_pending} à valider`}
          icon={<Wrench className="h-4 w-4" />}
          tone={s.mechanics_pending ? 'warning' : 'neutral'}
        />
        <StatCard label="Taux d’acceptation" value={s.acceptance_rate != null ? `${s.acceptance_rate} %` : '—'} hint="Cible ≥ 80 %" />
        <StatCard label="Délai médian d’acceptation" value={s.median_accept_minutes != null ? `${s.median_accept_minutes} min` : '—'} hint="Cible ≤ 5 min" />
        <StatCard label="Volume confirmé" value={<span className="text-lg">{formatFCFA(s.volume_confirmed)}</span>} />
        <StatCard label="Commissions" value={<span className="text-lg">{formatFCFA(s.commission_confirmed)}</span>} />
        <StatCard label="Réclamations ouvertes" value={s.tickets_open} icon={<MessageSquareWarning className="h-4 w-4" />} tone={s.tickets_open ? 'warning' : 'neutral'} />
        <StatCard label="Note moyenne" value={s.rating_avg ?? '—'} hint="Cible ≥ 4,5/5" icon={<Star className="h-4 w-4" />} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">À traiter en priorité</h2>
          <Link to="/admin/demandes" className="text-sm font-semibold text-electric-300">
            Toutes les demandes
          </Link>
        </div>
        {searching.length === 0 ? (
          <p className="text-sm text-silver-500">Aucune demande en attente de professionnel ni en litige.</p>
        ) : (
          <div className="space-y-2">
            {searching.map((r) => (
              <RequestListItem key={r.id} request={r} category={catById.get(r.category_id)} to={`/admin/demandes/${r.id}`} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
