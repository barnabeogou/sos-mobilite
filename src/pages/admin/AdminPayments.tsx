import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, RefreshCw, Wallet } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/queries';
import { useRealtimeInvalidate } from '@/hooks/useRealtime';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Field';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Segmented, StatCard } from '@/components/ui/Display';
import { Modal, useToast } from '@/components/ui/Overlay';
import { hasAdminLevel } from '@/components/layout/Guards';
import { listPayments, resolvePayment } from '@/services/admin.service';
import {
  adminSetPayoutStatus,
  adminSettleCommission,
  listPayouts,
  onlinePaymentEnabled,
  providerStatus,
  retryPayout,
  verifyOnlinePayment,
} from '@/services/payments/providers';
import { PAYMENT_STATUS } from '@/domain/status';
import { PAYOUT_STATUS, paymentMethodLabel } from '@/domain/catalog';
import { formatFCFA } from '@/domain/pricing';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { Payment, PaymentStatus, Payout } from '@/types/database';

export default function AdminPayments() {
  const me = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<PaymentStatus | 'all'>('all');
  const q = useQuery({ queryKey: ['admin-payments', status], queryFn: () => listPayments(status) });
  const [editing, setEditing] = useState<Payment | null>(null);
  const [settling, setSettling] = useState<Payment | null>(null);
  const [view, setView] = useState<'payments' | 'payouts'>('payments');
  const [busy, setBusy] = useState<string | null>(null);
  const canOperate = hasAdminLevel(me.admin_level, 'operations');
  const { data: settings } = useSettings();
  const server = useQuery({ queryKey: ['payment-provider-status'], queryFn: providerStatus, staleTime: 5 * 60_000 });
  const payouts = useQuery({ queryKey: ['admin-payouts'], queryFn: listPayouts });
  useRealtimeInvalidate('payments', undefined, [['admin-payments']]);
  useRealtimeInvalidate('payouts', undefined, [['admin-payouts']]);

  const run = async (name: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(name);
    try {
      await fn();
      toast.success(ok);
      void qc.invalidateQueries({ queryKey: ['admin-payments'] });
      void qc.invalidateQueries({ queryKey: ['admin-payouts'] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const confirmed = (q.data ?? []).filter((p) => p.status === 'confirmed');
  const totals = {
    volume: confirmed.reduce((s, p) => s + p.amount, 0),
    commission: confirmed.reduce((s, p) => s + p.commission_amount, 0),
    pending: (q.data ?? []).filter((p) => p.status === 'declared').length,
    disputed: (q.data ?? []).filter((p) => p.status === 'disputed').length,
    commissionDue: (q.data ?? [])
      .filter((p) => p.channel === 'direct' && p.status === 'confirmed' && !p.commission_settled_at)
      .reduce((s, p) => s + p.commission_amount, 0),
  };
  const payoutsToHandle = (payouts.data ?? []).filter((p) => p.status === 'pending' || p.status === 'failed');

  return (
    <>
      <PageHeader title="Paiements" subtitle="Paiements dans l’application, versements aux professionnels, commissions et litiges." />

      {!server.isLoading && <ProviderCard enabled={onlinePaymentEnabled(settings)} server={server.data ?? null} />}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Volume confirmé" value={<span className="text-lg">{formatFCFA(totals.volume)}</span>} />
        <StatCard
          label="Commissions"
          value={<span className="text-lg">{formatFCFA(totals.commission)}</span>}
          hint={totals.commissionDue ? `dont ${formatFCFA(totals.commissionDue)} à encaisser` : undefined}
        />
        <StatCard label="À confirmer" value={totals.pending} tone={totals.pending ? 'warning' : 'neutral'} hint={totals.disputed ? `${totals.disputed} contesté(s)` : undefined} />
        <StatCard label="Versements à traiter" value={payoutsToHandle.length} tone={payoutsToHandle.length ? 'warning' : 'neutral'} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <Segmented
        className="mb-4"
        value={view}
        onChange={setView}
        options={[
          { value: 'payments', label: 'Paiements' },
          { value: 'payouts', label: `Versements${payoutsToHandle.length ? ` (${payoutsToHandle.length})` : ''}` },
        ]}
      />

      {view === 'payouts' ? (
        <PayoutsTable
          payouts={payouts.data}
          loading={payouts.isLoading}
          error={payouts.isError ? errorMessage(payouts.error) : null}
          canOperate={canOperate}
          automatic={Boolean(server.data?.automatic_payouts)}
          busy={busy}
          onRetry={(p) => run(`retry-${p.id}`, () => retryPayout(p.id), 'Versement relancé.')}
          onSet={(p, st, note) => run(`set-${p.id}`, () => adminSetPayoutStatus(p.id, st, note), 'Versement mis à jour.')}
        />
      ) : (
      <>
      <Segmented
        className="mb-4"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'all', label: 'Tous' },
          { value: 'pending', label: 'En ligne en cours' },
          { value: 'declared', label: 'Déclarés' },
          { value: 'confirmed', label: 'Confirmés' },
          { value: 'disputed', label: 'Contestés' },
          { value: 'refunded', label: 'Remboursés' },
        ]}
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={<BadgeDollarSign className="h-6 w-6" />} title="Aucun paiement" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-silver-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Reçu</th>
                <th className="px-4 py-3 font-medium">Moyen</th>
                <th className="px-4 py-3 text-right font-medium">Montant</th>
                <th className="px-4 py-3 text-right font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {q.data.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-silver-300">{formatDateTime(p.declared_at)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/demandes/${p.request_id}`} className="font-mono text-electric-300">
                      {p.receipt_number ?? 'voir la demande'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {paymentMethodLabel(p.method)}
                    <span className="block text-xs text-silver-500">
                      {p.channel === 'online' ? 'Dans l’application' : 'Direct'}
                      {p.channel === 'direct' && p.status === 'confirmed' && p.commission_amount > 0 ? (p.commission_settled_at ? ' · commission réglée' : ' · commission due') : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatFCFA(p.amount)}</td>
                  <td className="px-4 py-3 text-right">{formatFCFA(p.commission_amount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                    {p.failure_reason && p.status === 'failed' && <span className="mt-1 block max-w-[220px] text-xs text-silver-500">{p.failure_reason}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {p.channel === 'online' && (p.status === 'pending' || p.status === 'failed') ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<RefreshCw className="h-4 w-4" />}
                        loading={busy === `verify-${p.id}`}
                        onClick={() => run(`verify-${p.id}`, () => verifyOnlinePayment(p.id), 'Statut vérifié auprès du prestataire.')}
                      >
                        Vérifier
                      </Button>
                    ) : (
                      canOperate && (
                        <>
                          {p.channel === 'direct' && p.status === 'confirmed' && !p.commission_settled_at && p.commission_amount > 0 && (
                            <Button size="sm" variant="ghost" onClick={() => setSettling(p)}>
                              Commission reçue
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                            Traiter
                          </Button>
                        </>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}
      <NoteModal
        open={settling !== null}
        title="Commission reçue"
        intro={settling ? `Le professionnel a réglé la commission de ${formatFCFA(settling.commission_amount)} (paiement direct). Indiquez comment.` : ''}
        label="Moyen et référence (obligatoire)"
        onClose={() => setSettling(null)}
        onSubmit={async (note) => {
          await run(`settle-${settling!.id}`, () => adminSettleCommission(settling!.id, note), 'Commission enregistrée comme réglée.');
          setSettling(null);
        }}
      />
      <ResolveModal
        payment={editing}
        onClose={() => setEditing(null)}
        onSubmit={async (s, note) => {
          try {
            await resolvePayment(editing!.id, s, note);
            toast.success('Paiement mis à jour.');
            void qc.invalidateQueries({ queryKey: ['admin-payments'] });
            setEditing(null);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </>
  );
}

function ResolveModal({ payment, onClose, onSubmit }: { payment: Payment | null; onClose: () => void; onSubmit: (s: PaymentStatus, note: string) => Promise<void> }) {
  const [status, setStatus] = useState<PaymentStatus>('confirmed');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={payment !== null}
      onClose={onClose}
      title="Traiter le paiement"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={note.trim().length < 3}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit(status, note.trim());
              setBusy(false);
              setNote('');
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-silver-300">
        Ne confirmez un paiement que sur la base d’un élément vérifiable (accord des deux parties, relevé du prestataire), jamais sur une simple capture
        d’écran.
      </p>
      <div className="space-y-4">
        <Select label="Statut" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
          <option value="confirmed">Confirmé</option>
          <option value="disputed">Contesté</option>
          <option value="refunded">Remboursé</option>
          <option value="declared">Déclaré (en attente)</option>
        </Select>
        <Textarea label="Motif / justificatif (obligatoire)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

function ProviderCard({ enabled, server }: { enabled: boolean; server: { online_payment: boolean; automatic_payouts: boolean; notify_token_check: boolean } | null }) {
  const configured = Boolean(server?.online_payment);
  const ok = enabled && configured;
  const Item = ({ done, children }: { done: boolean; children: string }) => (
    <li className={done ? 'text-silver-200' : 'text-silver-500'}>
      <span className={done ? 'text-emerald-400' : 'text-silver-600'}>{done ? '✓' : '○'}</span> {children}
    </li>
  );
  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold">Paiement dans l’application</p>
        <Badge tone={ok ? 'success' : 'warning'} dot>
          {ok ? 'Actif' : 'Inactif'}
        </Badge>
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
        <Item done={configured}>Clés du prestataire (CinetPay) configurées</Item>
        <Item done={enabled}>Activé dans les paramètres (« online_payment_provider »)</Item>
        <Item done={Boolean(server?.automatic_payouts)}>Versements automatiques (API de transfert)</Item>
        <Item done={Boolean(server?.notify_token_check)}>Signature des notifications vérifiée</Item>
      </ul>
      {!ok && (
        <Notice tone="info" className="mt-3">
          Tant que le paiement en ligne est inactif, les clients règlent directement le professionnel, qui déclare le paiement.
        </Notice>
      )}
      {ok && !server?.automatic_payouts && (
        <Notice tone="warning" className="mt-3">
          Versements automatiques inactifs : envoyez les versements depuis votre compte CinetPay, puis marquez-les « Versé ».
        </Notice>
      )}
    </Card>
  );
}

function PayoutsTable({
  payouts,
  loading,
  error,
  canOperate,
  automatic,
  busy,
  onRetry,
  onSet,
}: {
  payouts: Payout[] | undefined;
  loading: boolean;
  error: string | null;
  canOperate: boolean;
  automatic: boolean;
  busy: string | null;
  onRetry: (p: Payout) => Promise<void>;
  onSet: (p: Payout, s: 'sent' | 'cancelled' | 'pending', note: string) => Promise<void>;
}) {
  const [action, setAction] = useState<{ payout: Payout; status: 'sent' | 'cancelled' } | null>(null);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorState message={error} />;
  if (!payouts?.length)
    return (
      <EmptyState icon={<Wallet className="h-6 w-6" />} title="Aucun versement">
        Un versement est créé à chaque paiement fait dans l’application.
      </EmptyState>
    );
  return (
    <>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-silver-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Compte</th>
              <th className="px-4 py-3 text-right font-medium">Part du pro</th>
              <th className="px-4 py-3 text-right font-medium">Déductions</th>
              <th className="px-4 py-3 text-right font-medium">À verser</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {payouts.map((p) => {
              const open = p.status === 'pending' || p.status === 'failed';
              const reason = p.failure_reason === 'PAYOUT_ACCOUNT_MISSING' ? 'Compte de versement non renseigné' : (p.failure_reason ?? p.note);
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-silver-300">{formatDateTime(p.sent_at ?? p.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/professionnels/${p.mechanic_id}`} className="text-electric-300">
                      {p.phone ?? 'Compte manquant'}
                    </Link>
                    <span className="block text-xs text-silver-500">{p.method ? paymentMethodLabel(p.method) : '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatFCFA(p.gross_amount)}</td>
                  <td className="px-4 py-3 text-right text-silver-400">
                    {p.deducted_commissions + p.rounding_amount > 0 ? `− ${formatFCFA(p.deducted_commissions + p.rounding_amount)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatFCFA(p.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Badge>
                    {reason && <span className="mt-1 block max-w-[220px] text-xs text-silver-500">{reason}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {canOperate && open && automatic && (
                      <Button size="sm" variant="ghost" icon={<RefreshCw className="h-4 w-4" />} loading={busy === `retry-${p.id}`} onClick={() => onRetry(p)}>
                        Relancer
                      </Button>
                    )}
                    {canOperate && (open || p.status === 'processing') && (
                      <Button size="sm" variant="ghost" onClick={() => setAction({ payout: p, status: 'sent' })}>
                        Marquer versé
                      </Button>
                    )}
                    {canOperate && open && (
                      <Button size="sm" variant="ghost" onClick={() => setAction({ payout: p, status: 'cancelled' })}>
                        Annuler
                      </Button>
                    )}
                    {canOperate && p.status === 'cancelled' && (
                      <Button size="sm" variant="ghost" loading={busy === `set-${p.id}`} onClick={() => void onSet(p, 'pending', 'Réouverture du versement')}>
                        Rouvrir
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <NoteModal
        open={action !== null}
        title={action?.status === 'sent' ? 'Versement effectué' : 'Annuler le versement'}
        intro={
          action?.status === 'sent'
            ? `Confirmez que ${formatFCFA(action.payout.amount)} ont bien été envoyés au professionnel en dehors de l’application.`
            : 'Le versement ne sera pas envoyé. À utiliser en cas de remboursement du client ou d’erreur.'
        }
        label={action?.status === 'sent' ? 'Référence du transfert (obligatoire)' : 'Motif (obligatoire)'}
        onClose={() => setAction(null)}
        onSubmit={async (note) => {
          await onSet(action!.payout, action!.status, note);
          setAction(null);
        }}
      />
    </>
  );
}

function NoteModal({
  open,
  title,
  intro,
  label,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  intro: string;
  label: string;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
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
            disabled={note.trim().length < 3}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit(note.trim());
              setBusy(false);
              setNote('');
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-silver-300">{intro}</p>
      <Textarea label={label} value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  );
}
