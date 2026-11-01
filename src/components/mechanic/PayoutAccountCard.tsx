import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Card, Notice } from '@/components/ui/Display';
import { useToast } from '@/components/ui/Overlay';
import { useSettings } from '@/hooks/queries';
import { updateMyMechanicProfile } from '@/services/mechanic.service';
import { listMyPayouts, onlinePaymentEnabled, retryPayout } from '@/services/payments/providers';
import { PAYOUT_METHODS } from '@/domain/catalog';
import { phoneSchema } from '@/domain/validation';
import { errorMessage } from '@/lib/errors';
import type { MechanicProfile, PaymentMethod } from '@/types/database';

/** Compte Mobile Money sur lequel le professionnel reçoit sa part des paiements faits dans l'application. */
export function PayoutAccountCard({ mechanic }: { mechanic: MechanicProfile }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: settings } = useSettings();
  const [method, setMethod] = useState<PaymentMethod | ''>(mechanic.payout_method ?? '');
  const [phone, setPhone] = useState(mechanic.payout_phone ?? '');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMethod(mechanic.payout_method ?? '');
    setPhone(mechanic.payout_phone ?? '');
  }, [mechanic.payout_method, mechanic.payout_phone]);

  const save = async () => {
    if (!method) return setError('Choisissez un opérateur.');
    const parsed = phoneSchema.safeParse(phone.trim());
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Numéro invalide.');
    setError(undefined);
    setSaving(true);
    try {
      await updateMyMechanicProfile(mechanic.id, { payout_method: method, payout_phone: parsed.data });
      void qc.invalidateQueries({ queryKey: ['mechanic-profile', mechanic.id] });
      // Des versements attendaient ce compte (ou avaient échoué) : on les relance.
      let resent = 0;
      if (onlinePaymentEnabled(settings)) {
        const waiting = (await listMyPayouts(mechanic.id)).filter((p) => (p.status === 'pending' || p.status === 'failed') && p.amount > 0);
        for (const p of waiting) {
          try {
            const r = await retryPayout(p.id);
            if (r.status !== 'manual') resent++;
          } catch {
            /* l'équipe reprend les versements en échec depuis l'administration */
          }
        }
        void qc.invalidateQueries({ queryKey: ['my-payouts', mechanic.id] });
      }
      toast.success(resent ? `Compte enregistré. ${resent} versement(s) relancé(s).` : 'Compte de versement enregistré.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const missing = !mechanic.payout_method || !mechanic.payout_phone;

  return (
    <Card>
      <p className="flex items-center gap-2 font-bold">
        <Wallet className="h-5 w-5 text-electric-300" /> Compte de versement
      </p>
      <p className="mt-1 text-sm text-silver-400">
        Quand un client paie dans l’application, votre part (montant moins la commission) est envoyée automatiquement sur ce numéro Mobile Money.
      </p>
      {missing && (
        <Notice tone="warning" className="mt-3">
          Aucun compte renseigné : vos versements restent en attente tant que ce numéro n’est pas enregistré.
        </Notice>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Select label="Opérateur" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}>
          <option value="">Choisir…</option>
          {PAYOUT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
        <Input
          label="Numéro"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+225 07 00 00 00 00"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={error}
        />
      </div>
      <p className="mt-2 text-xs text-silver-500">Le numéro doit être à votre nom. Vérifiez-le bien : un envoi vers un mauvais numéro ne peut pas être annulé.</p>
      <Button className="mt-4" loading={saving} onClick={save}>
        Enregistrer le compte
      </Button>
    </Card>
  );
}
