import { db } from '@/lib/supabase';
import type { MaintenanceKind, MaintenanceRecord, Vehicle, VehicleType } from '@/types/database';
import { unwrap, unwrapList } from './_helpers';

export interface VehicleInput {
  type: VehicleType;
  brand: string;
  model: string;
  year: number | null;
  plate: string | null;
  color: string | null;
  insurance_expires_at: string | null;
}

export function listMyVehicles(userId: string): Promise<Vehicle[]> {
  return unwrapList<Vehicle>(db().from('vehicles').select('*').eq('owner_id', userId).order('created_at'));
}

export function createVehicle(userId: string, input: VehicleInput): Promise<Vehicle> {
  return unwrap<Vehicle>(
    db()
      .from('vehicles')
      .insert({ ...input, plate: input.plate?.toUpperCase() ?? null, owner_id: userId })
      .select('*')
      .single(),
  );
}

export function updateVehicle(id: string, input: VehicleInput): Promise<Vehicle> {
  return unwrap<Vehicle>(
    db()
      .from('vehicles')
      .update({ ...input, plate: input.plate?.toUpperCase() ?? null })
      .eq('id', id)
      .select('*')
      .single(),
  );
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await db().from('vehicles').delete().eq('id', id);
  if (error) throw error;
}

export function getVehicle(id: string): Promise<Vehicle | null> {
  return unwrap<Vehicle | null>(db().from('vehicles').select('*').eq('id', id).maybeSingle());
}

export interface MaintenanceInput {
  kind: MaintenanceKind;
  performed_at: string;
  mileage_km: number | null;
  cost: number | null;
  next_due_at: string | null;
  notes: string | null;
}

export function listMaintenance(userId: string): Promise<MaintenanceRecord[]> {
  return unwrapList<MaintenanceRecord>(
    db().from('maintenance_records').select('*').eq('owner_id', userId).order('performed_at', { ascending: false }),
  );
}

export function addMaintenance(userId: string, vehicleId: string, input: MaintenanceInput): Promise<MaintenanceRecord> {
  return unwrap<MaintenanceRecord>(
    db()
      .from('maintenance_records')
      .insert({ ...input, vehicle_id: vehicleId, owner_id: userId })
      .select('*')
      .single(),
  );
}

export async function deleteMaintenance(id: string): Promise<void> {
  const { error } = await db().from('maintenance_records').delete().eq('id', id);
  if (error) throw error;
}
