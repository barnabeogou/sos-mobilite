import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Camera, CarFront, ChevronRight, FileLock2, LifeBuoy, LogOut, MapPin, UserRound, type LucideIcon } from 'lucide-react';
import { useAuth, useProfile } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { LocationFields } from '@/components/forms/LocationFields';
import { CityHero } from '@/components/cities/CityHero';
import { PAGE_CITY } from '@/domain/cities';
import { Avatar, Card } from '@/components/ui/Display';
import { useToast } from '@/components/ui/Overlay';
import { profileSchema } from '@/domain/validation';
import { updateMyProfile, uploadAvatar } from '@/services/profile.service';
import { errorMessage } from '@/lib/errors';

type Form = z.infer<typeof profileSchema>;

/** Formulaire du compte (nom, téléphone, ville, commune, photo) — réutilisé par l'espace pro. */
export function AccountCard({ compact = false }: { compact?: boolean }) {
  const profile = useProfile();
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const { register, handleSubmit, formState, watch, setValue } = useForm<Form>({
    resolver: zodResolver(profileSchema),
    values: { full_name: profile.full_name, phone: profile.phone ?? '', commune: profile.commune ?? '', city: profile.city },
  });

  const submit = handleSubmit(async (v) => {
    try {
      await updateMyProfile(profile.id, { full_name: v.full_name, phone: v.phone || null, commune: v.commune || null, city: v.city });
      await refreshProfile();
      toast.success('Profil enregistré.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Card>
      {!compact && (
        <div className="mb-5 flex items-center gap-4">
          <AvatarButton />
          <div className="min-w-0">
            <p className="truncate font-bold">{profile.full_name || 'Mon compte'}</p>
            <p className="truncate text-sm text-silver-400">{profile.email}</p>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Input label="Nom complet" {...register('full_name')} error={formState.errors.full_name?.message} />
        <Input label="Téléphone" type="tel" inputMode="tel" {...register('phone')} error={formState.errors.phone?.message} />
        <LocationFields
          city={watch('city')}
          cityField={register('city', { onChange: () => setValue('commune', '') })}
          communeField={register('commune')}
          cityError={formState.errors.city?.message}
        />
        <div className="sm:col-span-2">
          <Button type="submit" loading={formState.isSubmitting}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Photo de profil cliquable (changement de photo). */
export function AvatarButton({ size = 64 }: { size?: number }) {
  const profile = useProfile();
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const onAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error('Image trop lourde (8 Mo maximum).');
    try {
      await uploadAvatar(profile.id, file);
      await refreshProfile();
      toast.success('Photo mise à jour.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <button type="button" onClick={() => fileRef.current?.click()} className="relative shrink-0 rounded-full ring-4 ring-night-900" aria-label="Changer la photo">
        <Avatar name={profile.full_name} src={profile.avatar_url} size={size} />
        <span className="absolute -bottom-0.5 -right-0.5 grid h-8 w-8 place-items-center rounded-full bg-electric-500 text-white ring-2 ring-night-900">
          <Camera className="h-4 w-4" />
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => onAvatar(e.target.files?.[0])} />
    </>
  );
}

function MenuRow({ icon: Icon, title, hint, to, onClick, danger, open }: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  open?: boolean;
}) {
  const body = (
    <>
      <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-white/5', danger ? 'bg-alert-500/10 text-alert-400' : 'bg-night-950/60 text-silver-200')}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx('block font-semibold', danger && 'text-alert-400')}>{title}</span>
        {hint && <span className="block truncate text-sm text-silver-400">{hint}</span>}
      </span>
      <ChevronRight className={clsx('h-5 w-5 shrink-0 text-silver-500 transition-transform duration-300', open && 'rotate-90')} aria-hidden />
    </>
  );
  const cls = 'card-interactive flex w-full items-center gap-4 px-4 py-3.5 text-left';
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} aria-expanded={open}>
      {body}
    </button>
  );
}

export default function ProfilePage() {
  const profile = useProfile();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const base = profile.role === 'mechanic' ? '/pro' : profile.role === 'admin' ? '/admin' : '/client';
  const place = [profile.commune, profile.city].filter(Boolean).join(', ');

  return (
    <div>
      <CityHero
        city={PAGE_CITY.clientProfile}
        media={<AvatarButton size={76} />}
        title={<span className="block truncate">{profile.full_name || 'Mon compte'}</span>}
        subtitle={
          place && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-alert-500" aria-hidden /> {place}
            </span>
          )
        }
      />
      <div className="stagger space-y-3">
        <MenuRow icon={UserRound} title="Mon profil" hint="Informations personnelles" onClick={() => setEditing((v) => !v)} open={editing} />
        <div className={clsx('grid transition-[grid-template-rows] duration-500 ease-out', editing ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
          <div className="overflow-hidden">{editing && <AccountCard compact />}</div>
        </div>
        {profile.role === 'client' && <MenuRow icon={CarFront} title="Mes véhicules" hint="Entretiens, assurance, rappels" to="/client/vehicules" />}
        <MenuRow icon={LifeBuoy} title="Aide & support" hint="Une question, un problème" to={`${base}/support`} />
        <MenuRow icon={FileLock2} title="Données personnelles" hint="Ce que nous conservons et pourquoi" to="/confidentialite" />
        <MenuRow
          icon={LogOut}
          title="Se déconnecter"
          danger
          onClick={async () => {
            await signOut();
            navigate('/connexion', { replace: true });
          }}
        />
      </div>
    </div>
  );
}
