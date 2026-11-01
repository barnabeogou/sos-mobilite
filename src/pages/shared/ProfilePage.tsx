import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Camera, ChevronRight, FileLock2, LifeBuoy, LogOut } from 'lucide-react';
import { useAuth, useProfile } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Avatar, Card, PageHeader } from '@/components/ui/Display';
import { useToast } from '@/components/ui/Overlay';
import { profileSchema } from '@/domain/validation';
import { ABIDJAN_COMMUNES } from '@/domain/catalog';
import { updateMyProfile, uploadAvatar } from '@/services/profile.service';
import { errorMessage } from '@/lib/errors';

type Form = z.infer<typeof profileSchema>;

/** Formulaire du compte (nom, téléphone, commune, photo) — réutilisé par l'espace pro. */
export function AccountCard() {
  const profile = useProfile();
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, formState } = useForm<Form>({
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
    <Card>
      <div className="mb-5 flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative" aria-label="Changer la photo">
          <Avatar name={profile.full_name} src={profile.avatar_url} size={64} />
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-electric-500 text-white ring-2 ring-night-850">
            <Camera className="h-3.5 w-3.5" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => onAvatar(e.target.files?.[0])} />
        <div className="min-w-0">
          <p className="truncate font-bold">{profile.full_name || 'Mon compte'}</p>
          <p className="truncate text-sm text-silver-400">{profile.email}</p>
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Input label="Nom complet" {...register('full_name')} error={formState.errors.full_name?.message} />
        <Input label="Téléphone" type="tel" inputMode="tel" {...register('phone')} error={formState.errors.phone?.message} />
        <Select label="Commune" {...register('commune')}>
          <option value="">—</option>
          {ABIDJAN_COMMUNES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input label="Ville" {...register('city')} error={formState.errors.city?.message} />
        <div className="sm:col-span-2">
          <Button type="submit" loading={formState.isSubmitting}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function ProfilePage() {
  const profile = useProfile();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const base = profile.role === 'mechanic' ? '/pro' : profile.role === 'admin' ? '/admin' : '/client';

  return (
    <div className="space-y-5">
      <PageHeader title="Mon profil" />
      <AccountCard />
      <Card className="p-0">
        <Link to={`${base}/support`} className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03]">
          <LifeBuoy className="h-5 w-5 text-electric-300" />
          <span className="flex-1 font-semibold">Contacter le support</span>
          <ChevronRight className="h-5 w-5 text-silver-500" />
        </Link>
        <Link to="/confidentialite" className="flex items-center gap-3 border-t border-white/5 px-5 py-4 hover:bg-white/[0.03]">
          <FileLock2 className="h-5 w-5 text-electric-300" />
          <span className="flex-1 font-semibold">Données personnelles</span>
          <ChevronRight className="h-5 w-5 text-silver-500" />
        </Link>
      </Card>
      <Button
        variant="danger"
        icon={<LogOut className="h-4 w-4" />}
        onClick={async () => {
          await signOut();
          navigate('/connexion', { replace: true });
        }}
      >
        Se déconnecter
      </Button>
    </div>
  );
}
