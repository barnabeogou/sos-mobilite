import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ArrowLeft, CheckCircle2, FileText, KeyRound, MapPin, MessageCircle, Navigation, Phone, TriangleAlert, Undo2 } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useCategories, useSettings } from '@/hooks/queries';
import { useRealtimeInvalidate } from '@/hooks/useRealtime';
import { AnchorButton, Button, ButtonLink } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Avatar, Card, ErrorState, LoadingBlock, Notice, Rating } from '@/components/ui/Display';
import { Modal, useToast } from '@/components/ui/Overlay';
import { NamedIcon } from '@/components/ui/Icon';
import { QuoteBreakdown, StatusBadge, StatusTimeline } from '@/components/requests/RequestParts';
import { getRequestDetail, reportProblem, requestPhotoUrls } from '@/services/requests.service';
import {
  completeMission,
  declarePayment,
  startRoute,
  submitQuote,
  verifyArrivalCode,
  withdrawFromRequest,
} from '@/services/mechanic.service';
import { useMechanicProfile } from './useMechanic';
import { numericSetting } from '@/services/catalog.service';
import { directionsUrl } from '@/services/maps/maps';
import { quoteSchema } from '@/domain/validation';
import { MECHANIC_CAN_QUOTE, MECHANIC_CAN_WITHDRAW, REQUEST_STATUS } from '@/domain/status';
import { PAYMENT_METHODS, paymentMethodLabel, symptomLabel, vehicleTypeLabel } from '@/domain/catalog';
import { DEFAULT_COMMISSION, commissionSplit, formatFCFA, formatRate, quoteTotal } from '@/domain/pricing';
import { formatDateTime, telHref, whatsappHref } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { PaymentMethod } from '@/types/database';

type QuoteForm = z.infer<typeof quoteSchema>;

