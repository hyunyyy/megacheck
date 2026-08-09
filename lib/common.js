export const STATE_KEY = 'megapass:latest';
export const PUSH_SUB_KEY = 'megapass:push:subscription';
export const VAPID_KEY = 'megapass:push:vapid';
export const ALARMS_KEY = 'megapass:alarms';
export const ALARMS_MIGRATED_KEY = 'megapass:alarms:v16:migrated';

const QSTASH_DESTINATION = 'https://megacheck.vercel.app/api/push-check';

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

export function qstashEnv() {
  const token =
    process.env.QSTASH_TOKEN ||
    process.env.US_EAST_1_QSTASH_TOKEN ||
    process.env.EU_CENTRAL_1_QSTASH_TOKEN;

  const url = (
    process.env.QSTASH_URL ||
    process.env.US_EAST_1_QSTASH_URL ||
    process.env.EU_CENTRAL_1_QSTASH_URL ||
    'https://qstash-us-east-1.upstash.io'
  ).replace(/\/$/, '');

  if (!token) throw new Error('QSTASH_TOKEN is missing');
  return { url, token };
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

export function normalizeAlarmTime(value) {
  const s = String(value || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function alarmScheduleId(time) {
  return `megapass-alarm-${time.replace(':', '')}`;
}

export async function getAlarms() {
  const raw = await redis(['GET', ALARMS_KEY]);
  if (!raw) return [];
  try {
    const values = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    return [...new Set(values.map(normalizeAlarmTime).filter(Boolean))].sort();
  } catch {
    return [];
  }
}

export async function setAlarms(alarms) {
  const clean = [...new Set(alarms.map(normalizeAlarmTime).filter(Boolean))].sort();
  await redis(['SET', ALARMS_KEY, JSON.stringify(clean)]);
  return clean;
}

export async function createAlarmSchedule(time) {
  const normalized = normalizeAlarmTime(time);
  if (!normalized) throw new Error('invalid alarm time');

  const [hour, minute] = normalized.split(':').map(Number);
  const { url, token } = qstashEnv();
  const access = process.env.ACCESS_TOKEN;
  if (!access) throw new Error('ACCESS_TOKEN is missing');

  const scheduleId = alarmScheduleId(normalized);
  const cron = `CRON_TZ=Asia/Seoul ${minute} ${hour} * * *`;

  const r = await fetch(`${url}/v2/schedules/${QSTASH_DESTINATION}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Upstash-Cron': cron,
      'Upstash-Schedule-Id': scheduleId,
      'Upstash-Retries': '2',
      'Upstash-Forward-Authorization': `Bearer ${access}`,
    },
    body: JSON.stringify({ alarmTime: normalized }),
  });

  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!r.ok) {
    throw new Error(`QStash create HTTP ${r.status}: ${text || 'unknown error'}`);
  }

  return { scheduleId, cron, response: data };
}

export async function deleteQstashSchedule(scheduleId, { ignoreMissing = true } = {}) {
  const { url, token } = qstashEnv();
  const r = await fetch(`${url}/v2/schedules/${scheduleId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  // 삭제는 사용자 관점에서 idempotent하게 취급한다.
  if (r.ok || (ignoreMissing && r.status === 404)) return true;
  const text = await r.text();
  throw new Error(`QStash delete HTTP ${r.status}: ${text || 'unknown error'}`);
}

export async function deleteAlarmSchedule(time) {
  const normalized = normalizeAlarmTime(time);
  if (!normalized) throw new Error('invalid alarm time');
  await deleteQstashSchedule(alarmScheduleId(normalized));
}

export async function migrateLegacySchedules() {
  const done = await redis(['GET', ALARMS_MIGRATED_KEY]);
  if (done === '1') return;

  const legacyIds = [
    'megapass-guard-2200',
    'megapass-guard-2300',
    'megapass-guard-2320',
  ];

  try {
    for (const id of legacyIds) {
      await deleteQstashSchedule(id, { ignoreMissing: true });
    }
    await redis(['SET', ALARMS_MIGRATED_KEY, '1']);
  } catch {
    // 알람 관리 자체는 계속 사용할 수 있게 migration 실패는 치명적 오류로 만들지 않는다.
  }
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
