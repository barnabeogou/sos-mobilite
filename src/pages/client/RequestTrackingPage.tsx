import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  Expand,
  FileText,
  KeyRound,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Phone,
  Radar,
  Share2,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useCategories, useSettings } from '@/hooks/queries';
import { useRealtimeInvalidate } from '@/hooks/useRealtime';
import { useNow } from '@/hooks/useNow';
import { AnchorButton, Button, ButtonLink } from '@/components/ui/Button';
import { Avatar, Card, ErrorState, LoadingBlock, Notice, Rating, StarInput } from '@/components/ui/Display';
import { Textarea } from '@/components/ui/Field';
import { Modal, useToast } from '@/components/ui/Overlay';
import { NamedIcon } from '@/components/ui/Icon';
import { OfferHistory, QuoteBreakdown, StatusBadge, StatusTimeline } from '@/components/requests/RequestParts';
import { ClientQuoteActions } from '@/components/requests/Negotiation';
import {
  cancelRequest,
  confirmPayment,
  expandSearch,
  getArrivalCode,
  getRequestDetail,
  proposePrice,
  reportProblem,
  requestPhotoUrls,
  respondToQuote,
  submitReview,
} from '@/services/requests.service';
import { supportContacts, numericSetting } from '@/services/catalog.service';
import { CANCELLATION_RULE, mechanicKindLabel, paymentMethodLabel, symptomLabel, vehicleTypeLabel } from '@/domain/catalog';
import { CLIENT_CAN_CANCEL, CLIENT_CAN_REPORT, REQUEST_STATUS } from '@/domain/status';
import { DEFAULT_NEGOTIATION, formatFCFA } from '@/domain/pricing';
import { formatCountdown, formatDateTime, secondsLeft, telHref, whatsappHref } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { placeUrl } from '@/services/maps/maps';

