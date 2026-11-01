import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Mail, Smartphone } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ErrorState, Notice, Segmented } from '@/components/ui/Display';
import { signInSchema } from '@/domain/validation';
import { sendPhoneOtp, signInWithPassword, verifyPhoneOtp } from '@/services/auth.service';
import { errorMessage } from '@/lib/errors';
import { env } from '@/config/env';
import { getMyProfile } from '@/services/profile.service';
import { homePathFor } from '@/hooks/useAuth';

type Form = z.infer<typeof signInSchema>;

export default function LoginPage() {
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from;

  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(signInSchema) });

  const goHome = async (userId: string) => {
    const profile = await getMyProfile(userId);
    navigate(from && from !== '/connexion' ? from : homePathFor(profile), { replace: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const { user } = await signInWithPassword(values.email, values.password);
      await goHome(user.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Accédez à votre espace client ou professionnel."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link className="font-semibold text-electric-300" to="/inscription">
            Créer un compte
          </Link>{' '}
          ·{' '}
          <Link className="font-semibold text-electric-300" to="/inscription/professionnel">
            Espace pro
          </Link>
        </>
      }
    >
      {params.get('confirme') && (
        <Notice tone="success" className="mb-4" title="Adresse confirmée">
          Vous pouvez maintenant vous connecter.
        </Notice>
      )}
      {env.enablePhoneAuth && (
        <Segmented
          className="mb-5"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'email', label: <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" />E-mail</span> },
            { value: 'phone', label: <span className="inline-flex items-center gap-2"><Smartphone className="h-4 w-4" />Téléphone</span> },
          ]}
        />
      )}
      {mode === 'email' ? (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Input label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" {...register('email')} error={formState.errors.email?.message} />
          <Input
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            error={formState.errors.password?.message}
          />
          {error && <ErrorState message={error} />}
          <Button type="submit" block size="lg" loading={formState.isSubmitting}>
            Se connecter
          </Button>
          <p className="text-center text-sm">
            <Link to="/mot-de-passe-oublie" className="text-silver-400 hover:text-white">
              Mot de passe oublié ?
            </Link>
          </p>
        </form>
      ) : (
        <PhoneLogin onDone={goHome} />
      )}
    </AuthLayout>
  );
}

function PhoneLogin({ onDone }: { onDone: (userId: string) => Promise<void> }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendPhoneOtp(phone);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const { user } = await verifyPhoneOtp(phone, code);
      if (user) await onDone(user.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Input label="Numéro de téléphone" type="tel" inputMode="tel" placeholder="+225 07 00 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent} />
      {sent && <Input label="Code reçu par SMS" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />}
      {error && <ErrorState message={error} />}
      {sent ? (
        <Button block size="lg" loading={busy} onClick={verify} disabled={code.length < 4}>
          Valider le code
        </Button>
      ) : (
        <Button block size="lg" loading={busy} onClick={send} disabled={phone.replace(/\D/g, '').length < 8}>
          Recevoir un code
        </Button>
      )}
    </div>
  );
}
