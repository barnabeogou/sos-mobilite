import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useCategories } from '@/hooks/queries';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from '@/components/ui/Display';
import { RequestListItem } from '@/components/requests/RequestParts';
import { listRequests } from '@/services/admin.service';
import { REQUEST_STATUS } from '@/domain/status';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import type { RequestStatus } from '@/types/database';

export default function AdminRequests() {
  const [status, setStatus] = useState<RequestStatus | 'active' | 'all'>('active');
  const [search, setSearch] = useState('');
  const { data: categories } = useCategories(true);
  const q = useQuery({ queryKey: ['admin-requests', status, search], queryFn: () => listRequests({ status, search }) });
  const catById = new Map((categories ?? []).map((c) => [c.id, c]));

  return (
    <>
      <PageHeader title="Demandes" subtitle="Suivi de toutes les demandes d’assistance, intervention manuelle si nécessaire." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_240px]">
        <Input placeholder="Rechercher une référence (SOS-…)" value={search} onChange={(e) => setSearch(e.target.value)} suffix={<Search className="h-4 w-4" />} />
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Statut">
          <option value="active">En cours (dont litiges)</option>
          <option value="all">Toutes</option>
          {(Object.keys(REQUEST_STATUS) as RequestStatus[]).map((s) => (
            <option key={s} value={s}>
              {REQUEST_STATUS[s].label}
            </option>
          ))}
        </Select>
      </div>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState title="Aucune demande" />
      ) : (
        <div className="space-y-2">
          {q.data.map((r) => (
            <RequestListItem
              key={r.id}
              request={r}
              category={catById.get(r.category_id)}
              to={`/admin/demandes/${r.id}`}
              subtitle={`${r.reference} · ${formatDateTime(r.created_at)} · rayon ${Number(r.search_radius_km)} km`}
            />
          ))}
        </div>
      )}
    </>
  );
}
