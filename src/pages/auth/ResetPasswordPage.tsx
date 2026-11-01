import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ErrorState, Notice } from '@/components/ui/Display';
import { passwordSchema } from '@/domain/validation';
import { updatePassword } from '@/services/auth.service';
import { errorMessage } from '@/lib/errors';
import { useAuth, homePathFor } from '@/hooks/useAuth';

export default function ResetPasswordPage() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = passwordSchema.safeParse(pwd);
    if (!check.success) return setError(check.error.issues[0]?.message ?? 'Mot de passe invalide');
    if (pwd !== confirm) return setError('Les mots de passe ne correspondent pas');
    setBusy(true);
    setError(null);
    try {
      await updatePassword(pwd);
      navigate(homePathFor(profile), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Nouveau mot de passe">
      {!session ? (
        <Notice tone="warning" title="Lien expiré ou invalide">
          Ouvrez cette page depuis le lien reçu par e-mail, ou demandez un nouveau lien.
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          <Input label="Confirmer" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <ErrorState message={error} />}
          <Button type="submit" block loading={busy}>
            Enregistrer
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
