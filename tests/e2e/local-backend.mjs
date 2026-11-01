/**
 * OUTIL DE TEST UNIQUEMENT — ne jamais utiliser en production.
 *
 * Émule localement le sous-ensemble des API Supabase utilisé par l'application
 * (Auth : inscription / connexion / session ; REST : lecture, insertion,
 * modification, suppression, RPC) au-dessus d'un PostgreSQL local sur lequel
 * sont appliquées les VRAIES migrations. Chaque requête s'exécute avec le rôle
 * `authenticated` ou `anon` et les claims JWT, exactement comme PostgREST :
 * les politiques RLS et les fonctions SQL sont donc réellement testées.
 *
 * Les appels /functions/v1/* sont relayés vers FUNCTIONS_TARGET (Edge Functions lancées
 * localement avec Deno), comme le fait la passerelle Supabase.
 *
 * Non couverts : Storage (photos/documents) et Realtime.
 *
 * Usage : DATABASE_URL=postgres://... [FUNCTIONS_TARGET=http://127.0.0.1:8000] node tests/e2e/local-backend.mjs  (port 54321)
 */
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const PORT = Number(process.env.PORT ?? 54321);
const FUNCTIONS_TARGET = (process.env.FUNCTIONS_TARGET ?? '').replace(/\/$/, '');
const SECRET = 'local-e2e-secret-not-for-production';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// JWT HS256
// ---------------------------------------------------------------------------
const b64u = (b) => Buffer.from(b).toString('base64url');
export function signJwt(payload) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify(payload));
  const s = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
function verifyJwt(token) {
  const [h, p, s] = String(token).split('.');
  if (!h || !p || !s) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  if (expected !== s) return null;
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return payload;
}
export const ANON_KEY = signJwt({ role: 'anon', iss: 'local-e2e', exp: 4102444800 });
export const SERVICE_KEY = signJwt({ role: 'service_role', iss: 'local-e2e', exp: 4102444800 });

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
const checkPw = (pw, stored) => {
  const [salt] = stored.split(':');
  return hashPw(pw, salt) === stored;
};

function userObject(row) {
  return {
    id: row.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: row.email,
    phone: row.phone ?? '',
    email_confirmed_at: row.created_at,
    user_metadata: row.raw_user_meta_data ?? {},
    app_metadata: { provider: 'email', providers: ['email'] },
    created_at: row.created_at,
    updated_at: row.created_at,
  };
}
function session(row) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = signJwt({ sub: row.id, role: 'authenticated', email: row.email, aud: 'authenticated', exp: now + 3600 });
  return {
    access_token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: signJwt({ sub: row.id, typ: 'refresh', exp: now + 30 * 86400 }),
    user: userObject(row),
  };
}

async function handleAuth(req, res, path, body, url) {
  if (path === '/auth/v1/signup' && req.method === 'POST') {
    const exists = await pool.query('select 1 from auth.users where lower(email) = lower($1)', [body.email]);
    if (exists.rowCount) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
    if (!body.password || body.password.length < 6) return send(res, 422, { code: 422, msg: 'Password should be at least 6 characters' });
    const { rows } = await pool.query(
      'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning *',
      [body.email, body.data ?? body.options?.data ?? {}],
    );
    await pool.query('insert into test_auth.passwords (user_id, hash) values ($1, $2)', [rows[0].id, hashPw(body.password)]);
    return send(res, 200, session(rows[0]));
  }
  if (path === '/auth/v1/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const { rows } = await pool.query(
        'select u.*, p.hash from auth.users u join test_auth.passwords p on p.user_id = u.id where lower(u.email) = lower($1)',
        [body.email],
      );
      if (!rows[0] || !checkPw(body.password, rows[0].hash))
        return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return send(res, 200, session(rows[0]));
    }
    if (grant === 'refresh_token') {
      const claims = verifyJwt(body.refresh_token);
      if (!claims) return send(res, 400, { code: 400, msg: 'Invalid Refresh Token' });
      const { rows } = await pool.query('select * from auth.users where id = $1', [claims.sub]);
      return send(res, 200, session(rows[0]));
    }
  }
  if (path === '/auth/v1/user') {
    const claims = verifyJwt((req.headers.authorization ?? '').replace(/^Bearer /i, ''));
    if (!claims?.sub) return send(res, 401, { code: 401, msg: 'invalid JWT' });
    if (req.method === 'PUT' && body.password) {
      await pool.query('update test_auth.passwords set hash = $2 where user_id = $1', [claims.sub, hashPw(body.password)]);
    }
    const { rows } = await pool.query('select * from auth.users where id = $1', [claims.sub]);
    return send(res, 200, userObject(rows[0]));
  }
  if (path === '/auth/v1/logout') return send(res, 204, null);
  if (path === '/auth/v1/recover') return send(res, 200, {});
  return send(res, 404, { msg: 'not implemented in local test backend' });
}

