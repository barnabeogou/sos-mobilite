import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import clsx from 'clsx';
import { Crosshair, FileUp, LocateFixed, Trash2 } from 'lucide-react';
import { useAuth, useProfile } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Badge, Card, ErrorState, LoadingBlock, Notice } from '@/components/ui/Display';
import { CityHero } from '@/components/cities/CityHero';
import { PAGE_CITY } from '@/domain/cities';
import { useToast } from '@/components/ui/Overlay';
import { NamedIcon, VehicleIcon } from '@/components/ui/Icon';
import { AccountCard } from '@/pages/shared/ProfilePage';
import { PayoutAccountCard } from '@/components/mechanic/PayoutAccountCard';
import { useMechanicProfile, useMyDocuments, useMySpecialties } from './useMechanic';
import { deleteDocument, documentUrl, setMySpecialties, updateMyMechanicProfile, uploadDocument } from '@/services/mechanic.service';
import { mechanicProfileSchema } from '@/domain/validation';
import { ABIDJAN_COMMUNES, DOCUMENT_TYPES, MECHANIC_KINDS, VEHICLE_TYPES, documentTypeLabel } from '@/domain/catalog';
import { VERIFICATION_STATUS } from '@/domain/status';
import { GEO_ERROR_MESSAGES, GeoError, getCurrentPosition } from '@/domain/geo';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { DocumentType, VehicleType } from '@/types/database';

type Form = z.infer<typeof mechanicProfileSchema>;

