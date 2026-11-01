import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Clock3, Crosshair, MapPin, UsersRound } from 'lucide-react';
import { useCategories } from '@/hooks/queries';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Avatar, Badge, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Rating, Segmented } from '@/components/ui/Display';
import { nearbyMechanics } from '@/services/requests.service';
import { GEO_ERROR_MESSAGES, GeoError, formatDistance, getCurrentPosition, type GeoPoint } from '@/domain/geo';
import { mechanicKindLabel } from '@/domain/catalog';
import { errorMessage } from '@/lib/errors';

type Sort = 'distance' | 'rating';

export default function NearbyMechanicsPage() {
  const { data: categories } = useCategories();
  const [pos, setPos] = useState<GeoPoint | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState<Sort>('distance');

  const q = useQuery({
    queryKey: ['nearby', pos?.lat, pos?.lng, categoryId],
    queryFn: () => nearbyMechanics({ lat: pos!.lat, lng: pos!.lng, categoryId: categoryId || null }),
    enabled: Boolean(pos),
  });

  const locate = async () => {
    setLocating(true);
    setGeoError(null);
    try {
      setPos(await getCurrentPosition());
    } catch (e) {
      setGeoError(e instanceof GeoError ? GEO_ERROR_MESSAGES[e.code] : GEO_ERROR_MESSAGES.unavailable);
    } finally {
      setLocating(false);
    }
  };

  const catName = (slug: string) => categories?.find((c) => c.slug === slug)?.name ?? slug;
  const list = [...(q.data ?? [])].sort((a, b) =>
    sort === 'rating' ? Number(b.rating_avg) - Number(a.rating_avg) || b.rating_count - a.rating_count : Number(a.distance_km) - Number(b.distance_km),
  );

  return (
    <>
      <PageHeader title="Mécanos proches" subtitle="Des professionnels vérifiés près de vous." />

      {!pos ? (
        <div className="space-y-3">
          <Notice tone="info" icon={<MapPin className="h-5 w-5 text-electric-300" />}>
            Votre position sert uniquement à calculer les distances ; elle n’est pas enregistrée.
          </Notice>
          <Button size="lg" block onClick={locate} loading={locating} icon={<Crosshair className="h-5 w-5" />}>
            Voir les professionnels autour de moi
          </Button>
          {geoError && <ErrorState message={geoError} />}
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filtrer par service">
              <option value="">Tous les services</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Segmented
              value={sort}
              onChange={setSort}
              options={[
                { value: 'distance', label: 'Distance' },
                { value: 'rating', label: 'Note' },
              ]}
            />
          </div>

          {q.isLoading ? (
            <LoadingBlock />
          ) : q.isError ? (
            <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState icon={<UsersRound className="h-6 w-6" />} title="Aucun professionnel vérifié dans un rayon de 30 km">
              Le réseau s’agrandit progressivement. En cas de panne, lancez quand même un SOS : le support peut organiser une prise en charge.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {list.map((m) => (
                <li key={m.id} className="card flex items-center gap-3 p-4">
                  <Avatar name={m.display_name} src={m.avatar_url} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      {m.display_name}
                      <BadgeCheck className="h-4 w-4 shrink-0 text-electric-300" aria-label="Vérifié" />
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-silver-400">
                      <Rating value={m.rating_avg} count={m.rating_count} />
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {formatDistance(Number(m.distance_km))}
                      </span>
                      <span>{mechanicKindLabel(m.kind)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-silver-500">{m.specialties.map(catName).join(' · ')}</p>
                  </div>
                  {m.is_available ? (
                    <Badge tone="success" dot>
                      Disponible
                    </Badge>
                  ) : (
                    <Badge tone="neutral">
                      <Clock3 className="h-3 w-3" /> Indisponible
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6">
            <ButtonLink to="/client/sos" variant="sos" block size="lg">
              Lancer un SOS
            </ButtonLink>
            <p className="mt-2 text-center text-xs text-silver-500">La demande est envoyée aux professionnels disponibles et compétents pour votre panne.</p>
          </div>
        </>
      )}
    </>
  );
}
