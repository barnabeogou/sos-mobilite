import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { Card, EmptyState, ErrorState, LoadingBlock, Rating } from '@/components/ui/Display';
import { CityHero } from '@/components/cities/CityHero';
import { PAGE_CITY } from '@/domain/cities';
import { listMyReviews } from '@/services/mechanic.service';
import { useMechanicProfile } from './useMechanic';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/errors';

export default function MechanicReviewsPage() {
  const profile = useProfile();
  const mech = useMechanicProfile();
  const q = useQuery({ queryKey: ['my-reviews', profile.id], queryFn: () => listMyReviews(profile.id) });
  const visible = (q.data ?? []).filter((r) => !r.is_hidden);

  return (
    <>
      <CityHero city={PAGE_CITY.proReviews} title="Mes évaluations" subtitle="Notes laissées par les clients après paiement d’une intervention." />
      {mech.data && (
        <Card className="mb-6 flex items-center gap-4">
          <span className="font-display text-5xl font-extrabold">
            {mech.data.rating_count ? Number(mech.data.rating_avg).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '—'}
          </span>
          <div>
            <Rating value={mech.data.rating_avg} count={mech.data.rating_count} />
            <p className="mt-1 text-sm text-silver-400">{mech.data.completed_missions} intervention(s) réalisée(s)</p>
          </div>
        </Card>
      )}
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !visible.length ? (
        <EmptyState icon={<Star className="h-6 w-6" />} title="Pas encore d’évaluation">
          Après chaque intervention payée, le client peut vous noter.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center justify-between">
                <Rating value={r.rating} count={1} />
                <span className="text-xs text-silver-500">{formatDate(r.created_at)}</span>
              </div>
              {r.comment && <p className="mt-2 text-sm text-silver-300">« {r.comment} »</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