export default function MechanicProfilePage() {
  const profile = useProfile();
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const mech = useMechanicProfile();
  const specs = useMySpecialties();
  const docs = useMyDocuments();
  const { data: categories } = useCategories();

  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [locating, setLocating] = useState(false);
  const [docType, setDocType] = useState<DocumentType>('piece_identite');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (mech.data) setVehicleTypes(mech.data.vehicle_types);
  }, [mech.data]);
  useEffect(() => {
    if (specs.data) setSelected(specs.data);
  }, [specs.data]);

  const { register, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(mechanicProfileSchema),
    values: mech.data
      ? {
          business_name: mech.data.business_name,
          kind: mech.data.kind,
          bio: mech.data.bio ?? '',
          years_experience: mech.data.years_experience ?? '',
          commune: mech.data.commune ?? '',
          address: mech.data.address ?? '',
          opening_hours: mech.data.opening_hours ?? '',
          service_radius_km: Number(mech.data.service_radius_km),
        }
      : undefined,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['mechanic-profile', profile.id] });
    void qc.invalidateQueries({ queryKey: ['my-specialties', profile.id] });
    void qc.invalidateQueries({ queryKey: ['my-documents', profile.id] });
  };

  const save = handleSubmit(async (v) => {
    if (!vehicleTypes.length) return toast.error('Choisissez au moins un type de véhicule.');
    if (!selected.length) return toast.error('Choisissez au moins une spécialité.');
    try {
      await updateMyMechanicProfile(profile.id, {
        business_name: v.business_name?.trim() ?? '',
        kind: v.kind,
        bio: v.bio?.trim() || null,
        years_experience: v.years_experience === '' || v.years_experience === undefined ? null : Number(v.years_experience),
        commune: v.commune || null,
        address: v.address?.trim() || null,
        opening_hours: v.opening_hours?.trim() || null,
        service_radius_km: Number(v.service_radius_km),
        vehicle_types: vehicleTypes,
      });
      await setMySpecialties(selected);
      invalidate();
      toast.success('Profil professionnel enregistré.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const setBase = async () => {
    setLocating(true);
    try {
      const p = await getCurrentPosition();
      await updateMyMechanicProfile(profile.id, { base_lat: p.lat, base_lng: p.lng });
      invalidate();
      toast.success('Position de base enregistrée.');
    } catch (e) {
      toast.error(e instanceof GeoError ? GEO_ERROR_MESSAGES[e.code] : errorMessage(e));
    } finally {
      setLocating(false);
    }
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('Fichier trop lourd (10 Mo maximum).');
    setUploading(true);
    try {
      await uploadDocument(profile.id, docType, file);
      invalidate();
      toast.success('Document déposé. Il sera vérifié par l’équipe.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  if (mech.isLoading) return <LoadingBlock />;
  if (mech.isError || !mech.data) return <ErrorState message={errorMessage(mech.error)} onRetry={() => mech.refetch()} />;
  const m = mech.data;
  const vs = VERIFICATION_STATUS[m.verification_status];

  return (
    <div className="space-y-6">
      <CityHero city={PAGE_CITY.proProfile} title="Profil professionnel" subtitle="Ces informations sont présentées aux clients et vérifiées par l’équipe." />

      <Notice tone={vs.tone} title={vs.label}>
        {vs.help}
        {m.rejection_reason && <p className="mt-1">Motif : {m.rejection_reason}</p>}
      </Notice>

      <Card>
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nom affiché (garage / entreprise)" {...register('business_name')} hint="Laissez vide pour afficher votre nom." />
            <Select label="Activité" {...register('kind')}>
              {MECHANIC_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
            {profile.city === 'Abidjan' ? (
              <Select label="Commune de l’atelier" {...register('commune')}>
                <option value="">—</option>
                {ABIDJAN_COMMUNES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            ) : (
              <Input label="Quartier de l’atelier" optional hint={`À ${profile.city}. Ville modifiable plus bas, dans « Compte ».`} {...register('commune')} />
            )}
            <Input label="Années d’expérience" optional inputMode="numeric" {...register('years_experience')} />
            <Input label="Adresse de l’atelier" optional {...register('address')} wrapClassName="sm:col-span-2" />
            <Input label="Horaires" optional placeholder="Lun–Sam 7h–19h, urgences 24h/24" {...register('opening_hours')} wrapClassName="sm:col-span-2" />
            <Textarea label="Présentation" optional rows={3} {...register('bio')} wrapClassName="sm:col-span-2" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-silver-200">Véhicules pris en charge</p>
            <div className="flex flex-wrap gap-2">
              {VEHICLE_TYPES.map((t) => {
                const on = vehicleTypes.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setVehicleTypes((xs) => (on ? xs.filter((x) => x !== t.value) : [...xs, t.value]))}
                    className={on ? 'chip-on' : 'chip-off'}
                  >
                    <VehicleIcon type={t.value} className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-silver-200">Spécialités</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(categories ?? []).map((c) => {
                const on = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected((xs) => (on ? xs.filter((x) => x !== c.id) : [...xs, c.id]))}
                    className={clsx(on ? 'chip-on' : 'chip-off', 'justify-start')}
                  >
                    <NamedIcon name={c.icon} className="h-4 w-4" />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid items-end gap-4 sm:grid-cols-[1fr_2fr]">
            <Input label="Rayon d’intervention" inputMode="numeric" suffix="km" {...register('service_radius_km')} error={formState.errors.service_radius_km?.message} />
            <div className="rounded-xl border border-white/10 bg-night-950/40 p-3">
              <div className="flex items-center gap-3">
                <LocateFixed className={clsx('h-5 w-5', m.base_lat ? 'text-emerald-300' : 'text-silver-500')} />
                <p className="flex-1 text-sm">
                  {m.base_lat && m.base_lng ? (
                    <>
                      Position de base : {m.base_lat.toFixed(4)}, {m.base_lng.toFixed(4)}
                    </>
                  ) : (
                    'Position de base non définie'
                  )}
                </p>
                <Button size="sm" variant="secondary" loading={locating} onClick={setBase} icon={<Crosshair className="h-4 w-4" />}>
                  {m.base_lat ? 'Mettre à jour' : 'Utiliser ma position'}
                </Button>
              </div>
              <p className="mt-2 text-xs text-silver-500">Placez-vous à votre atelier ou point de départ habituel. Les distances sont calculées depuis ce point.</p>
            </div>
          </div>

          <Button type="submit" loading={formState.isSubmitting}>
            Enregistrer le profil professionnel
          </Button>
        </form>
      </Card>

      <PayoutAccountCard mechanic={m} />

      <Card>
        <p className="font-bold">Documents justificatifs</p>
        <p className="mt-1 text-sm text-silver-400">Pièce d’identité, registre de commerce ou patente, photo de l’atelier… Visibles uniquement par l’équipe de vérification.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} aria-label="Type de document" wrapClassName="flex-1">
            {DOCUMENT_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
          <label className={clsx('inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-electric-500 px-4 font-semibold text-white', uploading && 'pointer-events-none opacity-60')}>
            <FileUp className="h-4 w-4" /> {uploading ? 'Envoi…' : 'Déposer un fichier'}
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => onUpload(e.target.files?.[0])} />
          </label>
        </div>
        <ul className="mt-4 divide-y divide-white/5">
          {(docs.data ?? []).map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3 text-sm">
              <button
                type="button"
                className="flex-1 text-left font-medium text-white hover:text-electric-300"
                onClick={async () => {
                  const url = await documentUrl(d.storage_path);
                  if (url) window.open(url, '_blank', 'noopener');
                }}
              >
                {documentTypeLabel(d.doc_type)}
                <span className="block text-xs font-normal text-silver-500">Déposé le {formatDate(d.uploaded_at)}</span>
              </button>
              <Badge tone={d.status === 'accepted' ? 'success' : d.status === 'rejected' ? 'danger' : 'warning'}>
                {d.status === 'accepted' ? 'Accepté' : d.status === 'rejected' ? 'Refusé' : 'En vérification'}
              </Badge>
              {d.status === 'pending' && (
                <button
                  type="button"
                  onClick={() =>
                    deleteDocument(d)
                      .then(invalidate)
                      .catch((e) => toast.error(errorMessage(e)))
                  }
                  className="rounded-lg p-1.5 text-silver-500 hover:text-alert-400"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
          {!docs.data?.length && <li className="py-3 text-sm text-silver-500">Aucun document déposé.</li>}
        </ul>
      </Card>

      <AccountCard />
      <Button variant="danger" onClick={() => void signOut()}>
        Se déconnecter
      </Button>
    </div>
  );
}
