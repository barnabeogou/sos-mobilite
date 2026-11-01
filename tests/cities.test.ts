import { describe, expect, it } from 'vitest';
import { CITIES, CI_OUTLINE, LOCALITY_NAMES, MAP_SIZE, cityBySlug, findCity, findLocality, nearestCity, nearestLocality, project } from '../src/domain/cities';

describe('Villes de Côte d’Ivoire', () => {
  it('reconnaît une ville quelle que soit la saisie', () => {
    expect(findCity('bouake')?.slug).toBe('bouake');
    expect(findCity('San Pedro')?.name).toBe('San-Pédro');
    expect(findCity('YAMOUSSOUKRO')?.scene).toBe('basilica');
    expect(findCity('Divo')).toBeUndefined();
    expect(findLocality('divo')?.name).toBe('Divo');
    expect(cityBySlug('inconnue').slug).toBe('abidjan');
  });

  it('situe une position GPS dans la ville la plus proche', () => {
    expect(nearestLocality({ lat: 5.325, lng: -4.02 })?.locality.name).toBe('Abidjan');
    expect(nearestLocality({ lat: 7.69, lng: -5.03 })?.locality.name).toBe('Bouaké');
    expect(nearestLocality({ lat: 9.45, lng: -5.64 })?.locality.name).toBe('Korhogo');
    // En pleine mer : on ne prétend pas savoir
    expect(nearestLocality({ lat: 1, lng: -4 })).toBeNull();
    expect(nearestCity({ lat: 5.84, lng: -5.36 }).slug).toBe('gagnoa');
  });

  it('liste des villes triée, sans doublon', () => {
    expect(new Set(LOCALITY_NAMES).size).toBe(LOCALITY_NAMES.length);
    expect([...LOCALITY_NAMES].sort((a, b) => a.localeCompare(b, 'fr'))).toEqual(LOCALITY_NAMES);
    expect(CITIES).toHaveLength(10);
  });

  it('toutes les villes tombent sur la carte', () => {
    expect(CI_OUTLINE.startsWith('M')).toBe(true);
    expect(CI_OUTLINE.endsWith('Z')).toBe(true);
    for (const c of CITIES) {
      const [x, y] = project(c.lat, c.lng);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(MAP_SIZE);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(MAP_SIZE);
    }
  });
});
