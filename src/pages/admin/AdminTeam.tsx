import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldCheck } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Avatar, Badge, Card, EmptyState, LoadingBlock, Notice, PageHeader } from '@/components/ui/Display';
import { useToast } from '@/components/ui/Overlay';
import { hasAdminLevel } from '@/components/layout/Guards';
import { listUsers, setRole } from '@/services/admin.service';
import { errorMessage } from '@/lib/errors';
import type { AdminLevel, Profile, UserRole } from '@/types/database';

const LEVELS: { value: AdminLevel; label: string; help: string }[] = [
  { value: 'support', label: 'Support', help: 'Réclamations, consultation des demandes et statistiques' },
  { value: 'operations', label: 'Opérations', help: '+ validation des pros, attribution manuelle, suspensions, paiements' },
  { value: 'super_admin', label: 'Super admin', help: '+ tarifs, paramètres et gestion de l’équipe' },
];

export default function AdminTeam() {
  const me = useProfile();
  const canEdit = hasAdminLevel(me.admin_level, 'super_admin');
  const admins = useQuery({ queryKey: ['admin-team'], queryFn: () => listUsers({ role: 'admin' }) });
  const [search, setSearch] = useState('');
  const found = useQuery({ queryKey: ['admin-user-search', search], queryFn: () => listUsers({ search }), enabled: canEdit && search.trim().length >= 3 });

  return (
    <>
      <PageHeader title="Équipe d’administration" subtitle="Niveaux d’autorisation de l’équipe SOS MOBILITÉ." />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {LEVELS.map((l) => (
          <Card key={l.value} className="p-4">
            <p className="font-semibold">{l.label}</p>
            <p className="text-sm text-silver-400">{l.help}</p>
          </Card>
        ))}
      </div>

      {admins.isLoading ? (
        <LoadingBlock />
      ) : (
        <ul className="space-y-2">
          {(admins.data ?? []).map((u) => (
            <MemberRow key={u.id} user={u} me={me.id} canEdit={canEdit} />
          ))}
        </ul>
      )}

      {canEdit ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">Ajouter ou modifier un membre</h2>
          <Notice tone="info" className="mb-3">
            La personne doit d’abord créer un compte sur l’application. Recherchez-la ici, puis attribuez-lui un niveau.
          </Notice>
          <Input placeholder="E-mail, nom ou téléphone (3 caractères minimum)" value={search} onChange={(e) => setSearch(e.target.value)} suffix={<Search className="h-4 w-4" />} />
          <ul className="mt-3 space-y-2">
            {(found.data ?? [])
              .filter((u) => u.role !== 'admin')
              .map((u) => (
                <MemberRow key={u.id} user={u} me={me.id} canEdit />
              ))}
          </ul>
          {found.data && !found.data.length && <EmptyState title="Aucun compte trouvé" />}
        </section>
      ) : (
        <Notice tone="info" className="mt-6">
          Seul un super administrateur peut modifier l’équipe.
        </Notice>
      )}
    </>
  );
}

function MemberRow({ user, me, canEdit }: { user: Profile; me: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [role, setRoleValue] = useState<UserRole>(user.role);
  const [level, setLevel] = useState<AdminLevel>(user.admin_level ?? 'support');
  const [busy, setBusy] = useState(false);
  const isMe = user.id === me;

  return (
    <li className="card flex flex-wrap items-center gap-3 p-4">
      <Avatar name={user.full_name} src={user.avatar_url} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {user.full_name || '—'} {isMe && <span className="text-xs text-silver-500">(vous)</span>}
        </p>
        <p className="truncate text-xs text-silver-400">{user.email}</p>
      </div>
      {user.role === 'admin' && (
        <Badge tone="info">
          <ShieldCheck className="h-3 w-3" /> {LEVELS.find((l) => l.value === user.admin_level)?.label}
        </Badge>
      )}
      {canEdit && !isMe && (
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Rôle" value={role} onChange={(e) => setRoleValue(e.target.value as UserRole)} className="h-9 py-1">
            <option value="client">Client</option>
            <option value="mechanic">Professionnel</option>
            <option value="admin">Administrateur</option>
          </Select>
          {role === 'admin' && (
            <Select aria-label="Niveau" value={level} onChange={(e) => setLevel(e.target.value as AdminLevel)} className="h-9 py-1">
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          )}
          <Button
            size="sm"
            loading={busy}
            disabled={role === user.role && (role !== 'admin' || level === user.admin_level)}
            onClick={async () => {
              setBusy(true);
              try {
                await setRole(user.id, role, role === 'admin' ? level : null);
                toast.success('Rôle mis à jour.');
                void qc.invalidateQueries({ queryKey: ['admin-team'] });
                void qc.invalidateQueries({ queryKey: ['admin-user-search'] });
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Appliquer
          </Button>
        </div>
      )}
    </li>
  );
}
