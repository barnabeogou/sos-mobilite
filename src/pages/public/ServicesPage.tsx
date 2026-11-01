import { NamedIcon, VehicleIcon } from '@/components/ui/Icon';
import { ButtonLink } from '@/components/ui/Button';
import { useCategories } from '@/hooks/queries';
import { REFERENCE_SERVICES, VEHICLE_TYPES } from '@/domain/catalog';
import { priceRangeLabel } from '@/domain/pricing';
import { EMERGENCY_NOTICE } from '@/domain/catalog';

export default function ServicesPage() {
  const { data } = useCategories();
  // Repli sur le catalogue de référence si la base n'est pas joignable (affichage seulement).
  const services =
    data?.map((c) => ({ ...c, price: priceRangeLabel(c.base_price_min, c.base_price_max) })) ??
    REFERENCE_SERVICES.map((s) => ({ ...s, price: null as string | null }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
      <h1 className="text-4xl font-extrabold">Nos services</h1>
      <p className="mt-3 max-w-2xl text-silver-300">
        Une seule plateforme pour l’assistance de tous vos moyens de transport motorisés. Le prix exact vous est toujours communiqué par
        devis, à valider avant l’intervention.
      </p>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {VEHICLE_TYPES.map((v) => (
          <div key={v.value} className="card flex items-center gap-4 p-5">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-electric-500/15 text-electric-300">
              <VehicleIcon type={v.value} className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display font-extrabold">{v.brand}</p>
              <p className="text-sm text-silver-400">{v.description}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-14 text-2xl font-bold">Types d’assistance</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((s) => (
          <article key={s.slug} className="card flex flex-col p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-alert-500/10 text-alert-500">
              <NamedIcon name={s.icon} className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-bold">{s.name}</h3>
            <p className="mt-1 flex-1 text-sm text-silver-400">{s.description}</p>
            <div className="mt-4 flex items-center gap-2 text-silver-500">
              {s.vehicle_types.map((t) => (
                <VehicleIcon key={t} type={t} className="h-4 w-4" />
              ))}
              {s.price && <span className="ml-auto text-xs font-semibold text-electric-300">{s.price}</span>}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-start gap-4 rounded-3xl border border-white/10 bg-night-850/60 p-6 md:flex-row md:items-center md:justify-between">
        <p className="max-w-2xl text-sm text-silver-400">{EMERGENCY_NOTICE}</p>
        <ButtonLink to="/inscription?suite=sos" variant="sos">
          Signaler une panne
        </ButtonLink>
      </div>
    </div>
  );
}
