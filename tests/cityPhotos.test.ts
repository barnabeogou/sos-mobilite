import { describe, expect, it } from 'vitest';
import { CITIES } from '../src/domain/cities';
import { CITY_PHOTOS, cityPhoto, photoCredit, photoSrcSet, photoUrl } from '../src/domain/cityPhotos';

describe('Photos des villes', () => {
  it('chaque photo correspond à une grande ville et est attribuée', () => {
    const slugs = new Set(CITIES.map((c) => c.slug));
    for (const p of Object.values(CITY_PHOTOS)) {
      expect(slugs.has(p.slug)).toBe(true);
      expect(p.author.length).toBeGreaterThan(1);
      expect(p.page).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(p.src).toMatch(/^https:\/\/(thumb|upload)\.wikimedia\.org\/wikipedia\/commons\//);
      expect(p.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
    }
    expect(cityPhoto('inconnue')).toBeNull();
  });

  it('passe par le CDN d’images en production, sans dépasser la taille de la source', () => {
    const p = CITY_PHOTOS.gagnoa;
    expect(photoUrl(p, 1920, true)).toBe(`/.netlify/images?url=${encodeURIComponent(p.src)}&w=1502&q=72`);
    expect(photoUrl(p, 1920, false)).toBe(p.src);
    expect(photoSrcSet(p, true)?.split(', ').map((s) => s.split(' ')[1])).toEqual(['480w', '768w', '1080w', '1440w']);
    expect(photoSrcSet(p, false)).toBeUndefined();
  });

  it('mentionne l’auteur et la licence', () => {
    expect(photoCredit(CITY_PHOTOS.abidjan)).toBe('Photo : Edison McCullen · CC BY 4.0');
    expect(photoCredit(CITY_PHOTOS.yamoussoukro)).toBe('Photo : Didierwiki (domaine public)');
  });
});
