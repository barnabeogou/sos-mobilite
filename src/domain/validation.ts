import { z } from 'zod';

const phoneRegex = /^\+?[0-9 ]{8,20}$/;

export const phoneSchema = z
  .string()
  .trim()
  .regex(phoneRegex, 'Numéro invalide (ex. +225 07 00 00 00 00)');

export const passwordSchema = z
  .string()
  .min(8, '8 caractères minimum')
  .regex(/[A-Za-z]/, 'Au moins une lettre')
  .regex(/[0-9]/, 'Au moins un chiffre');

export const signInSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const clientSignUpSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Nom requis').max(120),
    phone: phoneSchema,
    email: z.string().trim().email('Adresse e-mail invalide'),
    commune: z.string().trim().max(80).optional().or(z.literal('')),
    password: passwordSchema,
    password_confirm: z.string(),
    terms: z.literal(true, { errorMap: () => ({ message: 'Acceptation requise' }) }),
  })
  .refine((d) => d.password === d.password_confirm, { path: ['password_confirm'], message: 'Les mots de passe ne correspondent pas' });

export const mechanicSignUpSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Nom requis').max(120),
    business_name: z.string().trim().max(120).optional().or(z.literal('')),
    phone: phoneSchema,
    email: z.string().trim().email('Adresse e-mail invalide'),
    commune: z.string().trim().min(2, 'Commune requise').max(80),
    password: passwordSchema,
    password_confirm: z.string(),
    terms: z.literal(true, { errorMap: () => ({ message: 'Acceptation requise' }) }),
  })
  .refine((d) => d.password === d.password_confirm, { path: ['password_confirm'], message: 'Les mots de passe ne correspondent pas' });

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Nom requis').max(120),
  phone: phoneSchema.or(z.literal('')),
  commune: z.string().trim().max(80).optional().or(z.literal('')),
  city: z.string().trim().min(2).max(80),
});

const currentYear = new Date().getFullYear();

export const vehicleSchema = z.object({
  type: z.enum(['auto', 'moto', 'marine']),
  brand: z.string().trim().min(1, 'Marque requise').max(60),
  model: z.string().trim().min(1, 'Modèle requis').max(60),
  year: z
    .union([z.coerce.number().int().min(1950, 'Année invalide').max(currentYear + 1, 'Année invalide'), z.literal('')])
    .optional(),
  plate: z.string().trim().max(20).optional().or(z.literal('')),
  color: z.string().trim().max(30).optional().or(z.literal('')),
  insurance_expires_at: z.string().optional().or(z.literal('')),
});

export const maintenanceSchema = z.object({
  kind: z.enum(['vidange', 'pneus', 'batterie', 'freins', 'revision', 'assurance', 'autre']),
  performed_at: z.string().min(10, 'Date requise'),
  mileage_km: z.union([z.coerce.number().int().min(0), z.literal('')]).optional(),
  cost: z.union([z.coerce.number().int().min(0), z.literal('')]).optional(),
  next_due_at: z.string().optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const quoteSchema = z
  .object({
    labor: z.coerce.number().int('Montant entier').min(0, 'Montant invalide').max(5_000_000),
    parts: z.coerce.number().int('Montant entier').min(0, 'Montant invalide').max(5_000_000),
    travel: z.coerce.number().int('Montant entier').min(0, 'Montant invalide').max(500_000),
    eta_minutes: z.union([z.coerce.number().int().min(1).max(600), z.literal('')]).optional(),
    notes: z.string().trim().max(600).optional().or(z.literal('')),
  })
  .refine((q) => q.labor + q.parts + q.travel > 0, { path: ['labor'], message: 'Le devis doit être supérieur à zéro' });

export const ticketSchema = z.object({
  category: z.enum(['intervention', 'paiement', 'litige', 'compte', 'securite', 'autre']),
  subject: z.string().trim().min(3, 'Objet trop court').max(140),
  message: z.string().trim().min(10, 'Décrivez votre demande (10 caractères minimum)').max(2000),
});

export const mechanicProfileSchema = z.object({
  business_name: z.string().trim().max(120).optional().or(z.literal('')),
  kind: z.enum(['independant', 'garage', 'depanneur']),
  bio: z.string().trim().max(800).optional().or(z.literal('')),
  years_experience: z.union([z.coerce.number().int().min(0).max(70), z.literal('')]).optional(),
  commune: z.string().trim().max(80).optional().or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  opening_hours: z.string().trim().max(200).optional().or(z.literal('')),
  service_radius_km: z.coerce.number().min(1, '1 km minimum').max(100, '100 km maximum'),
});

/** Champs vides → null pour la base. */
export function emptyToNull<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: Exclude<T[K], ''> | null } {
  const out = {} as { [K in keyof T]: Exclude<T[K], ''> | null };
  for (const k of Object.keys(obj) as (keyof T)[]) {
    const v = obj[k];
    out[k] = (v === '' || v === undefined ? null : v) as Exclude<T[typeof k], ''> | null;
  }
  return out;
}
