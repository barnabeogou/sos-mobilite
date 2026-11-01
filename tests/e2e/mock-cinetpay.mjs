/**
 * OUTIL DE TEST UNIQUEMENT — faux CinetPay pour le parcours de bout en bout local.
 *
 * Reproduit le comportement utile des API réelles :
 *  - guichet : POST /v2/payment → payment_url ; page de paiement ; notification signée (x-token)
 *    sur notify_url ; retour du navigateur en POST sur return_url ; POST /v2/payment/check ;
 *  - transferts : /v1/auth/login, /v1/transfer/contact, /v1/transfer/money/send/contact
 *    (statut NEW puis notification), /v1/transfer/check/money (VAL).
 *
 * Usage : MOCK_SECRET=... node tests/e2e/mock-cinetpay.mjs  (port 4340)
 */
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT ?? 4340);
const API_KEY = process.env.MOCK_API_KEY ?? 'mock-api-key';
const SITE_ID = process.env.MOCK_SITE_ID ?? '105000';
const SECRET = process.env.MOCK_SECRET ?? 'mock-secret';
const TRANSFER_PASSWORD = process.env.MOCK_TRANSFER_PASSWORD ?? 'mock-transfer-password';

const payments = new Map(); // transaction_id → { amount, notify_url, return_url, status, method }
const transfers = new Map(); // client_transaction_id → { status, transaction_id, amount, phone }
export const log = [];