// ---------------------------------------------------------------------------
// REST (sous-ensemble PostgREST)
// ---------------------------------------------------------------------------
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error(`invalid identifier ${s}`), { status: 400 });
  return `"${s}"`;
};

function parseFilters(url, params, q = '') {
  const col_ = (c) => `${q}${ident(c)}`;
  const where = [];
  const reserved = new Set(['select', 'order', 'limit', 'offset', 'or', 'columns', 'on_conflict']);
  const cond = (col, opval) => {
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|in|is)\.(.*)$/s.exec(opval);
    if (!m) throw Object.assign(new Error(`unsupported filter ${opval}`), { status: 400 });
    const [, not, op, raw] = m;
    let sql;
    if (op === 'in') {
      const items = raw.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, ''));
      params.push(items);
      sql = `${col_(col)}::text = any($${params.length}::text[])`;
    } else if (op === 'is') {
      sql = `${col_(col)} is ${raw === 'null' ? 'null' : raw === 'true' ? 'true' : 'false'}`;
    } else {
      const v = op === 'like' || op === 'ilike' ? raw.replace(/\*/g, '%') : raw;
      params.push(v);
      const map = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };
      sql = `${col_(col)}::text ${map[op]} $${params.length}`;
      if (['gt', 'gte', 'lt', 'lte'].includes(op)) sql = `${col_(col)} ${map[op]} $${params.length}`;
    }
    return not ? `not (${sql})` : sql;
  };
  for (const [k, v] of url.searchParams) {
    if (reserved.has(k)) continue;
    where.push(cond(k, v));
  }
  const or = url.searchParams.get('or');
  if (or) {
    const parts = or.replace(/^\(|\)$/g, '').split(',').map((p) => {
      const i = p.indexOf('.');
      return cond(p.slice(0, i), p.slice(i + 1));
    });
    where.push(`(${parts.join(' or ')})`);
  }
  return where.length ? `where ${where.join(' and ')}` : '';
}

function selectList(url) {
  const sel = url.searchParams.get('select') ?? '*';
  if (sel === '*') return '*';
  return sel
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (c === '*' ? '*' : ident(c)))
    .join(', ');
}

function orderLimit(url) {
  let sql = '';
  const order = url.searchParams.get('order');
  if (order) {
    sql += ' order by ' + order
      .split(',')
      .map((o) => {
        const [col, dir, nulls] = o.split('.');
        return `${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : ''}`;
      })
      .join(', ');
  }
  const limit = url.searchParams.get('limit');
  if (limit) sql += ` limit ${Number(limit)}`;
  return sql;
}

async function withRole(req, fn) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /i, '');
  const claims = verifyJwt(token);
  const role = claims?.role === 'authenticated' || claims?.role === 'service_role' ? claims.role : 'anon';
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims ?? { role: 'anon' })]);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function functionShape(client, name) {
  const { rows } = await client.query(
    `select p.proretset, t.typtype from pg_proc p join pg_type t on t.oid = p.prorettype
      join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1 limit 1`,
    [name],
  );
  if (!rows[0]) throw Object.assign(new Error(`function ${name} not found`), { status: 404, code: 'PGRST202' });
  return rows[0];
}

