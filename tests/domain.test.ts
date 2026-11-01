import { describe, expect, it } from 'vitest';
import { commissionSplit, formatFCFA, offerBounds, priceRangeLabel, quoteTotal } from '@/domain/pricing';
import { addDaysISO, computeReminders, daysLabel, daysUntil } from '@/domain/reminders';
import { distanceKm, formatDistance } from '@/domain/geo';
import { ACTIVE_STATUSES, CLIENT_CAN_CANCEL, progressIndex, REQUEST_STATUS, TIMELINE_STEPS } from '@/domain/status';
import { clientSignUpSchema, quoteSchema, vehicleSchema } from '@/domain/validation';
import { REFERENCE_SERVICES } from '@/domain/catalog';
import type { MaintenanceRecord, RequestStatus, Vehicle } from '@/types/database';

describe('pricing', () => {
  it('formate les montants en FCFA avec espaces', () => {
    expect(formatFCFA(20000)).toBe('20 000 FCFA');
    expect(formatFCFA(1500)).toBe('1 500 FCFA');
    expect(formatFCFA(null)).toBe('—');
  });

  it('calcule le total du devis en ignorant les valeurs invalides', () => {
    expect(quoteTotal({ labor: 12000, parts: 6000, travel: 2000 })).toBe(20000);
    expect(quoteTotal({ labor: -5, parts: Number.NaN, travel: 1000 })).toBe(1000);
  });

  it('reproduit la commission de declare_payment (arrondi)', () => {
    // Exemple du plan financier : 20 000 F à 10 % → 2 000 F
    expect(commissionSplit(20000, 0.1)).toEqual({ commission: 2000, net: 18000 });
    // Cas testé côté SQL : 23 000 F à 12 % → 2 760 F
    expect(commissionSplit(23000, 0.12)).toEqual({ commission: 2760, net: 20240 });
  });

  it('affiche une fourchette uniquement si l’administration l’a définie', () => {
    expect(priceRangeLabel(null, null)).toBeNull();
    expect(priceRangeLabel(5000, 15000)).toBe('5 000 FCFA – 15 000 FCFA');
    expect(priceRangeLabel(5000, null)).toBe('À partir de 5 000 FCFA');
  });

  it('borne les contre-propositions comme propose_price() côté base', () => {
    // Devis de 20 000 F, plancher 50 % : entre 10 000 et 19 999 F
    expect(offerBounds(20000, 0.5)).toEqual({ min: 10000, max: 19999 });
    // Supplément : total proposé 30 000 F, 20 000 F déjà validés → au-dessus de 20 000 F
    expect(offerBounds(30000, 0.5, 20000)).toEqual({ min: 20001, max: 29999 });
    // Aucune marge possible
    expect(offerBounds(1, 0.5)).toBeNull();
  });
});

describe('statuts', () => {
  it('chaque statut a un libellé et des messages client/pro', () => {
    for (const s of Object.keys(REQUEST_STATUS) as RequestStatus[]) {
      expect(REQUEST_STATUS[s].label.length).toBeGreaterThan(2);
      expect(REQUEST_STATUS[s].client.length).toBeGreaterThan(5);
      expect(REQUEST_STATUS[s].mechanic.length).toBeGreaterThan(5);
    }
  });

  it('suit l’ordre du workflow du cahier des charges', () => {
    expect(TIMELINE_STEPS.map((s) => s.key)).toEqual([
      'searching',
      'accepted',
      'quoted',
      'quote_accepted',
      'en_route',
      'in_progress',
      'completed',
      'paid',
    ]);
    expect(progressIndex('searching')).toBe(0);
    expect(progressIndex('paid')).toBe(7);
    expect(progressIndex('closed')).toBe(TIMELINE_STEPS.length);
    expect(progressIndex('cancelled')).toBe(-1);
  });

  it('les règles d’annulation correspondent à cancel_request()', () => {
    expect(CLIENT_CAN_CANCEL).toEqual(['searching', 'accepted', 'quoted', 'quote_accepted', 'en_route']);
    expect(ACTIVE_STATUSES).not.toContain('paid');
  });
});

