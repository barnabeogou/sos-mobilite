import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Card, ErrorState, LoadingBlock, Notice, PageHeader } from '@/components/ui/Display';
import { useToast } from '@/components/ui/Overlay';
import { NamedIcon } from '@/components/ui/Icon';
import { hasAdminLevel } from '@/components/layout/Guards';
import { listAllSettings, updateCategory, updateSetting } from '@/services/admin.service';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { ServiceCategory } from '@/types/database';

const NUMERIC_KEYS = new Set([
  'commission_rate_starter',
  'commission_rate_pro',
  'pro_plan_monthly_fee',
  'proposal_timeout_minutes',
  'default_search_radius_km',
  'max_search_radius_km',
  'max_proposals_per_round',
]);

export default function AdminSettings() {
  const me = useProfile();
  const canEdit = hasAdminLevel(me.admin_level, 'super_admin');
  const qc = useQueryClient();
  const toast = useToast();
  const cats = useCategories(true);
  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: listAllSettings });

  const saveCategory = async (c: ServiceCategory, patch: Partial<ServiceCategory>) => {
    try {
      await updateCategory(c.id, patch);
      toast.success(`« ${c.name} » mis à jour.`);
      void qc.invalidateQueries({ queryKey: ['categories'] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader title="Tarifs & paramètres" subtitle="Catalogue des services, fourchettes indicatives et règles de la plateforme." />
      {!canEdit && (
        <Notice tone="info" className="mb-5">
          Consultation seule : la modification est réservée aux super administrateurs.
        </Notice>
      )}

      <h2 className="mb-3 text-lg font-bold">Catégories de services</h2>
      <p className="mb-4 text-sm text-silver-400">
        Les fourchettes sont indicatives et affichées aux clients. Laissez vide tant qu’elles ne sont pas validées par des devis réels. Le prix exact est
        toujours fixé par le devis du professionnel.
      </p>
      {cats.isLoading ? (
        <LoadingBlock />
      ) : cats.isError ? (
        <ErrorState message={errorMessage(cats.error)} />
      ) : (
        <div className="space-y-3">
          {(cats.data ?? []).map((c) => (
            <CategoryRow key={c.id} category={c} canEdit={canEdit} onSave={saveCategory} />
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-bold">Paramètres</h2>
      {settings.isLoading ? (
        <LoadingBlock />
      ) : settings.isError ? (
        <ErrorState message={errorMessage(settings.error)} />
      ) : (
        <div className="space-y-3">
          {(settings.data ?? []).map((s) => (
            <SettingRow
              key={s.key}
              setting={s}
              canEdit={canEdit}
              onSave={async (value) => {
                try {
                  await updateSetting(s.key, value);
                  toast.success('Paramètre enregistré.');
                  void qc.invalidateQueries({ queryKey: ['admin-settings'] });
                  void qc.invalidateQueries({ queryKey: ['settings'] });
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function toInt(v: string): number | null {
  const n = Number(v.replace(/\s/g, ''));
  return v.trim() === '' || !Number.isFinite(n) ? null : Math.round(n);
}

function CategoryRow({ category: c, canEdit, onSave }: { category: ServiceCategory; canEdit: boolean; onSave: (c: ServiceCategory, p: Partial<ServiceCategory>) => Promise<void> }) {
  const [min, setMin] = useState(c.base_price_min?.toString() ?? '');
  const [max, setMax] = useState(c.base_price_max?.toString() ?? '');
  const [travel, setTravel] = useState(c.travel_fee?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <NamedIcon name={c.icon} className="h-5 w-5 text-electric-300" />
        <p className="flex-1 font-semibold">{c.name}</p>
        <label className="inline-flex items-center gap-2 text-sm text-silver-300">
          <input
            type="checkbox"
            checked={c.is_active}
            disabled={!canEdit}
            onChange={(e) => void onSave(c, { is_active: e.target.checked })}
            className="h-4 w-4 accent-electric-500"
          />
          Actif
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Input label="Prix min." inputMode="numeric" suffix="FCFA" value={min} onChange={(e) => setMin(e.target.value)} disabled={!canEdit} />
        <Input label="Prix max." inputMode="numeric" suffix="FCFA" value={max} onChange={(e) => setMax(e.target.value)} disabled={!canEdit} />
        <Input label="Déplacement indicatif" inputMode="numeric" suffix="FCFA" value={travel} onChange={(e) => setTravel(e.target.value)} disabled={!canEdit} />
        {canEdit && (
          <Button
            icon={<Save className="h-4 w-4" />}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(c, { base_price_min: toInt(min), base_price_max: toInt(max), travel_fee: toInt(travel) });
              setBusy(false);
            }}
          >
            Enregistrer
          </Button>
        )}
      </div>
    </Card>
  );
}

function SettingRow({
  setting,
  canEdit,
  onSave,
}: {
  setting: { key: string; value: unknown; description: string | null; updated_at: string };
  canEdit: boolean;
  onSave: (value: unknown) => Promise<void>;
}) {
  const numeric = NUMERIC_KEYS.has(setting.key);
  const [value, setValue] = useState(setting.value == null ? '' : String(setting.value));
  const [busy, setBusy] = useState(false);
  const parsed = numeric ? Number(value.replace(',', '.')) : value.trim();
  const invalid = numeric && (value.trim() === '' || !Number.isFinite(parsed as number) || (parsed as number) < 0);

  return (
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
        <div>
          <p className="font-semibold">{setting.description ?? setting.key}</p>
          <p className="font-mono text-xs text-silver-500">
            {setting.key} · modifié le {formatDateTime(setting.updated_at)}
          </p>
        </div>
        <Input
          aria-label={setting.key}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!canEdit}
          inputMode={numeric ? 'decimal' : 'text'}
          placeholder={numeric ? '' : 'Non renseigné'}
          error={invalid ? 'Valeur numérique attendue' : undefined}
        />
        {canEdit && (
          <Button
            variant="secondary"
            disabled={invalid}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(numeric ? parsed : (parsed as string));
              setBusy(false);
            }}
          >
            Enregistrer
          </Button>
        )}
      </div>
      {setting.key.startsWith('commission_rate') && <p className="mt-2 text-xs text-silver-500">Taux décimal : 0.12 = 12 %.</p>}
    </Card>
  );
}
