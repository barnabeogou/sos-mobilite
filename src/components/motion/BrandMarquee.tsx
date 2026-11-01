import { Fragment } from 'react';

const UNIVERSES = [
  { name: 'AUTO', text: 'Voitures, taxis, VTC' },
  { name: 'MOTO', text: 'Motos, scooters, livreurs' },
  { name: 'MARINE', text: 'Jet-skis et bateaux' },
  { name: 'SERVICES', text: 'Entretien, réparation, dépannage' },
];

/** Les quatre univers de la marque, en bandeau défilant (statique si « réduire les animations »). */
export function BrandMarquee() {
  const items = (dup: boolean) =>
    UNIVERSES.map((u) => (
      <Fragment key={`${u.name}${dup ? '-2' : ''}`}>
        <span className={dup ? 'mq-item mq-dup' : 'mq-item'}>
          <span className="mq-name">
            SOS <span className="mq-outline">{u.name}</span>
          </span>
          <span className="mq-text">{u.text}</span>
          <span className="mq-sep" />
        </span>
      </Fragment>
    ));

  return (
    <>
      <ul className="sr-only">
        {UNIVERSES.map((u) => (
          <li key={u.name}>
            SOS {u.name} : {u.text}
          </li>
        ))}
      </ul>
      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {items(false)}
          {items(true)}
        </div>
      </div>
    </>
  );
}
