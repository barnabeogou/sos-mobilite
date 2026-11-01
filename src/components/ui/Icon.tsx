import {
  Activity,
  BatteryCharging,
  BatteryLow,
  Bike,
  Car,
  CircleDot,
  CircleEllipsis,
  Fuel,
  Gauge,
  KeyRound,
  Sailboat,
  Ship,
  Thermometer,
  TriangleAlert,
  Truck,
  Wind,
  Wrench,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import type { VehicleType } from '@/types/database';

const ICONS: Record<string, LucideIcon> = {
  wrench: Wrench,
  'battery-charging': BatteryCharging,
  'battery-low': BatteryLow,
  'circle-dot': CircleDot,
  truck: Truck,
  fuel: Fuel,
  'key-round': KeyRound,
  sailboat: Sailboat,
  'circle-ellipsis': CircleEllipsis,
  car: Car,
  activity: Activity,
  gauge: Gauge,
  wind: Wind,
  thermometer: Thermometer,
  'triangle-alert': TriangleAlert,
};

/** Icône par nom (catalogue en base) avec repli sûr. */
export function NamedIcon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = ICONS[name] ?? Wrench;
  return <Cmp aria-hidden {...props} />;
}

export function VehicleIcon({ type, ...props }: { type: VehicleType } & LucideProps) {
  const Cmp = type === 'moto' ? Bike : type === 'marine' ? Ship : Car;
  return <Cmp aria-hidden {...props} />;
}
