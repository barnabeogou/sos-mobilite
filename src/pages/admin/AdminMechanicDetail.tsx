import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ExternalLink, ShieldOff, X } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Field';
import { Badge, Card, DefinitionList, ErrorState, LoadingBlock, Notice } from '@/components/ui/Display';
import { Modal, useToast } from '@/components/ui/Overlay';
import { hasAdminLevel } from '@/components/layout/Guards';
import {
  listMechanicDocuments,
  listMechanics,
  mechanicSpecialties,
  reviewDocument,
  setMechanicPlan,
  setSuspension,
  verifyMechanic,
} from '@/services/admin.service';
import { documentUrl } from '@/services/mechanic.service';
import { placeUrl } from '@/services/maps/maps';
import { VERIFICATION_STATUS } from '@/domain/status';
import { documentTypeLabel, mechanicKindLabel, vehicleTypeLabel } from '@/domain/catalog';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { MechanicPlan, VerificationStatus } from '@/types/database';

export default function AdminMechanicDetail() {
  const { id = '' } = useParams();
  const me = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: categories } = useCategories(true);
  const all = useQuery({ queryKey: ['admin-mechanics', 'all'], queryFn: () => listMechanics('all') });
  const docs = useQuery({ queryKey: ['admin-docs', id], queryFn: () => listMechanicDocuments(id) });
  const specs = useQuery({ queryKey: ['admin-specs', id], queryFn: () => mechanicSpecialties(id) });
  const [decision, setDecision] = useState<VerificationStatus | null>(null);
  const canOperate = hasAdminLevel(me.admin_level, 'operations');

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-mechanics'] });
    void qc.invalidateQueries({ queryKey: ['admin-docs', id] });
    void qc.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  if (all.isLoading) return <LoadingBlock />;
  const m = all.data?.find((x) => x.id === id);
  if (all.isError || !m) return <ErrorState message={all.isError ? errorMessage(all.error) : 'Professionnel introuvable.'} />;
  const vs = VERIFICATION_STATUS[m.verification_status];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/professionnels" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-night-850" aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{m.business_name || m.profile?.full_name}</h1>
          <p className="text-sm text-silver-400">{mechanicKindLabel(m.kind)}</p>
        </div>
        <Badge tone={vs.tone}>{vs.label}</Badge>
      </div>

      {canOperate && (
        <div className="flex flex-wrap gap-2">
          {m.verification_status !== 'approved' && (
            <Button variant="success" icon={<Check className="h-4 w-4" />} onClick={() => setDecision('approved')}>
              Valider le profil
            </Button>
          )}
          {m.verification_status === 'pending' && (
            <Button variant="danger" icon={<X className="h-4 w-4" />} onClick={() => setDecision('rejected')}>
              Refuser
            </Button>
          )}
          {m.verification_status === 'approved' && (
            <Button variant="danger" icon={<ShieldOff className="h-4 w-4" />} onClick={() => setDecision('suspended')}>
              Suspendre le profil pro
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() =>
              setSuspension(m.id, !m.profile?.is_suspended, m.profile?.is_suspended ? 'Compte réactivé' : 'Suspension du compte')
                .then(() => {
                  toast.success(m.profile?.is_suspended ? 'Compte réactivé.' : 'Compte suspendu.');
                  refresh();
                })
                .catch((e) => toast.error(errorMessage(e)))
            }
          >
            {m.profile?.is_suspended ? 'Réactiver le compte' : 'Suspendre le compte'}
          </Button>
        </div>
      )}

      {m.rejection_reason && <Notice tone="danger">Motif : {m.rejection_reason}</Notice>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <p className="mb-2 font-bold">Identité et contact</p>
          <DefinitionList
            items={[
              { label: 'Nom', value: m.profile?.full_name ?? '—' },
              { label: 'Téléphone', value: m.profile?.phone ?? '—' },
              { label: 'E-mail', value: m.profile?.email ?? '—' },
              { label: 'Commune', value: m.commune ?? '—' },
              { label: 'Adresse', value: m.address ?? '—' },
              { label: 'Horaires', value: m.opening_hours ?? '—' },
              { label: 'Expérience', value: m.years_experience != null ? `${m.years_experience} ans` : '—' },
              { label: 'Inscription', value: formatDate(m.created_at) },
            ]}
          />
        </Card>
        <Card>
          <p className="mb-2 font-bold">Activité</p>
          <DefinitionList
            items={[
              { label: 'Véhicules', value: m.vehicle_types.map(vehicleTypeLabel).join(', ') },
              { label: 'Spécialités', value: (specs.data ?? []).map((cid) => categories?.find((c) => c.id === cid)?.name).filter(Boolean).join(', ') || '—' },
              { label: 'Rayon', value: `${Number(m.service_radius_km)} km` },
              {
                label: 'Position de base',
                value:
                  m.base_lat && m.base_lng ? (
                    <a href={placeUrl({ lat: m.base_lat, lng: m.base_lng })} target="_blank" rel="noreferrer" className="text-electric-300">
                      Voir sur la carte
                    </a>
                  ) : (
                    '—'
                  ),
              },
              { label: 'Disponible', value: m.is_available ? 'Oui' : 'Non' },
              { label: 'Missions', value: m.completed_missions },
              { label: 'Note', value: m.rating_count ? `${m.rating_avg} (${m.rating_count} avis)` : '—' },
              {
                label: 'Formule',
                value: canOperate ? (
                  <Select
                    aria-label="Formule"
                    value={m.plan}
                    onChange={(e) =>
                      setMechanicPlan(m.id, e.target.value as MechanicPlan)
                        .then(() => {
                          toast.success('Formule mise à jour.');
                          refresh();
                        })
                        .catch((err) => toast.error(errorMessage(err)))
                    }
                    className="h-9 py-1"
                  >
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                  </Select>
                ) : (
                  m.plan
                ),
              },
            ]}
          />
        </Card>
      </div>

      {m.bio && (
        <Card>
          <p className="mb-1 font-bold">Présentation</p>
          <p className="text-sm text-silver-300">{m.bio}</p>
        </Card>
      )}

      <Card>
        <p className="mb-3 font-bold">Documents justificatifs</p>
        {docs.isLoading ? (
          <LoadingBlock />
        ) : !docs.data?.length ? (
          <Notice tone="warning">Aucun document déposé. Ne pas valider sans vérification de l’identité et de l’existence de l’activité.</Notice>
        ) : (
          <ul className="divide-y divide-white/5">
            {docs.data.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <button
                  type="button"
                  className="inline-flex flex-1 items-center gap-2 text-left font-medium hover:text-electric-300"
                  onClick={async () => {
                    const url = await documentUrl(d.storage_path);
                    if (url) window.open(url, '_blank', 'noopener');
                    else toast.error('Document inaccessible.');
                  }}
                >
                  {documentTypeLabel(d.doc_type)} <ExternalLink className="h-3.5 w-3.5" />
                  <span className="text-xs font-normal text-silver-500">{formatDate(d.uploaded_at)}</span>
                </button>
                <Badge tone={d.status === 'accepted' ? 'success' : d.status === 'rejected' ? 'danger' : 'warning'}>
                  {d.status === 'accepted' ? 'Accepté' : d.status === 'rejected' ? 'Refusé' : 'À vérifier'}
                </Badge>
                {canOperate && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => reviewDocument(d.id, 'accepted').then(refresh).catch((e) => toast.error(errorMessage(e)))}>
                      Accepter
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => reviewDocument(d.id, 'rejected').then(refresh).catch((e) => toast.error(errorMessage(e)))}>
                      Refuser
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <DecisionModal
        decision={decision}
        onClose={() => setDecision(null)}
        onConfirm={async (reason) => {
          try {
            await verifyMechanic(m.id, decision!, reason || null);
            toast.success('Décision enregistrée. Le professionnel est notifié.');
            refresh();
            setDecision(null);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

function DecisionModal({ decision, onClose, onConfirm }: { decision: VerificationStatus | null; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const needsReason = decision === 'rejected' || decision === 'suspended';
  return (
    <Modal
      open={decision !== null}
      onClose={onClose}
      title={decision === 'approved' ? 'Valider ce professionnel ?' : decision === 'rejected' ? 'Refuser ce profil ?' : 'Suspendre ce profil ?'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={decision === 'approved' ? 'success' : 'danger'}
            disabled={needsReason && reason.trim().length < 3}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm(reason.trim());
              setBusy(false);
              setReason('');
            }}
          >
            Confirmer
          </Button>
        </>
      }
    >
      {decision === 'approved' ? (
        <p className="text-sm text-silver-300">
          Confirmez avoir vérifié l’identité, le numéro de téléphone, l’existence de l’activité et les spécialités déclarées. Le professionnel pourra
          activer sa disponibilité et recevoir des missions.
        </p>
      ) : (
        <Textarea label="Motif communiqué au professionnel" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
      )}
    </Modal>
  );
}