describe('Mon véhicule — rappels', () => {
  const today = new Date(2026, 9, 31); // 31 octobre 2026
  const vehicle: Vehicle = {
    id: 'v1',
    owner_id: 'u1',
    type: 'moto',
    brand: 'Yamaha',
    model: 'Crypton',
    year: 2020,
    plate: null,
    color: null,
    insurance_expires_at: '2026-11-20',
    created_at: '',
    updated_at: '',
  };
  const rec = (kind: MaintenanceRecord['kind'], performed: string, next: string | null): MaintenanceRecord => ({
    id: `${kind}-${performed}`,
    vehicle_id: 'v1',
    owner_id: 'u1',
    kind,
    performed_at: performed,
    mileage_km: null,
    cost: null,
    next_due_at: next,
    notes: null,
    created_at: '',
  });

  it('calcule les jours restants sans décalage de fuseau', () => {
    expect(daysUntil('2026-10-31', today)).toBe(0);
    expect(daysUntil('2026-11-01', today)).toBe(1);
    expect(daysUntil('2026-10-25', today)).toBe(-6);
    expect(addDaysISO('2026-10-31', 90)).toBe('2027-01-29');
  });

  it('alerte assurance à 30 jours et vidange à 15 jours, en ne gardant que le dernier entretien', () => {
    const r = computeReminders(
      [vehicle],
      [rec('vidange', '2026-05-01', '2026-08-01'), rec('vidange', '2026-08-05', '2026-11-05'), rec('pneus', '2026-01-01', '2027-01-01')],
      today,
    );
    expect(r.map((x) => [x.kind, x.daysLeft])).toEqual([
      ['maintenance', 5],
      ['insurance', 20],
    ]);
    expect(r[0].title).toContain('Vidange');
  });

  it('signale une assurance expirée', () => {
    const r = computeReminders([{ ...vehicle, insurance_expires_at: '2026-10-01' }], [], today);
    expect(r[0].level).toBe('overdue');
    expect(daysLabel(r[0].daysLeft)).toBe('depuis 30 jours');
  });
});

describe('géographie', () => {
  it('distance Plateau → Cocody cohérente avec public.distance_km', () => {
    const d = distanceKm({ lat: 5.3197, lng: -4.0167 }, { lat: 5.325, lng: -4.02 });
    expect(d).toBeGreaterThan(0.6);
    expect(d).toBeLessThan(0.8);
  });
  it('formate mètres et kilomètres', () => {
    expect(formatDistance(0.42)).toBe('400 m');
    expect(formatDistance(2.64)).toBe('2,6 km');
  });
});

describe('validation', () => {
  it('refuse un devis à zéro', () => {
    expect(quoteSchema.safeParse({ labor: 0, parts: 0, travel: 0 }).success).toBe(false);
    expect(quoteSchema.safeParse({ labor: '12000', parts: '0', travel: '2000' }).success).toBe(true);
  });
  it('exige des mots de passe identiques et l’acceptation des conditions', () => {
    const base = { full_name: 'Awa K.', phone: '+225 07 00 00 00 00', email: 'awa@example.com', password: 'motdepasse1', password_confirm: 'motdepasse1', terms: true };
    expect(clientSignUpSchema.safeParse(base).success).toBe(true);
    expect(clientSignUpSchema.safeParse({ ...base, password_confirm: 'autre1234' }).success).toBe(false);
    expect(clientSignUpSchema.safeParse({ ...base, terms: false }).success).toBe(false);
    expect(clientSignUpSchema.safeParse({ ...base, phone: '12' }).success).toBe(false);
  });
  it('accepte un véhicule sans année ni plaque', () => {
    expect(vehicleSchema.safeParse({ type: 'marine', brand: 'Yamaha', model: 'VX', year: '', plate: '' }).success).toBe(true);
  });
});

describe('catalogue', () => {
  it('reprend les 7 types d’assistance du cahier des charges + nautique', () => {
    expect(REFERENCE_SERVICES.map((s) => s.slug)).toEqual([
      'depannage_mecanique',
      'batterie',
      'crevaison',
      'remorquage',
      'carburant',
      'ouverture_vehicule',
      'assistance_marine',
      'autre',
    ]);
  });
});
