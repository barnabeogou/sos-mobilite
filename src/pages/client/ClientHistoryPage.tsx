import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/queries';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Segmented } from '@/components/ui/Display';
import { RequestListItem } from '@/components/requests/RequestParts';
import { listMyRequests } from '@/services/requests.service';
import { isActive } from '@/domain/status';
import { errorMessage } from '@/lib/errors';

type Filter = 'all' | 'active' | 'done' | 'cancelled';

export default function ClientHistoryPage() {
  const profile = useProfile();
  const { data: categories } = useCategories();
  const [filter, setFilter] = useState<Filter>('all');
  const q = useQuery({ queryKey: ['my-requests', profile.id], queryFn: () => listMyRequests(profile.id) });
  const catById = new Map((categories ?? []).map((c) => [c.id, c]));

  const items = (q.data ?? []).filter((r) => {
    if (filter === 'active') return isActive(r.status) || r.status === 'disputed';
    if (filter === 'done') return r.status === 'paid' || r.status === 'closed';
    if (filter === 'cancelled') return r.status === 'cancelled' || r.status === 'expired';
    return true;
  });

  return (
    <>
      <PageHeader title="Mes interventions" subtitle="Historique de vos demandes, devis et reçus." />
      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Toutes' },
          { value: 'active', label: 'En cours' },
          { value: 'done', label: 'Terminées' },
          { value: 'cancelled', label: 'Annulées' },
        ]}
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Rien à afficher" action={<ButtonLink to="/client/sos" variant="sos">Signaler une panne</ButtonLink>} />
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <RequestListItem key={r.id} request={r} category={catById.get(r.category_id)} to={`/client/demandes/${r.id}`} />
          ))}
        </div>
      )}
    </>
  );
}
