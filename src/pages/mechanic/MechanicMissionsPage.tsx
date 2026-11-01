import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/queries';
import { EmptyState, ErrorState, LoadingBlock, Segmented } from '@/components/ui/Display';
import { CityHero } from '@/components/cities/CityHero';
import { PAGE_CITY } from '@/domain/cities';
import { RequestListItem } from '@/components/requests/RequestParts';
import { listMyMissions } from '@/services/mechanic.service';
import { MISSION_ACTIVE_STATUSES } from '@/domain/status';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';

type Filter = 'active' | 'done' | 'all';

export default function MechanicMissionsPage() {
  const profile = useProfile();
  const { data: categories } = useCategories();
  const [filter, setFilter] = useState<Filter>('active');
  const q = useQuery({ queryKey: ['missions', profile.id], queryFn: () => listMyMissions(profile.id) });
  const catById = new Map((categories ?? []).map((c) => [c.id, c]));

  const items = (q.data ?? []).filter((r) =>
    filter === 'active' ? MISSION_ACTIVE_STATUSES.includes(r.status) || r.status === 'disputed' : filter === 'done' ? ['paid', 'closed'].includes(r.status) : true,
  );

  return (
    <>
      <CityHero city={PAGE_CITY.proMissions} title="Mes missions" subtitle="Missions acceptées ou attribuées par le support." />
      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: 'En cours' },
          { value: 'done', label: 'Terminées' },
          { value: 'all', label: 'Toutes' },
        ]}
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Wrench className="h-6 w-6" />} title="Aucune mission" />
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <RequestListItem
              key={r.id}
              request={r}
              category={catById.get(r.category_id)}
              to={`/pro/missions/${r.id}`}
              subtitle={`${r.reference} · ${formatDateTime(r.accepted_at ?? r.created_at)}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
