import type { MaintenanceRecord, Vehicle } from '@/types/database';
import { maintenanceLabel } from './catalog';

export type ReminderLevel = 'overdue' | 'soon';

export interface VehicleReminder {
  vehicleId: string;
  kind: 'insurance' | 'maintenance';
  level: ReminderLevel;
  title: string;
  dueDate: string;
  daysLeft: number;
}

const DAY = 86_400_000;

/** Différence en jours calendaires (dates ISO AAAA-MM-JJ), indépendante du fuseau. */
export function daysUntil(isoDate: string, today: Date = new Date()): number {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / DAY);
}

export const INSURANCE_WARNING_DAYS = 30;
export const MAINTENANCE_WARNING_DAYS = 15;

/**
 * Rappels « Mon véhicule » : assurance qui expire bientôt et entretiens à prévoir.
 * Pour chaque type d'entretien, seul l'enregistrement le plus récent est pris en compte.
 */
export function computeReminders(
  vehicles: Vehicle[],
  records: MaintenanceRecord[],
  today: Date = new Date(),
): VehicleReminder[] {
  const out: VehicleReminder[] = [];

  for (const v of vehicles) {
    const name = `${v.brand} ${v.model}`;
    if (v.insurance_expires_at) {
      const days = daysUntil(v.insurance_expires_at, today);
      if (days <= INSURANCE_WARNING_DAYS) {
        out.push({
          vehicleId: v.id,
          kind: 'insurance',
          level: days < 0 ? 'overdue' : 'soon',
          title: days < 0 ? `Assurance expirée — ${name}` : `Assurance à renouveler — ${name}`,
          dueDate: v.insurance_expires_at,
          daysLeft: days,
        });
      }
    }

    const latestByKind = new Map<string, MaintenanceRecord>();
    for (const r of records.filter((r) => r.vehicle_id === v.id)) {
      const prev = latestByKind.get(r.kind);
      if (!prev || r.performed_at > prev.performed_at) latestByKind.set(r.kind, r);
    }
    for (const r of latestByKind.values()) {
      if (!r.next_due_at) continue;
      const days = daysUntil(r.next_due_at, today);
      if (days <= MAINTENANCE_WARNING_DAYS) {
        out.push({
          vehicleId: v.id,
          kind: 'maintenance',
          level: days < 0 ? 'overdue' : 'soon',
          title: `${maintenanceLabel(r.kind)} ${days < 0 ? 'en retard' : 'à prévoir'} — ${name}`,
          dueDate: r.next_due_at,
          daysLeft: days,
        });
      }
    }
  }

  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function daysLabel(days: number): string {
  if (days === 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  if (days > 1) return `dans ${days} jours`;
  if (days === -1) return 'depuis hier';
  return `depuis ${-days} jours`;
}

export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
