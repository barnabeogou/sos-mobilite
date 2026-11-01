import { useState, type FormEvent } from 'react';
import { HandCoins, MessageSquareQuote } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Display';
import { Input, Textarea } from '@/components/ui/Field';
import { commissionSplit, formatFCFA, formatRate, offerBounds } from '@/domain/pricing';
import type { PriceOffer, Quote } from '@/types/database';

/**
 * Côté client : actions sur un devis en attente (valider, proposer un autre prix, refuser).
 * Les règles affichées sont les mêmes que celles appliquées par propose_price() côté base.
 */
export function ClientQuoteActions({
  quote,
  offers,
  acceptedTotal,
  maxOffers,
  minRatio,
  busy,
  onAccept,
  onReject,
  onPropose,
}: {
  quote: Quote;
  offers: PriceOffer[];
  acceptedTotal: number | null;
  maxOffers: number;
  minRatio: number;
  busy: string | null;
  onAccept: () => void;
  onReject: () => void;
  onPropose: (amount: number, message: string | null) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pending = offers.find((o) => o.quote_id === quote.id && o.status === 'pending');
  const lastOnQuote = offers.find((o) => o.quote_id === quote.id);
  const used = offers.length;
  const remaining = Math.max(0, maxOffers - used);
  const bounds = offerBounds(quote.total_amount, minRatio, acceptedTotal);
  const canPropose = !pending && remaining > 0 && bounds !== null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Math.round(Number(amount.replace(/\s/g, '')));
    if (!bounds || !Number.isFinite(n) || n < bounds.min || n > bounds.max) {
      setError(bounds ? `Indiquez un montant entre ${formatFCFA(bounds.min)} et ${formatFCFA(bounds.max)}.` : 'Montant impossible.');
      return;
    }
    setError(null);
    try {
      await onPropose(n, message.trim() || null);
      setOpen(false);
      setAmount('');
      setMessage('');
    } catch {
      /* le message d'erreur est affiché par l'appelant */
    }
  };

  return (
    <div className="mt-4 space-y-3">
      {pending ? (
        <Notice tone="info" icon={<HandCoins className="h-5 w-5" />} title={`Votre proposition : ${formatFCFA(pending.amount)}`}>
          En attente de la réponse du professionnel. Vous pouvez aussi valider le devis tel quel.
        </Notice>
      ) : lastOnQuote?.status === 'rejected' ? (
        <Notice tone="warning" title="Le professionnel maintient son prix">
          Votre proposition de {formatFCFA(lastOnQuote.amount)} n’a pas été retenue.
        </Notice>
      ) : null}

      <Button className="w-full" loading={busy === 'accept'} onClick={onAccept}>
        Valider le devis · {formatFCFA(quote.total_amount)}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={!canPropose} onClick={() => setOpen((v) => !v)}>
          Proposer un prix
        </Button>
        <Button variant="secondary" loading={busy === 'reject'} onClick={onReject}>
          Refuser
        </Button>
      </div>
      <p className="text-xs text-silver-500">
        {remaining > 0
          ? `Vous pouvez faire encore ${remaining} proposition${remaining > 1 ? 's' : ''} de prix pour cette demande.`
          : `Vous avez utilisé vos ${maxOffers} propositions de prix : validez ou refusez le devis.`}
      </p>

      {open && canPropose && bounds && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-night-950/40 p-4">
          <Input
            label="Votre prix"
            inputMode="numeric"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d\s]/g, ''))}
            suffix="FCFA"
            hint={`Entre ${formatFCFA(bounds.min)} et ${formatFCFA(bounds.max)}`}
            error={error ?? undefined}
          />
          <Textarea
            label="Message au professionnel"
            optional
            rows={2}
            maxLength={300}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex. : je fournis moi-même la pièce."
          />
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button type="submit" className="sm:flex-1" loading={busy === 'offer'}>
              Envoyer ma proposition
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Côté professionnel : réponse à la contre-proposition du client. */
export function MechanicOfferPanel({
  offer,
  quote,
  rate,
  busy,
  onAccept,
  onKeep,
  onCounter,
}: {
  offer: PriceOffer;
  quote: Quote;
  rate: number;
  busy: string | null;
  onAccept: () => void;
  onKeep: () => void;
  onCounter: () => void;
}) {
  const net = commissionSplit(offer.amount, rate).net;
  return (
    <div className="space-y-3 rounded-2xl border border-electric-500/40 bg-electric-500/10 p-4">
      <div className="flex items-start gap-3">
        <HandCoins className="mt-0.5 h-5 w-5 shrink-0 text-electric-300" aria-hidden />
        <div>
          <p className="font-bold">Le client propose {formatFCFA(offer.amount)}</p>
          <p className="text-sm text-silver-300">
            Votre devis : <span className="whitespace-nowrap">{formatFCFA(quote.total_amount)}</span> · écart{' '}
            <span className="whitespace-nowrap">{formatFCFA(quote.total_amount - offer.amount)}</span>
          </p>
          <p className="mt-0.5 text-xs text-silver-400">
            Votre part à ce prix : <span className="whitespace-nowrap">{formatFCFA(net)}</span> (commission {formatRate(rate)} déduite).
          </p>
        </div>
      </div>
      {offer.message && (
        <p className="flex gap-2 rounded-xl bg-night-950/50 p-3 text-sm text-silver-200">
          <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-silver-400" aria-hidden />« {offer.message} »
        </p>
      )}
      <Button className="w-full" loading={busy === 'offer-accept'} onClick={onAccept}>
        Accepter {formatFCFA(offer.amount)}
      </Button>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onCounter}>
          Proposer un autre montant
        </Button>
        <Button variant="secondary" loading={busy === 'offer-keep'} onClick={onKeep}>
          Garder mon prix
        </Button>
      </div>
    </div>
  );
}
