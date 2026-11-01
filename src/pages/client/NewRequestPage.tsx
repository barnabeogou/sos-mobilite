import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Camera, Crosshair, ImagePlus, Loader2, LocateFixed, MapPin, ShieldAlert, X } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Textarea } from '@/components/ui/Field';
import { ErrorState, LoadingBlock, Notice } from '@/components/ui/Display';
import { NamedIcon, VehicleIcon } from '@/components/ui/Icon';
import { listMyVehicles } from '@/services/vehicles.service';
import { createServiceRequest, listMyRequests } from '@/services/requests.service';
import { CANCELLATION_RULE, EMERGENCY_NOTICE, SYMPTOMS, VEHICLE_TYPES } from '@/domain/catalog';
import { GEO_ERROR_MESSAGES, GeoError, getCurrentPosition, type GeoPoint } from '@/domain/geo';
import { isActive } from '@/domain/status';
import { priceRangeLabel } from '@/domain/pricing';
import { errorMessage } from '@/lib/errors';
import type { VehicleType } from '@/types/database';

const MAX_PHOTOS = 5;
const MAX_PHOTO_MB = 12;

export default function NewRequestPage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const { data: categories, isLoading: catLoading } = useCategories();
  const vehicles = useQuery({ queryKey: ['vehicles', profile.id], queryFn: () => listMyVehicles(profile.id) });
  const myRequests = useQuery({ queryKey: ['my-requests', profile.id], queryFn: () => listMyRequests(profile.id) });
  const activeRequest = myRequests.data?.find((r) => isActive(r.status));

  const [step, setStep] = useState(1);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>('auto');
  const [categoryId, setCategoryId] = useState<string | null>(params.get('service'));
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [addressHint, setAddressHint] = useState('');
  const [consent, setConsent] = useState(false);

  // Véhicule par défaut : le premier enregistré
  useEffect(() => {
    if (vehicles.data?.length && vehicleId === null) {
      setVehicleId(vehicles.data[0].id);
      setVehicleType(vehicles.data[0].type);
    }
  }, [vehicles.data, vehicleId]);

  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const availableCategories = (categories ?? []).filter((c) => c.vehicle_types.includes(vehicleType));
  const category = categories?.find((c) => c.id === categoryId);

  useEffect(() => {
    if (category && !category.vehicle_types.includes(vehicleType)) setCategoryId(null);
  }, [vehicleType, category]);

  const submit = useMutation({
    mutationFn: () =>
      createServiceRequest(profile.id, {
        categoryId: categoryId!,
        vehicleId,
        vehicleType,
        symptoms,
        description: description.trim(),
        photos,
        lat: position!.lat,
        lng: position!.lng,
        accuracy: position!.accuracy ?? null,
        addressHint: addressHint.trim(),
        locationConsent: consent,
      }),
    onSuccess: (req) => {
      void qc.invalidateQueries({ queryKey: ['my-requests', profile.id] });
      navigate(`/client/demandes/${req.id}`, { replace: true });
    },
  });

  const locate = async () => {
    setLocating(true);
    setGeoError(null);
    try {
      setPosition(await getCurrentPosition());
    } catch (e) {
      setGeoError(e instanceof GeoError ? GEO_ERROR_MESSAGES[e.code] : GEO_ERROR_MESSAGES.unavailable);
    } finally {
      setLocating(false);
    }
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const ok = Array.from(files).filter((f) => f.type.startsWith('image/') && f.size <= MAX_PHOTO_MB * 1024 * 1024);
    setPhotos((p) => [...p, ...ok].slice(0, MAX_PHOTOS));
  };

  if (catLoading || myRequests.isLoading) return <LoadingBlock />;

  if (activeRequest) {
    return (
      <Notice tone="info" title="Une intervention est déjà en cours">
        <p>Vous ne pouvez avoir qu’une demande active à la fois.</p>
        <Link to={`/client/demandes/${activeRequest.id}`} className="mt-2 inline-block font-semibold text-electric-300">
          Suivre ma demande en cours →
        </Link>
      </Notice>
    );
  }

  const canNext1 = Boolean(categoryId);
  const canNext2 = symptoms.length > 0 || description.trim().length >= 5;
  const canSubmit = Boolean(position && consent && categoryId);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => (step === 1 ? navigate(-1) : setStep(step - 1))}
          className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-night-850 text-silver-200"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <p className="text-xs font-semibold text-silver-400">Étape {step} sur 3</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5" aria-hidden>
            {[1, 2, 3].map((i) => (
              <span key={i} className={clsx('h-1.5 rounded-full', i <= step ? 'bg-electric-500' : 'bg-white/10')} />
            ))}
          </div>
        </div>
      </div>

      {step === 1 && (
        <section className="space-y-6">
          <h1 className="text-2xl font-bold">De quoi avez-vous besoin ?</h1>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-silver-300">Véhicule concerné</p>
            <div className="flex flex-wrap gap-2">
              {(vehicles.data ?? []).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setVehicleId(v.id);
                    setVehicleType(v.type);
                  }}
                  className={vehicleId === v.id ? 'chip-on' : 'chip-off'}
                >
                  <VehicleIcon type={v.type} className="h-4 w-4" />
                  {v.brand} {v.model}
                  {v.plate && <span className="text-xs opacity-70">· {v.plate}</span>}
                </button>
              ))}
              {VEHICLE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setVehicleId(null);
                    setVehicleType(t.value);
                  }}
                  className={vehicleId === null && vehicleType === t.value ? 'chip-on' : 'chip-off'}
                >
                  <VehicleIcon type={t.value} className="h-4 w-4" />
                  {vehicles.data?.length ? `Autre ${t.label.toLowerCase()}` : t.label}
                </button>
              ))}
            </div>
            {!vehicles.data?.length && (
              <p className="text-xs text-silver-500">
                Astuce : enregistrez votre véhicule dans <Link to="/client/vehicules" className="text-electric-300">Mon véhicule</Link> pour aller plus vite.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-silver-300">Type d’assistance</p>
            <div className="grid grid-cols-2 gap-2">
              {availableCategories.map((c) => {
                const price = priceRangeLabel(c.base_price_min, c.base_price_max);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={clsx(
                      'flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition',
                      categoryId === c.id ? 'border-electric-500 bg-electric-500/15 shadow-glow' : 'border-white/10 bg-night-850/70 hover:border-electric-500/50',
                    )}
                    aria-pressed={categoryId === c.id}
                  >
                    <NamedIcon name={c.icon} className={clsx('h-6 w-6', categoryId === c.id ? 'text-white' : 'text-electric-300')} />
                    <span className="text-sm font-semibold leading-tight">{c.name}</span>
                    {price && <span className="text-[11px] text-silver-400">{price}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <Button block size="lg" disabled={!canNext1} onClick={() => setStep(2)} icon={<ArrowRight className="h-5 w-5" />}>
            Continuer
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <h1 className="text-2xl font-bold">Que se passe-t-il ?</h1>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-silver-300">Sélectionnez un ou plusieurs symptômes</p>
            <div className="grid grid-cols-2 gap-2">
              {SYMPTOMS.map((s) => {
                const on = symptoms.includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSymptoms((xs) => (on ? xs.filter((x) => x !== s.value) : [...xs, s.value]))}
                    className={clsx(on ? 'chip-on' : 'chip-off', 'justify-start')}
                    aria-pressed={on}
                  >
                    <NamedIcon name={s.icon} className="h-4 w-4" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Textarea
            label="Décrivez la situation"
            optional
            rows={3}
            maxLength={1000}
            placeholder="Ex. : la voiture a calé au feu et ne redémarre plus, le tableau de bord s’allume."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="space-y-2">
            <p className="flex items-center justify-between text-sm font-semibold text-silver-300">
              Photos et vidéo <span className="text-xs font-normal text-silver-500">{photos.length}/{MAX_PHOTOS} · facultatif</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={src} className="relative h-20 w-20 overflow-hidden rounded-xl ring-1 ring-white/10">
                  <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-night-950/80 text-white"
                    aria-label="Retirer la photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <>
                  <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed border-white/20 text-silver-400 hover:border-electric-500 hover:text-electric-300">
                    <Camera className="h-6 w-6" />
                    <span className="sr-only">Prendre une photo</span>
                    <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
                  </label>
                  <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed border-white/20 text-silver-400 hover:border-electric-500 hover:text-electric-300">
                    <ImagePlus className="h-6 w-6" />
                    <span className="sr-only">Ajouter depuis la galerie</span>
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
                  </label>
                </>
              )}
            </div>
          </div>

          <Button block size="lg" disabled={!canNext2} onClick={() => setStep(3)} icon={<ArrowRight className="h-5 w-5" />}>
            Continuer
          </Button>
          {!canNext2 && <p className="text-center text-xs text-silver-500">Choisissez au moins un symptôme ou décrivez la panne.</p>}
        </section>
      )}

      {step === 3 && (
        <section className="space-y-5">
          <h1 className="text-2xl font-bold">Où êtes-vous ?</h1>
          <Notice tone="info" icon={<MapPin className="h-5 w-5 text-electric-300" />} title="Pourquoi votre position ?">
            Elle sert uniquement à trouver les professionnels proches pour cette demande. Avant acceptation, ils ne voient qu’une zone
            approximative (≈ 1 km). Seul le professionnel qui accepte voit votre position précise.
          </Notice>

          <div className="card p-4">
            {position ? (
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <LocateFixed className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <p className="font-semibold">Position trouvée</p>
                  <p className="text-xs text-silver-400">
                    Précision ≈ {position.accuracy ?? '?'} m · {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={locate} loading={locating}>
                  Actualiser
                </Button>
              </div>
            ) : (
              <Button block size="lg" variant="secondary" onClick={locate} loading={locating} icon={!locating && <Crosshair className="h-5 w-5" />}>
                {locating ? 'Localisation…' : 'Utiliser ma position actuelle'}
              </Button>
            )}
            {geoError && <ErrorState message={geoError} />}
          </div>

          <Input
            label="Repère pour vous trouver"
            optional
            maxLength={200}
            placeholder="Ex. : devant la pharmacie, station Total, portail bleu…"
            value={addressHint}
            onChange={(e) => setAddressHint(e.target.value)}
          />

          <Checkbox
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            label="J’autorise SOS MOBILITÉ à partager ma position avec les professionnels sollicités pour cette demande."
          />

          <div className="space-y-2 rounded-2xl border border-white/5 bg-night-950/40 p-4 text-xs text-silver-400">
            <p>
              <strong className="text-silver-200">Prix : </strong>le professionnel vous enverra un devis à valider avant de se déplacer. Aucun
              supplément sans votre accord.
            </p>
            <p>
              <strong className="text-silver-200">Annulation : </strong>
              {CANCELLATION_RULE}
            </p>
            <p className="flex gap-2 text-alert-400">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
              {EMERGENCY_NOTICE}
            </p>
          </div>

          {submit.isError && <ErrorState message={errorMessage(submit.error)} />}

          <Button
            block
            size="lg"
            variant="sos"
            disabled={!canSubmit}
            loading={submit.isPending}
            onClick={() => submit.mutate()}
            icon={!submit.isPending && <ArrowRight className="h-5 w-5" />}
          >
            {submit.isPending ? (photos.length ? 'Envoi des photos…' : 'Envoi…') : 'Trouver un mécano'}
          </Button>
          {submit.isPending && (
            <p className="flex items-center justify-center gap-2 text-xs text-silver-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ne fermez pas l’application.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
