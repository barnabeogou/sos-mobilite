import { useRef } from 'react';
import { MapPin } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { CITIES, type City } from '@/domain/cities';
import { cityPhoto } from '@/domain/cityPhotos';
import { CityScene } from './CityScene';
import { usePauseOffscreen } from './CityHero';

function Tile({ city, delay }: { city: City; delay: number }) {
  const ref = useRef<HTMLElement>(null);
  usePauseOffscreen(ref);
  return (
    <Reveal as="figure" delay={delay} className="city-tile group relative overflow-hidden rounded-2xl border border-white/10 bg-night-950">
      <div ref={ref as React.RefObject<HTMLDivElement>} className="aspect-[4/3] transition-transform duration-700 ease-out group-hover:scale-[1.06]">
        <CityScene city={city} showName={false} framing="center" />
      </div>
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-night-950 via-night-950/70 to-transparent px-3 pb-3 pt-10">
        <span className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-white">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-alert-500" aria-hidden />
          {city.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-silver-400">{cityPhoto(city.slug)?.caption ?? city.landmark}</span>
      </figcaption>
    </Reveal>
  );
}

/** Les grandes villes du pays, chacune avec son monument (accueil public). */
export function CityTiles() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CITIES.map((c, i) => (
        <Tile key={c.slug} city={c} delay={(i % 5) * 70} />
      ))}
    </div>
  );
}