const NOTIFY_TOKEN_FIELDS = [
  'cpm_site_id', 'cpm_trans_id', 'cpm_trans_date', 'cpm_amount', 'cpm_currency', 'signature', 'payment_method', 'cel_phone_num',
  'cpm_phone_prefixe', 'cpm_language', 'cpm_version', 'cpm_payment_config', 'cpm_page_action', 'cpm_custom', 'cpm_designation', 'cpm_error_message',
];
const xToken = (f) => crypto.createHmac('sha256', SECRET).update(NOTIFY_TOKEN_FIELDS.map((k) => f[k] ?? '').join('')).digest('hex');

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const html = (res, body) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CinetPay (test)</title><style>body{font-family:system-ui,sans-serif;background:#f4f6fb;margin:0;padding:24px;color:#111}
.box{max-width:420px;margin:32px auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 8px 30px rgba(0,0,0,.08)}
h1{font-size:18px;margin:0 0 4px}.amount{font-size:32px;font-weight:800;margin:16px 0}.muted{color:#667;font-size:14px}
button{display:block;width:100%;padding:14px;border-radius:12px;border:0;font-size:16px;font-weight:700;margin-top:12px;cursor:pointer}
.pay{background:#16a34a;color:#fff}.cancel{background:#eef;color:#334}.tag{display:inline-block;background:#fde68a;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700}</style></head>
<body><div class="box">${body}</div></body></html>`);
};
const parseForm = (raw) => Object.fromEntries(new URLSearchParams(raw));
const postForm = (url, fields, headers = {}) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(fields).toString() });

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let raw = '';
    for await (const chunk of req) raw += chunk;
    log.push(`${req.method} ${url.pathname}`);
    try {
      // ---- Guichet ---------------------------------------------------------
      if (req.method === 'POST' && url.pathname === '/v2/payment') {
        const b = JSON.parse(raw);
        if (b.apikey !== API_KEY || String(b.site_id) !== SITE_ID) return json(res, 200, { code: '608', message: 'MINIMUM_REQUIRED_FIELDS' });
        if (b.amount % 5 !== 0) return json(res, 200, { code: '624', message: 'AMOUNT_MUST_BE_MULTIPLE_OF_5' });
        payments.set(b.transaction_id, { amount: b.amount, notify_url: b.notify_url, return_url: b.return_url, status: 'WAITING_FOR_CUSTOMER', name: b.customer_name });
        return json(res, 200, {
          code: '201',
          message: 'CREATED',
          data: { payment_token: `tok_${b.transaction_id}`, payment_url: `http://localhost:${PORT}/pay/${encodeURIComponent(b.transaction_id)}` },
        });
      }
      const pay = /^\/pay\/([^/]+)(\/accept|\/cancel)?$/.exec(url.pathname);
      if (pay) {
        const ref = decodeURIComponent(pay[1]);
        const p = payments.get(ref);
        if (!p) return html(res, '<h1>Transaction introuvable</h1>');
        if (req.method === 'GET' && !pay[2]) {
          return html(
            res,
            `<span class="tag">ENVIRONNEMENT DE TEST</span><h1>Paiement SOS MOBILITÉ</h1><p class="muted">Réf. ${ref}</p>
             <div class="amount">${String(p.amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA</div><p class="muted">Orange Money · +225 07 11 22 33 44</p>
             <form method="post" action="/pay/${encodeURIComponent(ref)}/accept"><button class="pay" type="submit">Valider le paiement</button></form>
             <form method="post" action="/pay/${encodeURIComponent(ref)}/cancel"><button class="cancel" type="submit">Annuler</button></form>`,
          );
        }
        p.status = pay[2] === '/accept' ? 'ACCEPTED' : 'REFUSED';
        p.method = 'OMCI';
        // Notification serveur à serveur, signée comme CinetPay
        const fields = {
          cpm_site_id: SITE_ID,
          cpm_trans_id: ref,
          cpm_trans_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          cpm_amount: String(p.amount),
          cpm_currency: 'XOF',
          signature: crypto.randomBytes(8).toString('hex'),
          payment_method: p.method,
          cel_phone_num: '0711223344',
          cpm_phone_prefixe: '225',
          cpm_language: 'fr',
          cpm_version: 'V4',
          cpm_payment_config: 'SINGLE',
          cpm_page_action: 'PAYMENT',
          cpm_custom: '',
          cpm_designation: 'SOS',
          cpm_error_message: p.status === 'ACCEPTED' ? 'SUCCES' : 'TRANSACTION_CANCEL',
        };
        const n = await postForm(p.notify_url, fields, { 'x-token': xToken(fields) });
        log.push(`notify → ${n.status}`);
        // Retour du client vers le site marchand : CinetPay revient en POST
        return html(
          res,
          `<h1>${p.status === 'ACCEPTED' ? 'Paiement effectué' : 'Paiement annulé'}</h1><p class="muted">Retour vers le site…</p>
           <form id="r" method="post" action="${p.return_url}"><input type="hidden" name="transaction_id" value="${ref}"><input type="hidden" name="token" value="tok_${ref}"></form>
           <script>setTimeout(() => document.getElementById('r').submit(), 600)</script>`,
        );
      }
      if (req.method === 'POST' && url.pathname === '/v2/payment/check') {
        const b = JSON.parse(raw);
        const p = payments.get(b.transaction_id);
        if (!p) return json(res, 200, { code: '627', message: 'TRANSACTION_NOT_FOUND', data: { status: 'REFUSED' } });
        if (p.status === 'ACCEPTED')
          return json(res, 200, { code: '00', message: 'SUCCES', data: { amount: String(p.amount), currency: 'XOF', status: 'ACCEPTED', payment_method: p.method, operator_id: `MP${Date.now()}` } });
        if (p.status === 'REFUSED') return json(res, 200, { code: '627', message: 'TRANSACTION_CANCEL', data: { status: 'REFUSED' } });
        return json(res, 200, { code: '662', message: 'WAITING_CUSTOMER_PAYMENT', data: { status: 'WAITING_FOR_CUSTOMER' } });
      }

      // ---- Transferts ------------------------------------------------------
      if (req.method === 'POST' && url.pathname === '/v1/auth/login') {
        const f = parseForm(raw);
        if (f.apikey !== API_KEY || f.password !== TRANSFER_PASSWORD) return json(res, 200, { code: 700, message: 'INVALID_CREDENTIALS' });
        return json(res, 200, { code: 0, message: 'OPERATION_SUCCES', data: { token: 'mock-transfer-token' } });
      }
      if (url.pathname.startsWith('/v1/transfer/') && url.searchParams.get('token') !== 'mock-transfer-token') return json(res, 200, { code: 706, message: 'INVALID_TOKEN' });
      if (req.method === 'POST' && url.pathname === '/v1/transfer/contact') return json(res, 200, { code: 0, message: 'OPERATION_SUCCES', data: [[{ status: 'success' }]] });
      if (req.method === 'POST' && url.pathname === '/v1/transfer/money/send/contact') {
        const [item] = JSON.parse(parseForm(raw).data);
        if (item.amount % 5 !== 0 || item.amount < 100) return json(res, 200, { code: 723, message: 'INVALID_AMOUNT' });
        const t = { status: 'NEW', transaction_id: `TR${Date.now()}`, amount: item.amount, phone: item.phone };
        transfers.set(item.client_transaction_id, t);
        // Validation par l'opérateur quelques instants plus tard, puis notification
        setTimeout(async () => {
          t.status = 'VAL';
          const r = await postForm(item.notify_url, { client_transaction_id: item.client_transaction_id, transaction_id: t.transaction_id, treatment_status: 'VAL' }).catch((e) => ({ status: e.message }));
          log.push(`transfer-notify → ${r.status}`);
        }, 800);
        return json(res, 200, {
          code: 0,
          message: 'OPERATION_SUCCES',
          data: [[{ status: 'success', treatment_status: 'NEW', transaction_id: t.transaction_id, lot: 'LOT1', client_transaction_id: item.client_transaction_id }]],
        });
      }
      if (req.method === 'GET' && url.pathname === '/v1/transfer/check/money') {
        const t = transfers.get(url.searchParams.get('client_transaction_id'));
        if (!t) return json(res, 200, { code: 404, message: 'NOT_FOUND' });
        return json(res, 200, { code: 0, message: 'OPERATION_SUCCES', data: [{ treatment_status: t.status, transaction_id: t.transaction_id, sending_status: t.status === 'VAL' ? 'CONFIRM' : 'PENDING', amount: t.amount }] });
      }
      if (url.pathname === '/__log') return json(res, 200, log);
      return json(res, 404, { code: 404, message: 'NOT_FOUND' });
    } catch (e) {
      return json(res, 500, { code: 500, message: e.message });
    }
  })
  .listen(PORT, () => console.log(`Faux CinetPay sur http://localhost:${PORT}`));
