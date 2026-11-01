import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ErrorState, Notice } from '@/components/ui/Display';
import { sendPasswordReset } from '@/services/auth.service';
import { errorMessage } from '@/lib/errors';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Recevez un lien pour choisir un nouveau mot de passe." footer={<Link to="/connexion" className="font-semibold text-electric-300">Retour à la connexion</Link>}>
      {sent ? (
        <Notice tone="success" title="E-mail envoyé">
          Si un compte existe pour cette adresse, vous recevrez un lien de réinitialisation dans quelques minutes.
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Adresse e-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          {error && <ErrorState message={error} />}
          <Button type="submit" block loading={busy} disabled={!email.includes('@')}>
            Envoyer le lien
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
