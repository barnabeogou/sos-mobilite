import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, MapPin, UserCog } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/queries';
import { useRealtimeInvalidate } from '@/hooks/useRealtime';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Field';
import { Badge, Card, DefinitionList, ErrorState, LoadingBlock, Notice } from '@/components/ui/Display';
import { Modal, useToast } from '@/components/ui/Overlay';
import { hasAdminLevel } from '@/components/layout/Guards';
import { OfferHistory, QuoteBreakdown, StatusBadge } from '@/components/requests/RequestParts';
import { getRequestDetail, requestPhotoUrls } from '@/services/requests.service';
import { assignMechanic, listApprovedMechanics, setRequestStatus } from '@/services/admin.service';
import { placeUrl } from '@/services/maps/maps';
import { ASSIGNMENT_STATUS, PAYMENT_STATUS, REQUEST_STATUS } from '@/domain/status';
import { paymentMethodLabel, symptomLabel, vehicleTypeLabel } from '@/domain/catalog';
import { distanceKm, formatDistance } from '@/domain/geo';
import { formatFCFA } from '@/domain/pricing';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { RequestStatus } from '@/types/database';

export default function AdminRequestDetail() {
  const { id = '' } = useParams();
  const me = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: categories } = useCategories(true);
  const key = ['request', id];
  const detail = useQuery({ queryKey: key, queryFn: () => getRequestDetail(id) });
  useRealtimeInvalidate('service_requests', `id=eq.${id}`, [key]);
  const photos = useQuery({
    queryKey: ['request-photos', id],
    queryFn: () => requestPhotoUrls(detail.data!.request.photos),
    enabled: Boolean(detail.data?.request.photos.length),
  });
  const canOperate = hasAdminLevel(me.admin_level, 'operations');
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['admin-requests'] });
    void qc.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  if (detail.isLoading) return <LoadingBlock />;
  if (detail.isError || !detail.data) return <ErrorState message={errorMessage(detail.error)} onRetry={() => detail.refetch()} />;
  const { request, quotes, offers, assignments, payment, review, history, mechanic, client, vehicle } = detail.data;
  const category = categories?.find((c) => c.id === request.category_id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/demandes" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-night-850" aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{request.reference}</h1>
          <p className="text-sm text-silver-400">
            {category?.name} · {formatDateTime(request.created_at)}
          </p>
        </div>
        <StatusBadge status={request.status} />
        {canOperate && (
          <div className="flex gap-2">
            <Button size="sm" icon={<UserCog className="h-4 w-4" />} onClick={() => setAssignOpen(true)}>
              Attribuer
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setStatusOpen(true)}>
              Changer le statut
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <p className="mb-2 font-bold">Client</p>
          <DefinitionList
            items={[
              { label: 'Nom', value: client?.full_name ?? '—' },
              { label: 'Téléphone', value: client?.phone ?? '—' },
              { label: 'Véhicule', value: vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.plate ?? ''}` : vehicleTypeLabel(request.vehicle_type) },
              {
                label: 'Position',
                value: (
                  <a href={placeUrl(request)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-electric-300">
                    <MapPin className="h-4 w-4" /> {request.lat.toFixed(4)}, {request.lng.toFixed(4)}
                  </a>
                ),
              },
              { label: 'Repère', value: request.address_hint ?? '—' },
              { label: 'Rayon de recherche', value: `${Number(request.search_radius_km)} km` },
            ]}
          />
        </Card>
        <Card>
          <p className="mb-2 font-bold">Professionnel</p>
          {mechanic ? (
            <DefinitionList
              items={[
                { label: 'Nom', value: <Link to={`/admin/professionnels/${mechanic.id}`} className="text-electric-300">{mechanic.display_name}</Link> },
                { label: 'Téléphone', value: mechanic.phone ?? '—' },
                { label: 'Note', value: mechanic.rating_count ? `${mechanic.rating_avg} (${mechanic.rating_count})` : '—' },
              ]}
            />
          ) : (
            <Notice tone="warning">Aucun professionnel attribué.</Notice>
          )}
        </Card>
      </div>

      <Card>
        <p className="mb-2 font-bold">Panne</p>
        <div className="flex flex-wrap gap-1.5">
          {request.symptoms.map((s) => (
            <span key={s} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs">
              {symptomLabel(s)}
            </span>
          ))}
        </div>
        {request.description && <p className="mt-2 text-sm text-silver-300">{request.description}</p>}
        {(photos.data ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {photos.data!.map((src) => (
              <a key={src} href={src} target="_blank" rel="noreferrer">
                <img src={src} alt="" className="h-20 w-20 rounded-xl object-cover" />
              </a>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <p className="mb-3 font-bold">Propositions ({assignments.length})</p>
          {assignments.length === 0 ? (
            <p className="text-sm text-silver-500">Aucun professionnel compatible sollicité.</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs text-silver-400">{a.mechanic_id.slice(0, 8)}</span>
                  <span className="text-silver-400">{a.distance_km != null ? formatDistance(Number(a.distance_km)) : '—'}</span>
                  <Badge tone={ASSIGNMENT_STATUS[a.status].tone}>{ASSIGNMENT_STATUS[a.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <p className="mb-3 font-bold">Historique</p>
          <ol className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className="w-24 shrink-0 text-xs text-silver-500">{formatDateTime(h.created_at)}</span>
                <span>
                  <span className="font-semibold">{REQUEST_STATUS[h.to_status].label}</span>
                  {h.note && <span className="block text-xs text-silver-400">{h.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {quotes.length > 0 && (
        <Card>
          <p className="mb-3 font-bold">Devis</p>
          <div className="grid gap-4 md:grid-cols-2">
            {quotes.map((q) => (
              <div key={q.id} className="rounded-xl border border-white/10 p-4">
                <div className="mb-2 flex justify-between text-xs text-silver-400">
                  <span>Version {q.version}</span>
                  <span>{q.status === 'accepted' ? 'Accepté' : q.status === 'rejected' ? 'Refusé' : q.status === 'proposed' ? 'En attente' : 'Remplacé'}</span>
                </div>
                <QuoteBreakdown quote={q} />
              </div>
            ))}
          </div>
          {offers.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <OfferHistory offers={offers} quotes={quotes} viewer="admin" />
            </div>
          )}
        </Card>
      )}

      {payment && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">Paiement</p>
              <p className="text-sm text-silver-400">
                {formatFCFA(payment.amount)} · {paymentMethodLabel(payment.method)} · commission {formatFCFA(payment.commission_amount)} · {payment.receipt_number ?? 'pas de reçu'}
              </p>
            </div>
            <Badge tone={PAYMENT_STATUS[payment.status].tone}>{PAYMENT_STATUS[payment.status].label}</Badge>
            {payment.status === 'confirmed' && (
              <ButtonLink to={`/admin/recus/${request.id}`} size="sm" variant="secondary" icon={<FileText className="h-4 w-4" />}>
                Reçu
              </ButtonLink>
            )}
          </div>
        </Card>
      )}
      {review && (
        <Card>
          <p className="font-bold">Évaluation : {review.rating}/5</p>
          {review.comment && <p className="mt-1 text-sm text-silver-300">« {review.comment} »</p>}
        </Card>
      )}

      <AssignModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        origin={{ lat: request.lat, lng: request.lng }}
        onAssign={async (mechanicId, note) => {
          try {
            await assignMechanic(request.id, mechanicId, note);
            toast.success('Professionnel attribué.');
            refresh();
            setAssignOpen(false);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
      <StatusModal
        open={statusOpen}
        current={request.status}
        onClose={() => setStatusOpen(false)}
        onSubmit={async (s, note) => {
          try {
            await setRequestStatus(request.id, s, note);
            toast.success('Statut mis à jour.');
            refresh();
            setStatusOpen(false);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

function AssignModal({ open, onClose, onAssign, origin }: { open: boolean; onClose: () => void; onAssign: (id: string, note: string | null) => Promise<void>; origin: { lat: number; lng: number } }) {
  const mechanics = useQuery({ queryKey: ['admin-mechanics', 'approved'], queryFn: listApprovedMechanics, enabled: open });
  const [selected, setSelected] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const sorted = [...(mechanics.data ?? [])]
    .map((m) => ({ m, d: m.base_lat != null && m.base_lng != null ? distanceKm(origin, { lat: m.base_lat, lng: m.base_lng }) : null }))
    .sort((a, b) => (a.d ?? 9999) - (b.d ?? 9999));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attribution manuelle"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!selected}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onAssign(selected, note.trim() || null);
              setBusy(false);
            }}
          >
            Attribuer
          </Button>
        </>
      }
    >
      {mechanics.isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-4">
          <Select label="Professionnel validé" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Choisir…</option>
            {sorted.map(({ m, d }) => (
              <option key={m.id} value={m.id}>
                {m.business_name || m.profile?.full_name} — {d != null ? formatDistance(d) : 'position inconnue'} {m.is_available ? '· disponible' : '· indisponible'}
              </option>
            ))}
          </Select>
          <Textarea label="Note (ex. : appel au garage)" optional value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="text-xs text-silver-500">Le professionnel et le client sont notifiés. Le professionnel devra envoyer son devis.</p>
        </div>
      )}
    </Modal>
  );
}

function StatusModal({ open, current, onClose, onSubmit }: { open: boolean; current: RequestStatus; onClose: () => void; onSubmit: (s: RequestStatus, note: string) => Promise<void> }) {
  const [status, setStatus] = useState<RequestStatus>(current);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Intervention manuelle sur le statut"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={note.trim().length < 3 || status === current}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit(status, note.trim());
              setBusy(false);
            }}
          >
            Appliquer
          </Button>
        </>
      }
    >
      <Notice tone="warning" className="mb-4">
        À utiliser uniquement en cas de problème. L’action est historisée et le client comme le professionnel sont notifiés avec le motif.
      </Notice>
      <div className="space-y-4">
        <Select label="Nouveau statut" value={status} onChange={(e) => setStatus(e.target.value as RequestStatus)}>
          {(Object.keys(REQUEST_STATUS) as RequestStatus[]).map((s) => (
            <option key={s} value={s}>
              {REQUEST_STATUS[s].label}
            </option>
          ))}
        </Select>
        <Textarea label="Motif (obligatoire)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
