import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Wrench } from 'lucide-react';
import { Avatar, Badge, EmptyState, ErrorState, LoadingBlock, PageHeader, Rating, Segmented } from '@/components/ui/Display';
import { listMechanics } from '@/services/admin.service';
import { VERIFICATION_STATUS } from '@/domain/status';
import { mechanicKindLabel } from '@/domain/catalog';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { VerificationStatus } from '@/types/database';

export default function AdminMechanics() {
  const [status, setStatus] = useState<VerificationStatus | 'all'>('pending');
  const q = useQuery({ queryKey: ['admin-mechanics', status], queryFn: () => listMechanics(status) });

  return (
    <>
      <PageHeader title="Professionnels" subtitle="Validation obligatoire avant toute mission." />
      <Segmented
        className="mb-4"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'pending', label: 'À valider' },
          { value: 'approved', label: 'Validés' },
          { value: 'rejected', label: 'Refusés' },
          { value: 'suspended', label: 'Suspendus' },
          { value: 'all', label: 'Tous' },
        ]}
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={<Wrench className="h-6 w-6" />} title="Aucun professionnel dans cette catégorie" />
      ) : (
        <div className="space-y-2">
          {q.data.map((m) => (
            <Link key={m.id} to={`/admin/professionnels/${m.id}`} className="card-interactive flex items-center gap-3 p-4">
              <Avatar name={m.business_name || m.profile?.full_name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.business_name || m.profile?.full_name || '—'}</p>
                <p className="truncate text-xs text-silver-400">
                  {mechanicKindLabel(m.kind)} · {[m.commune, m.profile?.city].filter(Boolean).join(', ') || 'lieu ?'} · {m.profile?.phone ?? 'sans téléphone'} · inscrit le {formatDate(m.created_at)}
                </p>
              </div>
              <Rating value={m.rating_avg} count={m.rating_count} className="hidden sm:inline-flex" />
              <Badge tone={VERIFICATION_STATUS[m.verification_status].tone}>{VERIFICATION_STATUS[m.verification_status].label}</Badge>
              {m.is_available && <Badge tone="success" dot>Dispo</Badge>}
              <ChevronRight className="h-5 w-5 text-silver-500" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