export default function RequestTrackingPage() {
  const { id = '' } = useParams();
  const profile = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: categories } = useCategories();
  const { data: settings } = useSettings();
  const support = supportContacts(settings);
  const maxRadius = numericSetting(settings, 'max_search_radius_km', 30);
  const maxOffers = numericSetting(settings, 'max_price_offers', DEFAULT_NEGOTIATION.maxOffers);
  const minOfferRatio = numericSetting(settings, 'min_offer_ratio', DEFAULT_NEGOTIATION.minRatio);

  const key = ['request', id];
  const detail = useQuery({ queryKey: key, queryFn: () => getRequestDetail(id), refetchInterval: 30_000 });
  useRealtimeInvalidate('service_requests', `id=eq.${id}`, [key, ['my-requests', profile.id]]);
  useRealtimeInvalidate('quotes', `request_id=eq.${id}`, [key]);
  useRealtimeInvalidate('price_offers', `request_id=eq.${id}`, [key]);
  useRealtimeInvalidate('assignments', `request_id=eq.${id}`, [key]);
  useRealtimeInvalidate('payments', `request_id=eq.${id}`, [key]);

  const status = detail.data?.request.status;
  const codeVisible = status === 'accepted' || status === 'quoted' || status === 'quote_accepted' || status === 'en_route';
  const arrivalCode = useQuery({ queryKey: ['arrival-code', id], queryFn: () => getArrivalCode(id), enabled: codeVisible });
  const photos = useQuery({
    queryKey: ['request-photos', id],
    queryFn: () => requestPhotoUrls(detail.data!.request.photos),
    enabled: Boolean(detail.data?.request.photos.length),
    staleTime: 8 * 60_000,
  });
  const now = useNow(1000, status === 'searching');

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['my-requests', profile.id] });
  };
  const act = <T,>(fn: () => Promise<T>, success: string) =>
    fn()
      .then(() => {
        toast.success(success);
        refresh();
      })
      .catch((e) => toast.error(errorMessage(e)));

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  if (detail.isLoading) return <LoadingBlock />;
  if (detail.isError || !detail.data) return <ErrorState message={errorMessage(detail.error)} onRetry={() => detail.refetch()} />;

  const { request, quotes, offers, assignments, payment, review, history, mechanic, vehicle } = detail.data;
  const category = categories?.find((c) => c.id === request.category_id);
  const pendingQuote = quotes.find((q) => q.status === 'proposed');
  const acceptedQuote = quotes.find((q) => q.status === 'accepted');
  const openProposals = assignments.filter((a) => a.status === 'proposed' && new Date(a.expires_at) > now);
  const nextExpiry = openProposals.map((a) => a.expires_at).sort()[0];
  const meta = REQUEST_STATUS[request.status];

  const share = async () => {
    const text = `Intervention SOS MOBILITÉ ${request.reference} — ${category?.name ?? ''}. Statut : ${meta.label}.${
      mechanic ? ` Professionnel : ${mechanic.display_name}${mechanic.phone ? ` (${mechanic.phone})` : ''}.` : ''
    }`;
    try {
      if (navigator.share) await navigator.share({ title: 'Mon intervention SOS MOBILITÉ', text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success('Informations copiées : collez-les dans un message à un proche.');
      }
    } catch {
      /* partage annulé */
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/client/historique" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-night-850" aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-bold leading-tight sm:text-xl">
            <NamedIcon name={category?.icon ?? 'wrench'} className="h-5 w-5 text-electric-300" />
            {category?.name ?? 'Assistance'}
          </h1>
          <p className="text-xs text-silver-500">
            {request.reference} · {formatDateTime(request.created_at)}
          </p>
          <div className="mt-1.5 sm:hidden">
            <StatusBadge status={request.status} />
          </div>
        </div>
        <div className="hidden sm:block">
          <StatusBadge status={request.status} />
        </div>
      </div>

      <Notice tone={meta.tone}>{meta.client}</Notice>

      {/* Recherche */}
      {request.status === 'searching' && (
        <Card className="text-center">
          <div className="relative mx-auto grid h-28 w-28 place-items-center">
            <span className="absolute inset-0 rounded-full bg-electric-500/30 animate-radar" aria-hidden />
            <span className="absolute inset-0 rounded-full bg-electric-500/20 animate-radar [animation-delay:1.1s]" aria-hidden />
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-electric-500 text-white shadow-glow">
              <Radar className="h-8 w-8" />
            </span>
          </div>
          {openProposals.length > 0 ? (
            <>
              <p className="mt-4 font-semibold">
                {openProposals.length} professionnel{openProposals.length > 1 ? 's' : ''} contacté{openProposals.length > 1 ? 's' : ''}
              </p>
              {nextExpiry && <p className="text-sm text-silver-400">Réponse attendue sous {formatCountdown(secondsLeft(nextExpiry, now))}</p>}
            </>
          ) : (
            <>
              <p className="mt-4 font-semibold">Aucun professionnel disponible n’a encore répondu</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-silver-400">
                Zone actuelle : {Number(request.search_radius_km).toLocaleString('fr-FR')} km. Élargissez la recherche ou contactez le support pour
                une prise en charge manuelle.
              </p>
            </>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {Number(request.search_radius_km) < maxRadius && (
              <Button
                variant={openProposals.length ? 'secondary' : 'primary'}
                icon={<Expand className="h-4 w-4" />}
                loading={busy === 'expand'}
                onClick={() =>
                  run('expand', () =>
                    expandSearch(request.id)
                      .then((n) => {
                        toast.info(n > 0 ? `${n} professionnel(s) contacté(s).` : 'Toujours personne de disponible. Le support est prévenu.');
                        refresh();
                      })
                      .catch((e) => toast.error(errorMessage(e))),
                  )
                }
              >
                Élargir la zone
              </Button>
            )}
            {support.phone && (
              <AnchorButton href={telHref(support.phone)} icon={<LifeBuoy className="h-4 w-4" />}>
                Appeler le support
              </AnchorButton>
            )}
          </div>
        </Card>
      )}

      {/* Professionnel attribué */}
      {mechanic && !['cancelled'].includes(request.status) && (
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={mechanic.display_name} src={mechanic.avatar_url} size={52} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-bold leading-tight">
                {mechanic.display_name} <BadgeCheck className="h-4 w-4 shrink-0 text-electric-300" aria-label="Profil vérifié" />
              </p>
              <p className="text-sm text-silver-400">
                {mechanicKindLabel(mechanic.kind)}
                {mechanic.commune ? ` · ${mechanic.commune}` : ''}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <Rating value={mechanic.rating_avg} count={mechanic.rating_count} />
                {mechanic.completed_missions > 0 && (
                  <span className="text-xs text-silver-500">
                    {mechanic.completed_missions} intervention{mechanic.completed_missions > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            {mechanic.phone && (
              <div className="flex gap-2">
                <a href={telHref(mechanic.phone)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-night-800" aria-label="Appeler">
                  <Phone className="h-5 w-5" />
                </a>
                <a
                  href={whatsappHref(mechanic.phone, `Bonjour, je vous contacte pour l’intervention ${request.reference} (SOS MOBILITÉ).`)}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-night-800"
                  aria-label="Écrire sur WhatsApp"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Code d'arrivée */}
      {codeVisible && arrivalCode.data && (
        <Card className="border-electric-500/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex flex-1 items-start gap-3">
              <KeyRound className="mt-0.5 h-6 w-6 shrink-0 text-electric-300" aria-hidden />
              <div>
                <p className="text-sm font-semibold">Code de confirmation d’arrivée</p>
                <p className="text-xs text-silver-400">Communiquez-le au professionnel uniquement lorsqu’il est devant vous.</p>
              </div>
            </div>
            <p
              data-testid="arrival-code"
              className="rounded-2xl bg-night-950/60 py-2 text-center font-display text-4xl font-extrabold tracking-[0.35em] text-white sm:bg-transparent sm:py-0 sm:text-3xl"
              aria-label={`Code ${arrivalCode.data.split('').join(' ')}`}
            >
              {arrivalCode.data}
            </p>
          </div>
        </Card>
      )}

      {/* Devis en attente */}
      {pendingQuote && (
        <Card className="border-amber-500/40">
          <p className="mb-3 font-bold">{request.status === 'in_progress' ? 'Devis complémentaire à valider' : 'Devis proposé'}</p>
          <QuoteBreakdown quote={pendingQuote} />
          <p className="mt-3 text-xs text-silver-400">
            {request.status === 'in_progress'
              ? 'Si vous refusez, le professionnel s’en tient au devis déjà validé.'
              : 'En validant, vous acceptez ce montant. Tout supplément devra être de nouveau validé par vous.'}
          </p>
          <ClientQuoteActions
            quote={pendingQuote}
            offers={offers}
            acceptedTotal={request.status === 'in_progress' ? acceptedQuote?.total_amount ?? null : null}
            maxOffers={maxOffers}
            minRatio={minOfferRatio}
            busy={busy}
            onAccept={() => run('accept', () => act(() => respondToQuote(pendingQuote.id, true), 'Devis validé.'))}
            onReject={() => run('reject', () => act(() => respondToQuote(pendingQuote.id, false), 'Devis refusé.'))}
            onPropose={(amount, message) =>
              run('offer', async () => {
                try {
                  await proposePrice(pendingQuote.id, amount, message);
                  toast.success('Proposition envoyée au professionnel.');
                  refresh();
                } catch (e) {
                  toast.error(errorMessage(e));
                  throw e;
                }
              })
            }
          />
          {offers.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <OfferHistory offers={offers} quotes={quotes} viewer="client" />
            </div>
          )}
        </Card>
      )}

      {/* Devis validé */}
      {acceptedQuote && !pendingQuote && !['paid', 'closed'].includes(request.status) && (
        <Card>
          <p className="mb-3 font-bold">{acceptedQuote.offer_id ? 'Prix négocié validé' : 'Devis validé'}</p>
          <QuoteBreakdown quote={acceptedQuote} />
          {offers.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <OfferHistory offers={offers} quotes={quotes} viewer="client" />
            </div>
          )}
        </Card>
      )}

      {/* Confirmation fin + paiement */}
      {request.status === 'completed' && (
        <Card className="border-emerald-500/40">
          <p className="font-bold">Confirmer la fin de l’intervention</p>
          {payment?.status === 'declared' ? (
            <>
              <p className="mt-2 text-sm text-silver-300">
                Le professionnel déclare avoir reçu <strong className="text-white">{formatFCFA(payment.amount)}</strong> ({paymentMethodLabel(payment.method)}).
                Confirmez si la réparation est faite et le paiement effectué.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="danger" onClick={() => setReportOpen(true)} icon={<TriangleAlert className="h-4 w-4" />}>
                  Un problème
                </Button>
                <Button variant="success" loading={busy === 'confirm'} onClick={() => run('confirm', () => act(() => confirmPayment(request.id), 'Merci ! Votre reçu est disponible.'))}>
                  Tout est en ordre
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-silver-400">
              Réglez le montant validé ({formatFCFA(acceptedQuote?.total_amount)}) directement au professionnel. Il déclarera le paiement et vous
              pourrez le confirmer ici.
            </p>
          )}
        </Card>
      )}

      {/* Reçu & avis */}
      {(request.status === 'paid' || request.status === 'closed') && payment && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">Prestation réglée</p>
              <p className="text-sm text-silver-400">
                {formatFCFA(payment.amount)} · {paymentMethodLabel(payment.method)} · reçu {payment.receipt_number}
              </p>
            </div>
            <ButtonLink to={`/client/recus/${request.id}`} variant="secondary" size="sm" icon={<FileText className="h-4 w-4" />}>
              Reçu
            </ButtonLink>
          </div>
        </Card>
      )}
      {request.status === 'paid' && !review && <ReviewForm requestId={request.id} onDone={refresh} />}
      {review && (
        <Card>
          <p className="font-bold">Votre évaluation</p>
          <div className="mt-2">
            <Rating value={review.rating} count={1} />
          </div>
          {review.comment && <p className="mt-2 text-sm text-silver-300">« {review.comment} »</p>}
        </Card>
      )}

      {/* Suivi */}
      {!['cancelled', 'expired'].includes(request.status) && (
        <Card>
          <p className="mb-4 font-bold">Suivi</p>
          <StatusTimeline status={request.status} history={history} />
        </Card>
      )}

      {/* Détails */}
      <Card>
        <p className="mb-3 font-bold">Votre demande</p>
        <div className="space-y-3 text-sm">
          {request.symptoms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {request.symptoms.map((s) => (
                <span key={s} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-silver-200">
                  {symptomLabel(s)}
                </span>
              ))}
            </div>
          )}
          {request.description && <p className="text-silver-300">{request.description}</p>}
          <p className="text-silver-400">
            Véhicule : {vehicle ? `${vehicle.brand} ${vehicle.model}${vehicle.plate ? ` · ${vehicle.plate}` : ''}` : vehicleTypeLabel(request.vehicle_type)}
          </p>
          <a href={placeUrl(request)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-electric-300">
            <MapPin className="h-4 w-4" /> Position partagée{request.address_hint ? ` — ${request.address_hint}` : ''}
          </a>
          {(photos.data ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {photos.data!.map((src, i) => (
                <a key={src} href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-xl object-cover ring-1 ring-white/10" />
                </a>
              ))}
            </div>
          )}
          {request.cancel_reason && <p className="text-silver-400">Motif d’annulation : {request.cancel_reason}</p>}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!['cancelled', 'closed', 'expired'].includes(request.status) && (
          <Button variant="secondary" icon={<Share2 className="h-4 w-4" />} onClick={share}>
            Partager avec un proche
          </Button>
        )}
        {CLIENT_CAN_REPORT.includes(request.status) && (
          <Button variant="ghost" icon={<TriangleAlert className="h-4 w-4" />} onClick={() => setReportOpen(true)}>
            Signaler un problème
          </Button>
        )}
        {CLIENT_CAN_CANCEL.includes(request.status) && (
          <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => setCancelOpen(true)}>
            Annuler la demande
          </Button>
        )}
      </div>

      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} enRoute={request.status === 'en_route'} onConfirm={(reason) => act(() => cancelRequest(request.id, reason), 'Demande annulée.')} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} onConfirm={(msg) => act(() => reportProblem(request.id, msg), 'Signalement transmis au support.')} />
    </div>
  );
}

function ReviewForm({ requestId, onDone }: { requestId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => submitReview(requestId, rating, comment.trim() || null),
    onSuccess: () => {
      toast.success('Merci pour votre évaluation !');
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card className="border-electric-500/30">
      <p className="font-bold">Évaluez la prestation</p>
      <p className="text-sm text-silver-400">Votre avis aide les autres conducteurs et améliore le réseau.</p>
      <div className="mt-3">
        <StarInput value={rating} onChange={setRating} />
      </div>
      <Textarea wrapClassName="mt-3" placeholder="Un commentaire ? (facultatif)" maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button className="mt-3" block disabled={rating === 0} loading={m.isPending} onClick={() => m.mutate()}>
        Envoyer mon avis
      </Button>
    </Card>
  );
}

function CancelModal({ open, onClose, onConfirm, enRoute }: { open: boolean; onClose: () => void; onConfirm: (reason: string | null) => Promise<unknown>; enRoute: boolean }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Annuler la demande ?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Retour
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm(reason.trim() || null);
              setBusy(false);
              onClose();
            }}
          >
            Confirmer l’annulation
          </Button>
        </>
      }
    >
      <p className="text-sm text-silver-300">{CANCELLATION_RULE}</p>
      {enRoute && (
        <Notice tone="warning" className="mt-3" title="Le professionnel est déjà en route">
          Des frais de déplacement peuvent vous être demandés.
        </Notice>
      )}
      <Textarea wrapClassName="mt-4" label="Motif" optional value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
    </Modal>
  );
}

function ReportModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (msg: string) => Promise<unknown> }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Signaler un problème"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={msg.trim().length < 5}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm(msg.trim());
              setBusy(false);
              setMsg('');
              onClose();
            }}
          >
            Envoyer au support
          </Button>
        </>
      }
    >
      <p className="text-sm text-silver-300">
        Professionnel absent, comportement inapproprié, prix différent du devis, travail mal fait… Le support conserve le devis, les échanges et
        les horaires pour examiner la situation.
      </p>
      <Textarea wrapClassName="mt-4" label="Que s’est-il passé ?" rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} />
    </Modal>
  );
}
