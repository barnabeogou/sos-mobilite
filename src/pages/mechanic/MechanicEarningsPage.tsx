import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeDollarSign, Crown, Wallet } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/queries';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, StatCard } from '@/components/ui/Display';
import { useRealtimeInvalidate } from '@/hooks/useRealtime';
import { listMyPayments } from '@/services/mechanic.service';
import { numericSetting } from '@/services/catalog.service';
import { commissionDue, listMyPayouts } from '@/services/payments/providers';
import { useMechanicProfile } from './useMechanic';
import { PAYMENT_STATUS } from '@/domain/status';
import { PAYOUT_STATUS, paymentMethodLabel } from '@/domain/catalog';
import { DEFAULT_COMMISSION, formatFCFA, formatRate } from '@/domain/pricing';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';

export default function MechanicEarningsPage() {
  const profile = useProfile();
  const mech = useMechanicProfile();
  const { data: settings } = useSettings();
  const q = useQuery({ queryKey: ['mechanic-payments', profile.id], queryFn: () => listMyPayments(profile.id) });
  const payouts = useQuery({ queryKey: ['my-payouts', profile.id], queryFn: () => listMyPayouts(profile.id) });
  useRealtimeInvalidate('payouts', `mechanic_id=eq.${profile.id}`, [['my-payouts', profile.id]]);
  useRealtimeInvalidate('payments', `mechanic_id=eq.${profile.id}`, [['mechanic-payments', profile.id]]);

  // Les tentatives de paiement en ligne inabouties ne concernent pas le pro.
  const payments = (q.data ?? []).filter((p) => p.status !== 'pending' && p.status !== 'failed');
  const due = commissionDue(payments);
  const waitingAmount = (payouts.data ?? []).filter((p) => ['pending', 'processing', 'failed'].includes(p.status)).reduce((s, p) => s + p.amount, 0);

  const confirmed = payments.filter((p) => p.status === 'confirmed');
  const gross = confirmed.reduce((s, p) => s + p.amount, 0);
  const commission = confirmed.reduce((s, p) => s + p.commission_amount, 0);
  const net = confirmed.reduce((s, p) => s + p.mechanic_net, 0);
  const starter = numericSetting(settings, 'commission_rate_starter', DEFAULT_COMMISSION.starter);
  const pro = numericSetting(settings, 'commission_rate_pro', DEFAULT_COMMISSION.pro);
  const proFee = numericSetting(settings, 'pro_plan_monthly_fee', 10000);
  const plan = mech.data?.plan ?? 'starter';

  return (
    <>
      <PageHeader title="Mes gains" subtitle="Interventions payées et commission de la plateforme." />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Encaissé" value={<span className="text-lg">{formatFCFA(gross)}</span>} hint={`${confirmed.length} intervention(s)`} />
        <StatCard label="Commission" value={<span className="text-lg">{formatFCFA(commission)}</span>} />
        <StatCard label="Net" value={<span className="text-lg">{formatFCFA(net)}</span>} />
        <StatCard label="Formule" value={plan === 'pro' ? 'Pro' : 'Starter'} hint={`Commission ${formatRate(plan === 'pro' ? pro : starter)}`} icon={<Crown className="h-4 w-4" />} />
      </div>

      {due.amount > 0 && (
        <Notice tone="warning" className="mb-6" title={`Commission due : ${formatFCFA(due.amount)}`}>
          Sur {due.count} paiement(s) reçu(s) directement (espèces ou transfert). Elle est déduite automatiquement de vos prochains versements dans
          l’application, ou réglable auprès du support.
        </Notice>
      )}

      <Card className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-bold">
            <Wallet className="h-5 w-5 text-electric-300" /> Mes versements
          </p>
          {waitingAmount > 0 && <span className="text-sm text-silver-400">En cours : {formatFCFA(waitingAmount)}</span>}
        </div>
        {mech.data && (!mech.data.payout_method || !mech.data.payout_phone) && (
          <p className="mt-2 text-sm text-amber-300">
            Renseignez votre compte Mobile Money dans{' '}
            <Link to="/pro/profil" className="underline">
              votre profil
            </Link>{' '}
            pour recevoir vos versements.
          </p>
        )}
        {payouts.isLoading ? (
          <LoadingBlock />
        ) : !payouts.data?.length ? (
          <p className="mt-3 text-sm text-silver-500">Les paiements faits dans l’application vous sont versés ici automatiquement.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {payouts.data.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{formatFCFA(p.amount)}</p>
                  <p className="text-xs text-silver-500">
                    {formatDateTime(p.sent_at ?? p.created_at)}
                    {p.method ? ` · ${paymentMethodLabel(p.method)}` : ''}
                    {p.phone && (
                      <>
                        {' · '}
                        <span className="whitespace-nowrap">{p.phone}</span>
                      </>
                    )}
                    {p.deducted_commissions > 0 ? ` · commissions déduites ${formatFCFA(p.deducted_commissions)}` : ''}
                  </p>
                  {p.failure_reason && p.status !== 'sent' && p.failure_reason !== 'PAYOUT_ACCOUNT_MISSING' && <p className="text-xs text-amber-300">{p.failure_reason}</p>}
                </div>
                <Badge tone={PAYOUT_STATUS[p.status].tone} dot>
                  {PAYOUT_STATUS[p.status].label}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <p className="font-bold">Formules professionnelles</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-4">
            <p className="font-semibold">Garage Starter</p>
            <p className="text-sm text-silver-400">0 FCFA / mois · commission {formatRate(starter)} sur les interventions terminées.</p>
          </div>
          <div className="rounded-xl border border-electric-500/30 bg-electric-500/[0.06] p-4">
            <p className="font-semibold">Garage Pro</p>
            <p className="text-sm text-silver-400">
              {formatFCFA(proFee)} / mois · commission {formatRate(pro)}. Avantages (visibilité, statistiques) en cours de définition.
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-silver-500">
          Pour passer en formule Pro, <Link to="/pro/support" className="text-electric-300">contactez le support</Link>. L’abonnement est facturé à l’avance, sans
          prélèvement automatique.
        </p>
      </Card>

      {q.isLoading || mech.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !payments.length ? (
        <EmptyState icon={<BadgeDollarSign className="h-6 w-6" />} title="Aucun paiement pour l’instant" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-silver-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Reçu</th>
                <th className="px-4 py-3 font-medium">Moyen</th>
                <th className="px-4 py-3 text-right font-medium">Montant</th>
                <th className="px-4 py-3 text-right font-medium">Net</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-silver-300">{formatDateTime(p.confirmed_at ?? p.declared_at)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/pro/missions/${p.request_id}`} className="font-mono text-electric-300">
                      {p.receipt_number ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-silver-300">
                    {paymentMethodLabel(p.method)}
                    <span className="block text-xs text-silver-500">{p.channel === 'online' ? 'Dans l’application' : 'Direct'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatFCFA(p.amount)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatFCFA(p.mechanic_net)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
