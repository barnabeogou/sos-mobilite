import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Star } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Rating } from '@/components/ui/Display';
import { useToast } from '@/components/ui/Overlay';
import { hasAdminLevel } from '@/components/layout/Guards';
import { listReviews, profilesByIds, setReviewHidden } from '@/services/admin.service';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/errors';

export default function AdminReviews() {
  const me = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-reviews'], queryFn: listReviews });
  const people = useQuery({
    queryKey: ['admin-review-people', q.data?.length],
    queryFn: () => profilesByIds((q.data ?? []).flatMap((r) => [r.client_id, r.mechanic_id])),
    enabled: Boolean(q.data?.length),
  });
  const canOperate = hasAdminLevel(me.admin_level, 'operations');

  return (
    <>
      <PageHeader title="Évaluations" subtitle="Avis laissés après les interventions payées. Masquer un avis abusif recalcule la note." />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={<Star className="h-6 w-6" />} title="Aucune évaluation" />
      ) : (
        <div className="space-y-3">
          {q.data.map((r) => (
            <Card key={r.id} className={r.is_hidden ? 'opacity-60' : undefined}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Rating value={r.rating} count={1} />
                <span className="text-xs text-silver-500">
                  {people.data?.[r.client_id]?.full_name ?? '…'} → {people.data?.[r.mechanic_id]?.full_name ?? '…'} · {formatDate(r.created_at)}
                </span>
              </div>
              {r.comment && <p className="mt-2 text-sm text-silver-300">« {r.comment} »</p>}
              <div className="mt-3 flex items-center gap-2">
                <Link to={`/admin/demandes/${r.request_id}`} className="text-sm font-semibold text-electric-300">
                  Voir l’intervention
                </Link>
                {r.is_hidden && <Badge>Masqué</Badge>}
                {canOperate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    icon={r.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    onClick={() =>
                      setReviewHidden(r.id, !r.is_hidden)
                        .then(() => qc.invalidateQueries({ queryKey: ['admin-reviews'] }))
                        .catch((e) => toast.error(errorMessage(e)))
                    }
                  >
                    {r.is_hidden ? 'Réafficher' : 'Masquer'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
