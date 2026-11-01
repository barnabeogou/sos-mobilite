import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingBlock, Notice } from '@/components/ui/Display';
import { getRequestDetail } from '@/services/requests.service';
import { formatFCFA, formatRate } from '@/domain/pricing';
import { paymentMethodLabel } from '@/domain/catalog';
import { formatDate, formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { BRAND } from '@/config/env';

/**
 * Reçu d'intervention (imprimable / « Enregistrer en PDF » du navigateur).
 * Les mentions légales et fiscales définitives doivent être validées par un comptable local.
 */
export default function ReceiptPage() {
  const { id = '' } = useParams();
  const profile = useProfile();
  const { data: categories } = useCategories();
  const q = useQuery({ queryKey: ['request', id], queryFn: () => getRequestDetail(id) });

  if (q.isLoading) return <LoadingBlock />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} />;
  const { request, payment, quotes, mechanic, client, vehicle } = q.data;
  const quote = quotes.find((x) => x.id === payment?.quote_id);
  const back = profile.role === 'mechanic' ? `/pro/missions/${id}` : profile.role === 'admin' ? `/admin/demandes/${id}` : `/client/demandes/${id}`;

  if (!payment || payment.status !== 'confirmed' || !quote) {
    return (
      <Notice tone="warning" title="Reçu indisponible">
        Le reçu est émis une fois le paiement confirmé par le client.
      </Notice>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link to={back} className="inline-flex items-center gap-2 text-sm font-semibold text-silver-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <Button variant="secondary" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
          Imprimer / PDF
        </Button>
      </div>

      <article className="print-sheet rounded-3xl bg-white p-6 text-ink sm:p-10">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="whitespace-nowrap font-display text-xl font-extrabold text-[#0B1F33] sm:text-2xl">
              SOS <span className="text-[#E30613]">MOBILITÉ</span>
            </p>
            <p className="text-xs text-slate-500">{BRAND.slogan}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-slate-500">Reçu</p>
            <p className="whitespace-nowrap font-mono text-sm font-bold text-[#0B1F33] sm:text-lg">{payment.receipt_number}</p>
            <p className="text-xs text-slate-500">{formatDate(payment.confirmed_at)}</p>
          </div>
        </header>

        <section className="grid gap-4 border-b border-slate-200 py-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Client</p>
            <p className="font-semibold">{client?.full_name}</p>
            {client?.phone && <p className="text-slate-600">{client.phone}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Professionnel</p>
            <p className="font-semibold">{mechanic?.display_name}</p>
            {mechanic?.phone && <p className="text-slate-600">{mechanic.phone}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Intervention</p>
            <p className="font-semibold">{categories?.find((c) => c.id === request.category_id)?.name ?? 'Assistance'}</p>
            <p className="text-slate-600">
              N° {request.reference} · {formatDateTime(request.completed_at)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Véhicule</p>
            <p className="font-semibold">{vehicle ? `${vehicle.brand} ${vehicle.model}` : '—'}</p>
            {vehicle?.plate && <p className="text-slate-600">{vehicle.plate}</p>}
          </div>
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-3 font-medium">Désignation</th>
              <th className="py-3 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quote.labor_amount > 0 && (
              <tr>
                <td className="py-2.5">{quote.offer_id ? 'Prestation — prix négocié avec le client' : 'Diagnostic et main-d’œuvre'}</td>
                <td className="py-2.5 text-right">{formatFCFA(quote.labor_amount)}</td>
              </tr>
            )}
            {quote.parts_amount > 0 && (
              <tr>
                <td className="py-2.5">Pièces</td>
                <td className="py-2.5 text-right">{formatFCFA(quote.parts_amount)}</td>
              </tr>
            )}
            {quote.travel_amount > 0 && (
              <tr>
                <td className="py-2.5">Déplacement</td>
                <td className="py-2.5 text-right">{formatFCFA(quote.travel_amount)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#0B1F33]">
              <td className="py-3 font-bold">Total payé</td>
              <td className="py-3 text-right font-display text-xl font-extrabold">{formatFCFA(payment.amount)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-2 text-sm text-slate-600">
          Moyen de paiement : {paymentMethodLabel(payment.method)} — payé directement au professionnel, confirmé par le client le{' '}
          {formatDateTime(payment.confirmed_at)}.
        </p>

        {profile.role !== 'client' && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold">Répartition (visible par le professionnel et l’administration)</p>
            <p>
              Commission plateforme ({formatRate(Number(payment.commission_rate))}) : {formatFCFA(payment.commission_amount)} · Part du professionnel :{' '}
              {formatFCFA(payment.mechanic_net)}
            </p>
          </div>
        )}

        <footer className="mt-8 border-t border-slate-200 pt-4 text-[11px] text-slate-500">
          {BRAND.name} — plateforme de mise en relation, {BRAND.city}, {BRAND.country}. Document récapitulatif de l’intervention ; les mentions
          légales et fiscales définitives sont à compléter après validation par un professionnel comptable.
        </footer>
      </article>
    </div>
  );
}