export default function MissionDetailPage() {
  const { id = '' } = useParams();
  const profile = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: categories } = useCategories();
  const { data: settings } = useSettings();
  const mech = useMechanicProfile();
  const key = ['request', id];
  const detail = useQuery({ queryKey: key, queryFn: () => getRequestDetail(id), refetchInterval: 30_000 });
  useRealtimeInvalidate('service_requests', `id=eq.${id}`, [key, ['missions', profile.id]]);
  useRealtimeInvalidate('quotes', `request_id=eq.${id}`, [key]);
  useRealtimeInvalidate('payments', `request_id=eq.${id}`, [key]);
  const photos = useQuery({
    queryKey: ['request-photos', id],
    queryFn: () => requestPhotoUrls(detail.data!.request.photos),
    enabled: Boolean(detail.data?.request.photos.length),
    staleTime: 8 * 60_000,
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [supplementOpen, setSupplementOpen] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['missions', profile.id] });
  };
  const run = async (name: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(name);
    try {
      await fn();
      if (ok) toast.success(ok);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (detail.isLoading) return <LoadingBlock />;
  if (detail.isError || !detail.data) return <ErrorState message={errorMessage(detail.error)} onRetry={() => detail.refetch()} />;

  const { request, quotes, payment, review, history, client, vehicle } = detail.data;
  const category = categories?.find((c) => c.id === request.category_id);
  const pendingQuote = quotes.find((q) => q.status === 'proposed');
  const acceptedQuote = quotes.find((q) => q.status === 'accepted');
  const rejectedLast = quotes[0]?.status === 'rejected';
  const plan = mech.data?.plan ?? 'starter';
  const rate = numericSetting(settings, plan === 'pro' ? 'commission_rate_pro' : 'commission_rate_starter', DEFAULT_COMMISSION[plan]);
  const s = request.status;
  const showContact = !['cancelled', 'closed'].includes(s);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/pro/missions" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-night-850" aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-bold leading-tight sm:text-xl">
            <NamedIcon name={category?.icon ?? 'wrench'} className="h-5 w-5 text-electric-300" />
            {category?.name ?? 'Mission'}
          </h1>
          <p className="text-xs text-silver-500">
            {request.reference} · {formatDateTime(request.created_at)}
          </p>
          <div className="mt-1.5 sm:hidden">
            <StatusBadge status={s} />
          </div>
        </div>
        <div className="hidden sm:block">
          <StatusBadge status={s} />
        </div>
      </div>

      <Notice tone={REQUEST_STATUS[s].tone}>{REQUEST_STATUS[s].mechanic}</Notice>

      {/* Client & lieu */}
      {client && (
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={client.full_name} src={client.avatar_url} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{client.full_name}</p>
              <p className="text-sm text-silver-400">{client.phone ?? 'Téléphone non renseigné'}</p>
            </div>
            {showContact && client.phone && (
              <div className="flex gap-2">
                <a href={telHref(client.phone)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-night-800" aria-label="Appeler le client">
                  <Phone className="h-5 w-5" />
                </a>
                <a
                  href={whatsappHref(client.phone, `Bonjour, je suis le professionnel SOS MOBILITÉ pour votre demande ${request.reference}.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-night-800"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2 border-t border-white/5 pt-4 text-sm">
            <p className="flex items-start gap-2 text-silver-300">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-electric-300" />
              <span>
                {request.lat.toFixed(5)}, {request.lng.toFixed(5)}
                {request.location_accuracy_m ? ` (± ${request.location_accuracy_m} m)` : ''}
                {request.address_hint && <span className="block text-silver-400">Repère : {request.address_hint}</span>}
              </span>
            </p>
            {showContact && (
              <AnchorButton href={directionsUrl(request)} target="_blank" rel="noreferrer" icon={<Navigation className="h-4 w-4" />} size="sm">
                Itinéraire
              </AnchorButton>
            )}
          </div>
        </Card>
      )}

      {/* Panne */}
      <Card>
        <p className="mb-3 font-bold">Panne signalée</p>
        <div className="space-y-3 text-sm">
          <p className="text-silver-300">
            {vehicle ? `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}${vehicle.plate ? ` · ${vehicle.plate}` : ''}${vehicle.color ? ` · ${vehicle.color}` : ''}` : vehicleTypeLabel(request.vehicle_type)}
          </p>
          {request.symptoms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {request.symptoms.map((x) => (
                <span key={x} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-silver-200">
                  {symptomLabel(x)}
                </span>
              ))}
            </div>
          )}
          {request.description && <p className="text-silver-300">{request.description}</p>}
          {(photos.data ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.data!.map((src, i) => (
                <a key={src} href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-xl object-cover ring-1 ring-white/10" />
                </a>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Devis */}
      {(s === 'accepted' || (s === 'quoted' && !pendingQuote)) && (
        <QuoteFormCard
          title={rejectedLast ? 'Le client a refusé le devis — proposer un nouveau montant' : 'Envoyer le devis'}
          rate={rate}
          busy={busy === 'quote'}
          onSubmit={(v) => run('quote', () => submitQuote({ requestId: request.id, ...v }), 'Devis envoyé au client.')}
        />
      )}
      {pendingQuote && (
        <Card className="border-amber-500/30">
          <p className="mb-3 font-bold">{s === 'in_progress' ? 'Supplément en attente de validation' : 'Devis envoyé — en attente du client'}</p>
          <QuoteBreakdown quote={pendingQuote} />
        </Card>
      )}
      {acceptedQuote && !pendingQuote && (
        <Card>
          <p className="mb-3 font-bold">Devis validé par le client</p>
          <QuoteBreakdown quote={acceptedQuote} />
        </Card>
      )}

      {/* Étapes */}
      {s === 'quote_accepted' && (
        <Button block size="lg" loading={busy === 'route'} icon={<Navigation className="h-5 w-5" />} onClick={() => run('route', () => startRoute(request.id), 'Le client est prévenu que vous êtes en route.')}>
          Je pars chez le client
        </Button>
      )}

      {s === 'en_route' && (
        <Card className="border-electric-500/40">
          <div className="flex items-center gap-3">
            <KeyRound className="h-6 w-6 text-electric-300" />
            <p className="font-bold">Arrivé sur place ?</p>
          </div>
          <p className="mt-1 text-sm text-silver-400">Demandez au client son code de confirmation à 4 chiffres et saisissez-le pour démarrer l’intervention.</p>
          <div className="mt-4 flex gap-2">
            <Input
              aria-label="Code d’arrivée"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              placeholder="• • • •"
              className="text-center font-display text-2xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              wrapClassName="flex-1"
            />
            <Button
              size="lg"
              disabled={code.length !== 4}
              loading={busy === 'code'}
              onClick={async () => {
                setBusy('code');
                try {
                  const ok = await verifyArrivalCode(request.id, code);
                  if (ok) {
                    setCode('');
                    toast.success('Arrivée confirmée. Bonne intervention !');
                    refresh();
                  } else {
                    toast.error('Code incorrect. Vérifiez avec le client (5 essais maximum).');
                  }
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(null);
                }
              }}
            >
              Valider
            </Button>
          </div>
        </Card>
      )}

      {s === 'in_progress' && (
        <Card>
          <p className="font-bold">Intervention en cours</p>
          <p className="mt-1 text-sm text-silver-400">Un travail supplémentaire est nécessaire ? Envoyez un devis complémentaire : le client doit l’accepter avant que vous le réalisiez.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => setSupplementOpen(true)} disabled={Boolean(pendingQuote)}>
              Devis complémentaire
            </Button>
            <Button
              variant="success"
              icon={<CheckCircle2 className="h-5 w-5" />}
              disabled={Boolean(pendingQuote)}
              loading={busy === 'complete'}
              onClick={() => run('complete', () => completeMission(request.id, null), 'Mission terminée. Déclarez le paiement reçu.')}
            >
              Terminer la mission
            </Button>
          </div>
        </Card>
      )}

      {s === 'completed' && acceptedQuote && (
        <Card className="border-emerald-500/40">
          <p className="font-bold">Paiement</p>
          {payment?.status === 'declared' ? (
            <p className="mt-1 text-sm text-silver-300">
              Vous avez déclaré {formatFCFA(payment.amount)} reçus ({paymentMethodLabel(payment.method)}). En attente de la confirmation du client.
            </p>
          ) : (
            <p className="mt-1 text-sm text-silver-400">Montant à encaisser : {formatFCFA(acceptedQuote.total_amount)} (devis validé). Le client confirmera ensuite.</p>
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} aria-label="Moyen de paiement" wrapClassName="flex-1">
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Button loading={busy === 'pay'} onClick={() => run('pay', () => declarePayment(request.id, method), 'Paiement déclaré.')}>
              {payment?.status === 'declared' ? 'Corriger le moyen' : 'J’ai reçu le paiement'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-silver-500">
            Commission plateforme {formatRate(rate)} : {formatFCFA(commissionSplit(acceptedQuote.total_amount, rate).commission)} · Votre part :{' '}
            {formatFCFA(commissionSplit(acceptedQuote.total_amount, rate).net)}. Paiement en ligne via l’application : bientôt disponible.
          </p>
        </Card>
      )}

      {(s === 'paid' || s === 'closed') && payment && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">Paiement confirmé</p>
              <p className="text-sm text-silver-400">
                {formatFCFA(payment.amount)} · net {formatFCFA(payment.mechanic_net)} · {payment.receipt_number}
              </p>
            </div>
            <ButtonLink to={`/pro/recus/${request.id}`} variant="secondary" size="sm" icon={<FileText className="h-4 w-4" />}>
              Reçu
            </ButtonLink>
          </div>
          {review && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <Rating value={review.rating} count={1} />
              {review.comment && <p className="mt-1 text-sm text-silver-300">« {review.comment} »</p>}
            </div>
          )}
        </Card>
      )}

      {!['cancelled', 'expired'].includes(s) && (
        <Card>
          <p className="mb-4 font-bold">Suivi</p>
          <StatusTimeline status={s} history={history} />
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {MECHANIC_CAN_WITHDRAW.includes(s) && (
          <Button variant="ghost" icon={<Undo2 className="h-4 w-4" />} onClick={() => setWithdrawOpen(true)}>
            Me désister
          </Button>
        )}
        {['en_route', 'in_progress', 'completed'].includes(s) && (
          <Button variant="danger" icon={<TriangleAlert className="h-4 w-4" />} onClick={() => setReportOpen(true)}>
            Signaler un problème
          </Button>
        )}
      </div>

      <Modal open={supplementOpen && MECHANIC_CAN_QUOTE.includes(s)} onClose={() => setSupplementOpen(false)} title="Devis complémentaire">
        <QuoteFormCard
          embedded
          title=""
          rate={rate}
          defaults={acceptedQuote ? { labor: acceptedQuote.labor_amount, parts: acceptedQuote.parts_amount, travel: acceptedQuote.travel_amount } : undefined}
          busy={busy === 'quote'}
          onSubmit={(v) =>
            run('quote', () => submitQuote({ requestId: request.id, ...v }), 'Supplément envoyé au client.').then(() => setSupplementOpen(false))
          }
        />
      </Modal>
      <ReasonModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Se désister de la mission ?"
        description="La demande sera relancée auprès d’autres professionnels. Des désistements répétés peuvent entraîner une suspension."
        confirmLabel="Confirmer le désistement"
        onConfirm={(r) => run('withdraw', () => withdrawFromRequest(request.id, r || null), 'Vous vous êtes désisté.')}
      />
      <ReasonModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Signaler un problème"
        description="Client absent, désaccord sur le prix, situation dangereuse… Le support examinera la situation."
        confirmLabel="Envoyer au support"
        required
        onConfirm={(r) => run('report', () => reportProblem(request.id, r), 'Signalement transmis au support.')}
      />
    </div>
  );
}

function QuoteFormCard({
  title,
  rate,
  busy,
  onSubmit,
  defaults,
  embedded,
}: {
  title: string;
  rate: number;
  busy: boolean;
  onSubmit: (v: { labor: number; parts: number; travel: number; etaMinutes: number | null; notes: string | null }) => void;
  defaults?: { labor: number; parts: number; travel: number };
  embedded?: boolean;
}) {
  const { register, handleSubmit, watch, formState } = useForm<QuoteForm>({
    resolver: zodResolver(quoteSchema),
    defaultValues: { labor: defaults?.labor ?? 0, parts: defaults?.parts ?? 0, travel: defaults?.travel ?? 0, eta_minutes: '', notes: '' },
  });
  const total = quoteTotal({ labor: Number(watch('labor')) || 0, parts: Number(watch('parts')) || 0, travel: Number(watch('travel')) || 0 });
  const split = commissionSplit(total, rate);

  const form = (
    <form
      onSubmit={handleSubmit((v) =>
        onSubmit({
          labor: v.labor,
          parts: v.parts,
          travel: v.travel,
          etaMinutes: v.eta_minutes === '' || v.eta_minutes === undefined ? null : Number(v.eta_minutes),
          notes: v.notes?.trim() || null,
        }),
      )}
      className="space-y-4"
    >
      {title && <p className="font-bold">{title}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Diagnostic & main-d’œuvre" inputMode="numeric" suffix="FCFA" {...register('labor')} error={formState.errors.labor?.message} />
        <Input label="Pièces" inputMode="numeric" suffix="FCFA" {...register('parts')} error={formState.errors.parts?.message} />
        <Input label="Déplacement" inputMode="numeric" suffix="FCFA" {...register('travel')} error={formState.errors.travel?.message} />
      </div>
      <Input label="Délai d’arrivée estimé" optional inputMode="numeric" suffix="min" {...register('eta_minutes')} wrapClassName="sm:max-w-xs" />
      <Textarea label="Précisions pour le client" optional rows={2} placeholder="Ex. : batterie 60 Ah fournie, pose comprise." {...register('notes')} />
      <div className="flex items-baseline justify-between rounded-xl bg-night-950/50 p-3">
        <span className="text-sm text-silver-400">Total proposé</span>
        <span className="font-display text-xl font-bold">{formatFCFA(total)}</span>
      </div>
      <p className="text-xs text-silver-500">
        Commission {formatRate(rate)} : {formatFCFA(split.commission)} · votre part : {formatFCFA(split.net)}. Le montant final encaissé sera
        celui-ci, sauf supplément accepté par le client.
      </p>
      <Button type="submit" block loading={busy} disabled={total <= 0}>
        Envoyer le devis
      </Button>
    </form>
  );
  return embedded ? form : <Card className="border-electric-500/30">{form}</Card>;
}

function ReasonModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  required,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<unknown>;
  required?: boolean;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={required && reason.trim().length < 5}
            onClick={async () => {
              setBusy(true);
              await onConfirm(reason.trim());
              setBusy(false);
              setReason('');
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-silver-300">{description}</p>
      <Textarea wrapClassName="mt-4" label="Motif" optional={!required} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
    </Modal>
  );
}
