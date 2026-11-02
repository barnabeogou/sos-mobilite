import { ExternalLink } from 'lucide-react';
import { CITIES } from '@/domain/cities';
import { CITY_PHOTOS, PHOTO_EDITS, photoUrl } from '@/domain/cityPhotos';

/** Crédits des photos des villes (attribution exigée par les licences Creative Commons). */
export default function PhotoCreditsPage() {
  const rows = CITIES.filter((c) => CITY_PHOTOS[c.slug]).map((c) => ({ city: c, photo: CITY_PHOTOS[c.slug] }));
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-12 md:px-8">
      <h1 className="text-3xl font-extrabold">Crédits photos</h1>
      <p className="text-silver-300">
        Les photos des villes proviennent de <span className="text-white">Wikimedia Commons</span> et sont publiées par leurs auteurs sous
        licence libre. Elles ont été {PHOTO_EDITS} pour l’application ; les versions modifiées sont diffusées sous la même licence que
        l’original.
      </p>
      <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-night-850/60">
        {rows.map(({ city, photo }) => (
          <li key={city.slug} id={city.slug} className="flex gap-4 p-4">
            <img
              src={photoUrl(photo, 480)}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-16 w-24 shrink-0 rounded-lg object-cover"
              style={{ objectPosition: photo.position }}
            />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-white">
                {city.name} — {photo.caption}
              </p>
              <p className="mt-0.5 text-silver-400">
                Auteur : {photo.author} · Licence :{' '}
                <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-electric-300 hover:underline">
                  {photo.license === 'CC0' ? 'CC0 (domaine public)' : photo.license}
                </a>
              </p>
              <a href={photo.page} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-electric-300 hover:underline">
                Voir l’original sur Wikimedia Commons <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-silver-500">Les villes sans photo sont illustrées par l’équipe SOS MOBILITÉ.</p>
    </article>
  );
}
