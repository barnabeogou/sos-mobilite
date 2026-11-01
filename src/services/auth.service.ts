import { db } from '@/lib/supabase';
import { env } from '@/config/env';

export interface ClientSignUp {
  full_name: string;
  phone: string;
  email: string;
  city: string;
  commune?: string | null;
  password: string;
}

export interface MechanicSignUp extends ClientSignUp {
  business_name?: string | null;
}

/** Inscription client. Le profil est créé par le déclencheur handle_new_user. */
export async function signUpClient(input: ClientSignUp) {
  const { data, error } = await db().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${env.appUrl}/connexion?confirme=1`,
      data: { role: 'client', full_name: input.full_name, phone: input.phone, city: input.city, commune: input.commune ?? null },
    },
  });
  if (error) throw error;
  return data;
}

/** Inscription professionnel : le compte reste « en attente de validation ». */
export async function signUpMechanic(input: MechanicSignUp) {
  const { data, error } = await db().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${env.appUrl}/connexion?confirme=1`,
      data: {
        role: 'mechanic',
        full_name: input.full_name,
        phone: input.phone,
        city: input.city,
        commune: input.commune ?? null,
        business_name: input.business_name ?? null,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await db().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Connexion par SMS — uniquement si un fournisseur SMS est configuré dans Supabase. */
export async function sendPhoneOtp(phone: string) {
  if (!env.enablePhoneAuth) throw new Error('PHONE_AUTH_DISABLED');
  const { error } = await db().auth.signInWithOtp({ phone: phone.replace(/\s+/g, '') });
  if (error) throw error;
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const { data, error } = await db().auth.verifyOtp({ phone: phone.replace(/\s+/g, ''), token, type: 'sms' });
  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email: string) {
  const { error } = await db().auth.resetPasswordForEmail(email, { redirectTo: `${env.appUrl}/nouveau-mot-de-passe` });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await db().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await db().auth.signOut();
  if (error) throw error;
}
