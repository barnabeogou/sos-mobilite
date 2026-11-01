import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { AlarmClock, CarFront, Pencil, Plus, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Card, EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/ui/Display';
import { CityHero } from '@/components/cities/CityHero';
import { PAGE_CITY } from '@/domain/cities';
import { Modal, useToast } from '@/components/ui/Overlay';
import { VehicleIcon } from '@/components/ui/Icon';
import {
  addMaintenance,
  createVehicle,
  deleteMaintenance,
  deleteVehicle,
  listMaintenance,
  listMyVehicles,
  updateVehicle,
} from '@/services/vehicles.service';
import { maintenanceSchema, vehicleSchema } from '@/domain/validation';
import { MAINTENANCE_KINDS, VEHICLE_TYPES, maintenanceLabel } from '@/domain/catalog';
import { addDaysISO, computeReminders, daysLabel, daysUntil } from '@/domain/reminders';
import { formatFCFA } from '@/domain/pricing';
import { formatDay } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { MaintenanceRecord, Vehicle } from '@/types/database';

type VehicleForm = z.infer<typeof vehicleSchema>;
type MaintenanceForm = z.infer<typeof maintenanceSchema>;

export default function MyVehiclesPage() {
  const profile = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const vehicles = useQuery({ queryKey: ['vehicles', profile.id], queryFn: () => listMyVehicles(profile.id) });
  const records = useQuery({ queryKey: ['maintenance', profile.id], queryFn: () => listMaintenance(profile.id) });
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null);
  const [maintFor, setMaintFor] = useState<Vehicle | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['vehicles', profile.id] });
    void qc.invalidateQueries({ queryKey: ['maintenance', profile.id] });
  };

  const remove = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => {
      toast.success('Véhicule supprimé.');
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const removeRecord = useMutation({
    mutationFn: deleteMaintenance,
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (vehicles.isLoading || records.isLoading) return <LoadingBlock />;
  if (vehicles.isError) return <ErrorState message={errorMessage(vehicles.error)} onRetry={() => vehicles.refetch()} />;

  const reminders = computeReminders(vehicles.data ?? [], records.data ?? []);

  return (
    <>
      <CityHero
        city={PAGE_CITY.clientVehicles}
        title="Mon véhicule"
        subtitle="Suivez l’entretien et l’assurance de vos engins, et soyez prévenu avant les échéances."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            Ajouter
          </Button>
        }
      />

      {reminders.length > 0 && (
        <div className="mb-6 space-y-2">
          {reminders.map((r) => (
            <Notice
              key={`${r.vehicleId}-${r.title}`}
              tone={r.level === 'overdue' ? 'danger' : 'warning'}
              icon={<AlarmClock className={r.level === 'overdue' ? 'h-5 w-5 text-alert-400' : 'h-5 w-5 text-amber-300'} />}
              title={r.title}
            >
              Échéance le {formatDay(r.dueDate)} ({daysLabel(r.daysLeft)}).
              {r.kind === 'insurance' && ' Pensez à renouveler pour éviter une mauvaise surprise lors d’un contrôle routier.'}
            </Notice>
          ))}
        </div>
      )}

      {!vehicles.data?.length ? (
        <EmptyState
          icon={<CarFront className="h-6 w-6" />}
          title="Aucun véhicule enregistré"
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              Ajouter mon véhicule
            </Button>
          }
        >
          Enregistrez votre voiture, moto ou bateau pour aller plus vite lors d’un SOS et suivre ses entretiens.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {vehicles.data.map((v) => {
            const vr = (records.data ?? []).filter((r) => r.vehicle_id === v.id);
            return (
              <Card key={v.id}>
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-electric-500/15 text-electric-300">
                    <VehicleIcon type={v.type} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {v.brand} {v.model} {v.year && <span className="font-normal text-silver-400">({v.year})</span>}
                    </p>
                    <p className="text-sm text-silver-400">{[v.plate, v.color].filter(Boolean).join(' · ') || '—'}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-silver-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {v.insurance_expires_at ? `Assurance jusqu’au ${formatDay(v.insurance_expires_at)}` : 'Échéance d’assurance non renseignée'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setEditing(v)} className="rounded-lg p-2 text-silver-400 hover:bg-white/5 hover:text-white" aria-label="Modifier">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => window.confirm(`Supprimer ${v.brand} ${v.model} et son historique d’entretien ?`) && remove.mutate(v.id)}
                      className="rounded-lg p-2 text-silver-400 hover:bg-alert-500/10 hover:text-alert-400"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/5 pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-silver-200">Carnet d’entretien</p>
                    <Button size="sm" variant="secondary" icon={<Wrench className="h-4 w-4" />} onClick={() => setMaintFor(v)}>
                      Ajouter un entretien
                    </Button>
                  </div>
                  {vr.length === 0 ? (
                    <p className="text-sm text-silver-500">Exemple : notez la date de votre dernière vidange pour être alerté de la suivante.</p>
                  ) : (
                    <ul className="divide-y divide-white/5">
                      {vr.map((r) => (
                        <MaintenanceRow key={r.id} record={r} onDelete={() => removeRecord.mutate(r.id)} />
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <VehicleModal
        open={editing !== null}
        vehicle={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          refresh();
          setEditing(null);
        }}
        userId={profile.id}
      />
      <MaintenanceModal vehicle={maintFor} onClose={() => setMaintFor(null)} onSaved={refresh} userId={profile.id} />
    </>
  );
}

function MaintenanceRow({ record, onDelete }: { record: MaintenanceRecord; onDelete: () => void }) {
  const due = record.next_due_at ? daysUntil(record.next_due_at) : null;
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-white">
          {maintenanceLabel(record.kind)} <span className="text-silver-400">· {formatDay(record.performed_at)}</span>
        </p>
        <p className="text-xs text-silver-500">
          {[record.mileage_km != null && `${record.mileage_km.toLocaleString('fr-FR')} km`, record.cost != null && formatFCFA(record.cost), record.notes]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      {record.next_due_at && (
        <span className={due !== null && due < 0 ? 'text-xs font-semibold text-alert-400' : 'text-xs text-silver-400'}>
          Prochain : {formatDay(record.next_due_at)}
        </span>
      )}
      <button type="button" onClick={onDelete} className="rounded-lg p-1.5 text-silver-500 hover:text-alert-400" aria-label="Supprimer l’entretien">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function VehicleModal({ open, vehicle, onClose, onSaved, userId }: { open: boolean; vehicle: Vehicle | null; onClose: () => void; onSaved: () => void; userId: string }) {
  const toast = useToast();
  const { register, handleSubmit, formState, reset } = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    values: vehicle
      ? {
          type: vehicle.type,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year ?? '',
          plate: vehicle.plate ?? '',
          color: vehicle.color ?? '',
          insurance_expires_at: vehicle.insurance_expires_at ?? '',
        }
      : { type: 'auto', brand: '', model: '', year: '', plate: '', color: '', insurance_expires_at: '' },
  });

  const submit = handleSubmit(async (v) => {
    const input = {
      type: v.type,
      brand: v.brand.trim(),
      model: v.model.trim(),
      year: v.year === '' || v.year === undefined ? null : Number(v.year),
      plate: v.plate?.trim() || null,
      color: v.color?.trim() || null,
      insurance_expires_at: v.insurance_expires_at || null,
    };
    try {
      if (vehicle) await updateVehicle(vehicle.id, input);
      else await createVehicle(userId, input);
      toast.success(vehicle ? 'Véhicule mis à jour.' : 'Véhicule ajouté.');
      reset();
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={vehicle ? 'Modifier le véhicule' : 'Ajouter un véhicule'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={formState.isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Select label="Type" {...register('type')} wrapClassName="sm:col-span-2">
          {VEHICLE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label} — {t.description}
            </option>
          ))}
        </Select>
        <Input label="Marque" placeholder="Toyota, Yamaha…" {...register('brand')} error={formState.errors.brand?.message} />
        <Input label="Modèle" placeholder="Corolla, Crypton…" {...register('model')} error={formState.errors.model?.message} />
        <Input label="Année" optional inputMode="numeric" {...register('year')} error={formState.errors.year?.message} />
        <Input label="Immatriculation" optional {...register('plate')} className="uppercase" />
        <Input label="Couleur" optional {...register('color')} />
        <Input label="Fin de l’assurance" optional type="date" {...register('insurance_expires_at')} hint="Pour être alerté 30 jours avant." />
      </form>
    </Modal>
  );
}

function MaintenanceModal({ vehicle, onClose, onSaved, userId }: { vehicle: Vehicle | null; onClose: () => void; onSaved: () => void; userId: string }) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, formState, setValue, watch, reset } = useForm<MaintenanceForm>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: { kind: 'vidange', performed_at: today, next_due_at: addDaysISO(today, 90), mileage_km: '', cost: '', notes: '' },
  });
  const kind = watch('kind');
  const performed = watch('performed_at');

  const suggestNext = (k: string, date: string) => {
    const interval = MAINTENANCE_KINDS.find((m) => m.value === k)?.defaultIntervalDays;
    if (interval && date.length === 10) setValue('next_due_at', addDaysISO(date, interval));
  };

  const submit = handleSubmit(async (v) => {
    if (!vehicle) return;
    try {
      await addMaintenance(userId, vehicle.id, {
        kind: v.kind,
        performed_at: v.performed_at,
        mileage_km: v.mileage_km === '' || v.mileage_km === undefined ? null : Number(v.mileage_km),
        cost: v.cost === '' || v.cost === undefined ? null : Number(v.cost),
        next_due_at: v.next_due_at || null,
        notes: v.notes?.trim() || null,
      });
      toast.success('Entretien enregistré.');
      reset();
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Modal
      open={vehicle !== null}
      onClose={onClose}
      title={`Entretien — ${vehicle?.brand ?? ''} ${vehicle?.model ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={formState.isSubmitting}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Type d’entretien"
          {...register('kind', { onChange: (e) => suggestNext(e.target.value, performed) })}
        >
          {MAINTENANCE_KINDS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
        <Input
          label="Date"
          type="date"
          max={today}
          {...register('performed_at', { onChange: (e) => suggestNext(kind, e.target.value) })}
          error={formState.errors.performed_at?.message}
        />
        <Input label="Kilométrage" optional inputMode="numeric" suffix="km" {...register('mileage_km')} />
        <Input label="Coût" optional inputMode="numeric" suffix="FCFA" {...register('cost')} />
        <Input label="Prochaine échéance" optional type="date" {...register('next_due_at')} hint="Proposée selon le type d’entretien, modifiable." wrapClassName="sm:col-span-2" />
        <Textarea label="Notes" optional rows={2} {...register('notes')} wrapClassName="sm:col-span-2" />
      </form>
    </Modal>
  );
}