async function handleRest(req, res, path, body, url) {
  const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object');
  const returnRep = (req.headers.prefer ?? '').includes('return=representation');

  const rpc = /^\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(path);
  if (rpc) {
    const result = await withRole(req, async (client) => {
      const shape = await functionShape(client, rpc[1]);
      const keys = Object.keys(body ?? {});
      const args = keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ');
      const values = keys.map((k) => body[k]);
      const call = `public.${ident(rpc[1])}(${args})`;
      if (shape.proretset) return (await client.query(`select coalesce(json_agg(t), '[]'::json) as v from ${call} t`, values)).rows[0].v;
      return (await client.query(`select to_json(${call}) as v`, values)).rows[0]?.v ?? null;
    });
    return send(res, 200, result);
  }

  const m = /^\/rest\/v1\/([a-z_0-9]+)$/.exec(path);
  if (!m) return send(res, 404, { message: 'not found' });
  const table = `public.${ident(m[1])}`;

  const rows = await withRole(req, async (client) => {
    const params = [];
    if (req.method === 'GET' || req.method === 'HEAD') {
      const where = parseFilters(url, params);
      return (await client.query(`select coalesce(json_agg(t), '[]'::json) as v from (select ${selectList(url)} from ${table} ${where}${orderLimit(url)}) t`, params)).rows[0].v;
    }
    if (req.method === 'POST') {
      const list = Array.isArray(body) ? body : [body];
      const cols = Object.keys(list[0] ?? {});
      params.push(JSON.stringify(list));
      const colSql = cols.map(ident).join(', ');
      return (
        await client.query(
          `with t as (insert into ${table} (${colSql}) select ${colSql} from json_populate_recordset(null::${table}, $1::json) returning ${selectList(url)}) select coalesce(json_agg(t), '[]'::json) as v from t`,
          params,
        )
      ).rows[0].v;
    }
    if (req.method === 'PATCH') {
      const cols = Object.keys(body ?? {});
      params.push(JSON.stringify(body));
      const set = cols.map((c) => `${ident(c)} = __r.${ident(c)}`).join(', ');
      const where = parseFilters(url, params, `${table}.`);
      return (
        await client.query(
          `with t as (update ${table} set ${set} from json_populate_record(null::${table}, $1::json) __r ${where} returning ${table}.*) select coalesce(json_agg(t), '[]'::json) as v from t`,
          params,
        )
      ).rows[0].v;
    }
    if (req.method === 'DELETE') {
      const where = parseFilters(url, params);
      return (await client.query(`with t as (delete from ${table} ${where} returning *) select coalesce(json_agg(t), '[]'::json) as v from t`, params)).rows[0].v;
    }
    throw Object.assign(new Error('method not allowed'), { status: 405 });
  });

  if (req.method !== 'GET' && !returnRep) return send(res, 204, null);
  if (wantsObject) {
    if (rows.length !== 1)
      return send(res, 406, { code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
    return send(res, 200, rows[0]);
  }
  return send(res, req.method === 'POST' ? 201 : 200, rows);
}

// ---------------------------------------------------------------------------
function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Range',
  });
  res.end(data === null ? '' : JSON.stringify(data));
}

// Relais vers les Edge Functions locales (corps brut, redirections non suivies).
async function proxyFunction(req, res, url, raw) {
  if (!FUNCTIONS_TARGET) return send(res, 503, { code: 'FUNCTIONS_UNAVAILABLE', message: 'Edge Functions non lancées (FUNCTIONS_TARGET)' });
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!['host', 'connection', 'content-length'].includes(k)) headers[k] = v;
  const r = await fetch(`${FUNCTIONS_TARGET}${url.pathname.replace(/^\/functions\/v1/, '')}${url.search}`, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : raw,
    redirect: 'manual',
  });
  const out = {};
  r.headers.forEach((v, k) => {
    if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) out[k] = v;
  });
  res.writeHead(r.status, out);
  res.end(Buffer.from(await r.arrayBuffer()));
}

http
  .createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, null);
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let raw = '';
    for await (const chunk of req) raw += chunk;
    if (url.pathname.startsWith('/functions/v1/')) {
      try {
        return await proxyFunction(req, res, url, raw);
      } catch (e) {
        return send(res, 502, { code: 'FUNCTIONS_UNREACHABLE', message: e.message });
      }
    }
    const body = raw ? JSON.parse(raw) : undefined;
    try {
      if (url.pathname.startsWith('/auth/v1/')) return await handleAuth(req, res, url.pathname, body ?? {}, url);
      if (url.pathname.startsWith('/rest/v1/')) return await handleRest(req, res, url.pathname, body, url);
      if (url.pathname.startsWith('/storage/v1/')) return send(res, 400, { statusCode: '400', error: 'Storage', message: 'Storage indisponible dans le backend de test local' });
      return send(res, 404, { message: 'not found' });
    } catch (e) {
      const status = e.status ?? (e.code === '42501' ? 403 : e.code === '28000' ? 401 : 400);
      if (process.env.DEBUG) console.error(req.method, url.pathname, e.message);
      return send(res, status, { code: e.code ?? 'ERR', message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
    }
  })
  .listen(PORT, () => {
    console.log(`Backend de test local sur http://localhost:${PORT}`);
    console.log(`ANON_KEY=${ANON_KEY}`);
    console.log(`SERVICE_KEY=${SERVICE_KEY}`);
  });
