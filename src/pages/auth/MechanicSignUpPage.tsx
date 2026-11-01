import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { BadgeCheck, MailCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Checkbox, Input } from '@/components/ui/Field';
import { LocationFields } from '@/components/forms/LocationFields';
import { Button } from '@/components/ui/Button';
import { ErrorState, Notice } from '@/components/ui/Display';
import { mechanicSignUpSchema } from '@/domain/validation';
import { signUpMechanic } from '@/services/auth.service';
import { errorMessage } from '@/lib/errors';

type Form = z.infer<typeof mechanicSignUpSchema>;

export default function MechanicSignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { register, handleSubmit, formState, watch, setValue } = useForm<Form>({ resolver: zodResolver(mechanicSignUpSchema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const res = await signUpMechanic({
        full_name: v.full_name,
        business_name: v.business_name || null,
        phone: v.phone,
        email: v.email,
        city: v.city,
        commune: v.commune || null,
        password: v.password,
      });
      if (res.session) navigate('/pro/profil', { replace: true });
      else setPendingEmail(v.email);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  if (pendingEmail) {
    return (
      <AuthLayout title="Vérifiez votre e-mail">
        <Notice tone="success" icon={<MailCheck className="h-5 w-5 text-emerald-300" />} title="Inscription enregistrée">
          Confirmez votre adresse via le lien envoyé à <strong className="text-white">{pendingEmail}</strong>, puis connectez-vous pour
          compléter votre profil professionnel et déposer vos documents.
        </Notice>
        <Link to="/connexion" className="mt-5 block text-center font-semibold text-electric-300">
          Aller à la connexion
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Devenir partenaire"
      subtitle="Mécaniciens, garages et dépanneurs : recevez des missions près de vous."
      footer={
        <>
          Déjà partenaire ?{' '}
          <Link className="font-semibold text-electric-300" to="/connexion">
            Se connecter
          </Link>
        </>
      }
    >
      <Notice tone="info" className="mb-5" icon={<BadgeCheck className="h-5 w-5 text-electric-300" />} title="Validation obligatoire">
        Chaque profil est vérifié par l’équipe SOS MOBILITÉ (identité, coordonnées, atelier) avant de pouvoir recevoir des missions.
      </Notice>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input label="Nom et prénom" autoComplete="name" {...register('full_name')} error={formState.errors.full_name?.message} />
        <Input label="Nom du garage / de l’entreprise" optional {...register('business_name')} error={formState.errors.business_name?.message} />
        <Input label="Téléphone professionnel" type="tel" inputMode="tel" placeholder="+225 07 00 00 00 00" {...register('phone')} error={formState.errors.phone?.message} />
        <Input label="Adresse e-mail" type="email" inputMode="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
        <LocationFields
          city={watch('city')}
          cityField={register('city', { onChange: () => setValue('commune', '') })}
          communeField={register('commune')}
          cityLabel="Ville principale d’intervention"
          communeLabel="Commune / quartier de l’atelier"
          cityError={formState.errors.city?.message}
        />
        <Input label="Mot de passe" type="password" autoComplete="new-password" {...register('password')} error={formState.errors.password?.message} />
        <Input label="Confirmer le mot de passe" type="password" autoComplete="new-password" {...register('password_confirm')} error={formState.errors.password_confirm?.message} />
        <Checkbox
          {...register('terms')}
          error={formState.errors.terms?.message}
          label="J’accepte les règles de prix, de comportement, d’annulation et de traitement des litiges de la plateforme, ainsi que la commission présentée avant activation."
        />
        {error && <ErrorState message={error} />}
        <Button type="submit" block size="lg" loading={formState.isSubmitting}>
          Créer mon compte professionnel
        </Button>
      </form>
    </AuthLayout>
  );
}
