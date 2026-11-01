import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input, Select } from '@/components/ui/Field';
import { ABIDJAN_COMMUNES } from '@/domain/catalog';
import { LOCALITY_NAMES } from '@/domain/cities';

/**
 * Ville (toute la Côte d'Ivoire) puis commune ou quartier.
 * À Abidjan, la commune se choisit dans la liste officielle ; ailleurs, le quartier se saisit librement.
 * Le formulaire doit vider la commune quand la ville change (voir `register('city', { onChange })`).
 */
export function LocationFields({
  city,
  cityField,
  communeField,
  cityLabel = 'Ville',
  communeLabel = 'Commune / quartier',
  cityError,
  communeError,
  communeOptional = true,
}: {
  /** Valeur actuelle de la ville (watch). */
  city: string | undefined;
  cityField: UseFormRegisterReturn;
  communeField: UseFormRegisterReturn;
  cityLabel?: string;
  communeLabel?: string;
  cityError?: string;
  communeError?: string;
  communeOptional?: boolean;
}) {
  const known = !city || LOCALITY_NAMES.includes(city);
  return (
    <>
      <Select label={cityLabel} {...cityField} error={cityError}>
        <option value="">Choisir…</option>
        {!known && <option value={city}>{city}</option>}
        {LOCALITY_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Select>
      {city === 'Abidjan' ? (
        <Select label={communeLabel} optional={communeOptional} {...communeField} error={communeError}>
          <option value="">—</option>
          {ABIDJAN_COMMUNES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      ) : (
        <Input label={communeLabel} optional={communeOptional} placeholder={city ? 'Quartier' : 'Choisissez d’abord la ville'} disabled={!city} {...communeField} error={communeError} />
      )}
    </>
  );
}
