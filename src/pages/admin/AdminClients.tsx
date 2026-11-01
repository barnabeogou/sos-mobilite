import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Avatar, Badge, EmptyState, ErrorState, LoadingBlock, PageHeader } from '@/components/ui/Display';
import { useToast } from '@/components/ui/Overlay';
import { hasAdminLevel } from '@/components/layout/Guards';
import { listUsers, setSuspension } from '@/services/admin.service';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/errors';

export default function AdminClients() {
  const me = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['admin-clients', search], queryFn: () => listUsers({ role: 'client', search }) });
  const canOperate = hasAdminLevel(me.admin_level, 'operations');

  return (
    <>
      <PageHeader title="Clients" subtitle="Comptes automobilistes, motards et plaisanciers." />
      <Input wrapClassName="mb-4" placeholder="Nom, e-mail ou téléphone" value={search} onChange={(e) => setSearch(e.target.value)} suffix={<Search className="h-4 w-4" />} />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="Aucun client" />
      ) : (
        <ul className="space-y-2">
          {q.data.map((u) => (
            <li key={u.id} className="card flex items-center gap-3 p-4">
              <Avatar name={u.full_name} src={u.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{u.full_name || '—'}</p>
                <p className="truncate text-xs text-silver-400">
                  {u.email} · {u.phone ?? 'sans téléphone'} · {[u.commune, u.city].filter(Boolean).join(', ')} · depuis le {formatDate(u.created_at)}
                </p>
              </div>
              {u.is_suspended && <Badge tone="danger">Suspendu</Badge>}
              {canOperate && (
                <Button
                  size="sm"
                  variant={u.is_suspended ? 'secondary' : 'ghost'}
                  onClick={() => {
                    const reason = u.is_suspended ? 'Compte réactivé' : window.prompt('Motif de la suspension ?');
                    if (!reason) return;
                    setSuspension(u.id, !u.is_suspended, reason)
                      .then(() => {
                        toast.success(u.is_suspended ? 'Compte réactivé.' : 'Compte suspendu.');
                        void qc.invalidateQueries({ queryKey: ['admin-clients'] });
                      })
                      .catch((e) => toast.error(errorMessage(e)));
                  }}
                >
                  {u.is_suspended ? 'Réactiver' : 'Suspendre'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
