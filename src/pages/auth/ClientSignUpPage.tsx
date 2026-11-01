import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Checkbox, Input } from '@/components/ui/Field';
import { LocationFields } from '@/components/forms/LocationFields';
import { Button } from '@/components/ui/Button';
import { ErrorState, Notice } from '@/components/ui/Display';
import { clientSignUpSchema } from '@/domain/validation';
import { signUpClient } from '@/services/auth.service';
import { errorMessage } from '@/lib/errors';

type Form = z.infer<typeof clientSignUpSchema>;

export default function ClientSignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('suite') === 'sos' ? '/client/sos' : '/client';

  const { register, handleSubmit, formState, watch, setValue } = useForm<Form>({ resolver: zodResolver(clientSignUpSchema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const res = await signUpClient({ full_name: v.full_name, phone: v.phone, email: v.email, city: v.city, commune: v.commune || null, password: v.password });
      if (res.session) navigate(next, { replace: true });
      else setPendingEmail(v.email);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  if (pendingEmail) {
    return (
      <AuthLayout title="Vérifiez votre e-mail">
        <Notice tone="success" icon={<MailCheck className="h-5 w-5 text-emerald-300" />} title="Compte créé">
          Un lien de confirmation a été envoyé à <strong className="text-white">{pendingEmail}</strong>. Cliquez dessus pour activer votre
          compte, puis connectez-vous.
        </Notice>
        <Link to="/connexion" className="mt-5 block text-center font-semibold text-electric-300">
          Aller à la connexion
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Créer mon compte"
      subtitle="Signalez une panne et suivez votre intervention en temps réel."
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link className="font-semibold text-electric-300" to="/connexion">
            Se connecter
          </Link>{' '}
          · Vous êtes mécanicien ?{' '}
          <Link className="font-semibold text-electric-300" to="/inscription/professionnel">
            Inscription pro
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input label="Nom complet" autoComplete="name" {...register('full_name')} error={formState.errors.full_name?.message} />
        <Input
          label="Téléphone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+225 07 00 00 00 00"
          hint="Le professionnel qui accepte votre mission pourra vous appeler."
          {...register('phone')}
          error={formState.errors.phone?.message}
        />
        <Input label="Adresse e-mail" type="email" inputMode="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
        <LocationFields
          city={watch('city')}
          cityField={register('city', { onChange: () => setValue('commune', '') })}
          communeField={register('commune')}
          cityError={formState.errors.city?.message}
        />
        <Input label="Mot de passe" type="password" autoComplete="new-password" hint="8 caractères minimum, avec lettres et chiffres." {...register('password')} error={formState.errors.password?.message} />
        <Input label="Confirmer le mot de passe" type="password" autoComplete="new-password" {...register('password_confirm')} error={formState.errors.password_confirm?.message} />
        <Checkbox
          {...register('terms')}
          error={formState.errors.terms?.message}
          label={
            <>
              J’accepte les conditions d’utilisation et la{' '}
              <Link to="/confidentialite" className="text-electric-300 underline" target="_blank">
                politique de confidentialité
              </Link>
              .
            </>
          }
        />
        {error && <ErrorState message={error} />}
        <Button type="submit" block size="lg" loading={formState.isSubmitting}>
          Créer mon compte
        </Button>
      </form>
    </AuthLayout>
  );
}
