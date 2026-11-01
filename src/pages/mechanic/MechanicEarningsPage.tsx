import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeDollarSign, Crown } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/queries';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, StatCard } from '@/components/ui/Display';
import { listMyPayments } from '@/services/mechanic.service';
import { numericSetting } from '@/services/catalog.service';
import { useMechanicProfile } from './useMechanic';
import { PAYMENT_STATUS } from '@/domain/status';
import { paymentMethodLabel } from '@/domain/catalog';
import { DEFAULT_COMMISSION, formatFCFA, formatRate } from '@/domain/pricing';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';

export default function MechanicEarningsPage() {
  const profile = useProfile();
  const mech = useMechanicProfile();
  const { data: settings } = useSettings();
  const q = useQuery({ queryKey: ['mechanic-payments', profile.id], queryFn: () => listMyPayments(profile.id) });

  const confirmed = (q.data ?? []).filter((p) => p.status === 'confirmed');
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
      ) : !q.data?.length ? (
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
              {q.data.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-silver-300">{formatDateTime(p.confirmed_at ?? p.declared_at)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/pro/missions/${p.request_id}`} className="font-mono text-electric-300">
                      {p.receipt_number ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-silver-300">{paymentMethodLabel(p.method)}</td>
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
