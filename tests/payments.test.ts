// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  NOTIFY_TOKEN_FIELDS,
  buildInitBody,
  computeXToken,
  interpretCheck,
  interpretTransfer,
  mapPaymentMethod,
  readConfig,
  sanitizeDescription,
  splitPhone,
  transferPaymentMethod,
  verifyXToken,
  type CinetPayConfig,
} from '../supabase/functions/_shared/cinetpay';

const cfg: CinetPayConfig = {
  apiKey: 'key',
  siteId: '123456',
  secretKey: 'secret',
  transferPassword: null,
  checkoutBase: 'https://api-checkout.cinetpay.com',
  transferBase: 'https://client.cinetpay.com',
};

describe('CinetPay — configuration', () => {
  it('sans clé ni site, le paiement en ligne reste indisponible', () => {
    expect(readConfig(() => undefined)).toBeNull();
    expect(readConfig((k) => ({ CINETPAY_API_KEY: 'k' })[k])).toBeNull();
    const c = readConfig((k) => ({ CINETPAY_API_KEY: ' k ', CINETPAY_SITE_ID: '1' })[k]);
    expect(c?.apiKey).toBe('k');
    expect(c?.transferPassword).toBeNull();
    expect(c?.checkoutBase).toBe('https://api-checkout.cinetpay.com');
  });
});

describe('CinetPay — initialisation', () => {
  it('construit la requête attendue par le guichet', () => {
    const body = buildInitBody(cfg, {
      reference: 'SOSPAY123',
      amount: 48000,
      description: 'Intervention SOS-261101-00001 — Batterie déchargée',
      notifyUrl: 'https://x/notify',
      returnUrl: 'https://y/retour',
      requestId: 'req',
      customer: { id: 'u1', full_name: 'Awa Koné', phone: '+225 07 11 22 33 44', email: 'awa@test.ci' },
    });
    expect(body).toMatchObject({
      apikey: 'key',
      site_id: '123456',
      transaction_id: 'SOSPAY123',
      amount: 48000,
      currency: 'XOF',
      channels: 'ALL',
      customer_name: 'Awa',
      customer_surname: 'Koné',
      customer_phone_number: '+2250711223344',
      customer_country: 'CI',
    });
    expect(body.description).toBe('Intervention SOS-261101-00001 Batterie dechargee');
  });

  it('nettoie la description et découpe les numéros ivoiriens', () => {
    expect(sanitizeDescription('Réparation #1 / pneu & jante')).toBe('Reparation 1 pneu jante');
    expect(splitPhone('+225 07 00 00 00 01')).toEqual({ prefix: '225', phone: '0700000001' });
    expect(splitPhone('0700000001')).toEqual({ prefix: '225', phone: '0700000001' });
    expect(splitPhone('12')).toBeNull();
  });
});

describe('CinetPay — notification', () => {
  it('vérifie le x-token comme hash_hmac("sha256") en PHP', async () => {
    const fields: Record<string, string> = Object.fromEntries(NOTIFY_TOKEN_FIELDS.map((k) => [k, '']));
    Object.assign(fields, { cpm_site_id: '123456', cpm_trans_id: 'SOSPAY123', cpm_amount: '48000', cpm_currency: 'XOF', payment_method: 'OM' });
    const php = createHmac('sha256', 'secret').update(NOTIFY_TOKEN_FIELDS.map((k) => fields[k]).join('')).digest('hex');
    expect(await computeXToken(fields, 'secret')).toBe(php);
    expect(await verifyXToken(fields, php, 'secret')).toBe(true);
    expect(await verifyXToken(fields, php.toUpperCase(), 'secret')).toBe(true);
    expect(await verifyXToken({ ...fields, cpm_amount: '1' }, php, 'secret')).toBe(false);
    expect(await verifyXToken(fields, null, 'secret')).toBe(false);
  });

  it('ne valide un paiement que si CinetPay le déclare ACCEPTED', () => {
    expect(interpretCheck({ code: '00', message: 'SUCCES', data: { status: 'ACCEPTED', amount: '48000', payment_method: 'OMCI', operator_id: 'MP123' } })).toEqual({
      kind: 'accepted',
      amount: 48000,
      method: 'orange_money',
      operatorId: 'MP123',
    });
    expect(interpretCheck({ code: '627', message: 'TRANSACTION_CANCEL', data: { status: 'REFUSED' } }).kind).toBe('refused');
    expect(interpretCheck({ code: '662', message: 'WAITING_CUSTOMER_PAYMENT', data: { status: 'WAITING_FOR_CUSTOMER' } }).kind).toBe('pending');
    expect(interpretCheck({}).kind).toBe('pending');
    expect(interpretCheck({ code: '00', data: { status: 'PENDING' } }).kind).toBe('pending');
  });

  it('reconnaît les moyens de paiement', () => {
    expect(mapPaymentMethod('OM')).toBe('orange_money');
    expect(mapPaymentMethod('MOMO')).toBe('mtn_momo');
    expect(mapPaymentMethod('FLOOZ')).toBe('moov_money');
    expect(mapPaymentMethod('WAVECI')).toBe('wave');
    expect(mapPaymentMethod('VISAM')).toBe('card');
    expect(mapPaymentMethod('???')).toBe('other');
  });
});

describe('CinetPay — transferts', () => {
  it('interprète envoi, validation et rejet', () => {
    expect(interpretTransfer({ code: 0, data: [[{ status: 'success', treatment_status: 'NEW', transaction_id: 'TR1', lot: 'L1' }]] })).toEqual({
      status: 'processing',
      providerReference: 'TR1',
      providerStatus: 'NEW',
      reason: null,
    });
    expect(interpretTransfer({ code: 0, data: [{ treatment_status: 'VAL', transaction_id: 'TR1', sending_status: 'CONFIRM' }] }).status).toBe('sent');
    expect(interpretTransfer({ code: 0, data: [{ treatment_status: 'REJ', comment: 'Numéro inconnu' }] })).toMatchObject({ status: 'failed', reason: 'Numéro inconnu' });
    expect(interpretTransfer({ code: 602, message: 'INSUFFICIENT_BALANCE' })).toMatchObject({ status: 'failed', reason: 'INSUFFICIENT_BALANCE' });
  });

  it('précise Wave, laisse les autres opérateurs être déduits du numéro', () => {
    expect(transferPaymentMethod('wave')).toBe('WAVECI');
    expect(transferPaymentMethod('orange_money')).toBeUndefined();
  });
});
