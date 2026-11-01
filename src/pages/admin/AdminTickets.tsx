import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Field';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Segmented } from '@/components/ui/Display';
import { Modal, useToast } from '@/components/ui/Overlay';
import { listTickets, profilesByIds, updateTicket } from '@/services/admin.service';
import { TICKET_STATUS } from '@/domain/status';
import { TICKET_CATEGORIES } from '@/domain/catalog';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { SupportTicket, TicketStatus } from '@/types/database';

export default function AdminTickets() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<TicketStatus | 'all'>('open');
  const q = useQuery({ queryKey: ['admin-tickets', status], queryFn: () => listTickets(status) });
  const authors = useQuery({
    queryKey: ['admin-ticket-authors', q.data?.map((t) => t.created_by).join(',')],
    queryFn: () => profilesByIds((q.data ?? []).map((t) => t.created_by)),
    enabled: Boolean(q.data?.length),
  });
  const [editing, setEditing] = useState<SupportTicket | null>(null);

  return (
    <>
      <PageHeader title="Réclamations" subtitle="Messages au support, litiges et signalements." />
      <Segmented
        className="mb-4"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'open', label: 'Ouvertes' },
          { value: 'in_progress', label: 'En traitement' },
          { value: 'resolved', label: 'Résolues' },
          { value: 'all', label: 'Toutes' },
        ]}
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={<MessageSquareWarning className="h-6 w-6" />} title="Aucune réclamation" />
      ) : (
        <div className="space-y-3">
          {q.data.map((t) => {
            const a = authors.data?.[t.created_by];
            return (
              <Card key={t.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{t.subject}</p>
                    <p className="text-xs text-silver-500">
                      {TICKET_CATEGORIES.find((c) => c.value === t.category)?.label} · {a ? `${a.full_name} (${a.role === 'mechanic' ? 'pro' : a.role})` : '…'}
                      {a?.phone ? ` · ${a.phone}` : ''} · {formatDateTime(t.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.category === 'litige' && <Badge tone="danger">Litige</Badge>}
                    <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-silver-300">{t.message}</p>
                {t.admin_response && <p className="mt-2 rounded-xl bg-electric-500/[0.06] p-3 text-sm text-silver-200">Réponse : {t.admin_response}</p>}
                <div className="mt-3 flex gap-2">
                  {t.request_id && (
                    <Link to={`/admin/demandes/${t.request_id}`} className="text-sm font-semibold text-electric-300">
                      Voir la demande
                    </Link>
                  )}
                  <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setEditing(t)}>
                    Répondre / traiter
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <TicketModal
        ticket={editing}
        onClose={() => setEditing(null)}
        onSubmit={async (s, r) => {
          try {
            await updateTicket(editing!.id, s, r || null);
            toast.success('Réclamation mise à jour.');
            void qc.invalidateQueries({ queryKey: ['admin-tickets'] });
            setEditing(null);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </>
  );
}

function TicketModal({ ticket, onClose, onSubmit }: { ticket: SupportTicket | null; onClose: () => void; onSubmit: (s: TicketStatus, r: string) => Promise<void> }) {
  const [status, setStatus] = useState<TicketStatus>('in_progress');
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={ticket !== null}
      onClose={onClose}
      title={ticket?.subject ?? ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit(status, response.trim());
              setBusy(false);
              setResponse('');
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Statut" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
          {(Object.keys(TICKET_STATUS) as TicketStatus[]).map((s) => (
            <option key={s} value={s}>
              {TICKET_STATUS[s].label}
            </option>
          ))}
        </Select>
        <Textarea label="Réponse à l’utilisateur" optional rows={4} value={response} onChange={(e) => setResponse(e.target.value)} />
      </div>
    </Modal>
  );
}
