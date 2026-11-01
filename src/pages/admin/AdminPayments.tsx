import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Field';
import { Badge, EmptyState, ErrorState, LoadingBlock, PageHeader, Segmented, StatCard } from '@/components/ui/Display';
import { Modal, useToast } from '@/components/ui/Overlay';
import { hasAdminLevel } from '@/components/layout/Guards';
import { listPayments, resolvePayment } from '@/services/admin.service';
import { PAYMENT_STATUS } from '@/domain/status';
import { paymentMethodLabel } from '@/domain/catalog';
import { formatFCFA } from '@/domain/pricing';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { Payment, PaymentStatus } from '@/types/database';

export default function AdminPayments() {
  const me = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<PaymentStatus | 'all'>('all');
  const q = useQuery({ queryKey: ['admin-payments', status], queryFn: () => listPayments(status) });
  const [editing, setEditing] = useState<Payment | null>(null);
  const canOperate = hasAdminLevel(me.admin_level, 'operations');

  const confirmed = (q.data ?? []).filter((p) => p.status === 'confirmed');
  const totals = {
    volume: confirmed.reduce((s, p) => s + p.amount, 0),
    commission: confirmed.reduce((s, p) => s + p.commission_amount, 0),
    pending: (q.data ?? []).filter((p) => p.status === 'declared').length,
    disputed: (q.data ?? []).filter((p) => p.status === 'disputed').length,
  };

  return (
    <>
      <PageHeader title="Paiements" subtitle="Rapprochement des paiements, commissions et litiges." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Volume confirmé" value={<span className="text-lg">{formatFCFA(totals.volume)}</span>} />
        <StatCard label="Commissions" value={<span className="text-lg">{formatFCFA(totals.commission)}</span>} />
        <StatCard label="À confirmer" value={totals.pending} tone={totals.pending ? 'warning' : 'neutral'} />
        <StatCard label="Contestés" value={totals.disputed} tone={totals.disputed ? 'danger' : 'neutral'} />
      </div>
      <Segmented
        className="mb-4"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'all', label: 'Tous' },
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
                  <td className="px-4 py-3">{paymentMethodLabel(p.method)}</td>
                  <td className="px-4 py-3 text-right">{formatFCFA(p.amount)}</td>
                  <td className="px-4 py-3 text-right">{formatFCFA(p.commission_amount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canOperate && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                        Traiter
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
