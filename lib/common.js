export const STATE_KEY = 'megapass:latest';
export const PUSH_SUB_KEY = 'megapass:push:subscription';
export const VAPID_KEY = 'megapass:push:vapid';

export function redisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis env vars are missing');
  return { url, token };
}

export async function redis(command) {
  const { url, token } = redisEnv();
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `Redis HTTP ${r.status}`);
  return j.result;
}

export function authorized(req) {
  const expected = process.env.ACCESS_TOKEN;
  return Boolean(expected) && req.headers.authorization === `Bearer ${expected}`;
}

export function cors(res, methods = 'GET, POST, DELETE, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Cache-Control', 'no-store');
}

export function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

export function kstDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export async function getState() {
  const raw = await redis(['GET', STATE_KEY]);
  return raw ? JSON.parse(raw) : null;
}

export async function setState(state) {
  await redis(['SET', STATE_KEY, JSON.stringify(state)]);
}

export async function getVapidKeys() {
  const raw = await redis(['GET', VAPID_KEY]);
  if (raw) return JSON.parse(raw);
  const webpush = (await import('web-push')).default;
  const keys = webpush.generateVAPIDKeys();
  await redis(['SET', VAPID_KEY, JSON.stringify(keys)]);
  return keys;
}

export async function sendPush(payload) {
  const raw = await redis(['GET', PUSH_SUB_KEY]);
  if (!raw) return { sent: false, reason: 'no subscription' };
  const subscription = JSON.parse(raw);
  const keys = await getVapidKeys();
  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails('https://megacheck.vercel.app', keys.publicKey, keys.privateKey);
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 3600 });
    return { sent: true };
  } catch (e) {
    const statusCode = e?.statusCode || e?.status;
    if (statusCode === 404 || statusCode === 410) {
      await redis(['DEL', PUSH_SUB_KEY]);
    }
    throw e;
  }
}
