const KEY = 'megapass:latest';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
}

function authorized(req) {
  const expected = process.env.ACCESS_TOKEN;
  return Boolean(expected) && req.headers.authorization === `Bearer ${expected}`;
}

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis env vars are missing');

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

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  try {
    if (req.method === 'GET') {
      const raw = await redis(['GET', KEY]);
      return res.status(200).json({ state: raw ? JSON.parse(raw) : null });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const contentSeconds = Number(body.contentSeconds || 0);
      const realSeconds = Number(body.realSeconds || 0);
      if (!Number.isFinite(contentSeconds) || !Number.isFinite(realSeconds)) {
        return res.status(400).json({ error: 'invalid seconds' });
      }

      const state = {
        date: String(body.date || ''),
        contentSeconds: Math.max(0, contentSeconds),
        realSeconds: Math.max(0, realSeconds),
        playbackRate: Number(body.playbackRate || 1),
        lastSignalAt: body.lastSignalAt || null,
        completed: Boolean(body.completed || contentSeconds >= 3600),
        completedAt: body.completedAt || null,
        lectureTitle: body.lectureTitle || null,
        detectionMethod: body.detectionMethod || null,
        syncedAt: new Date().toISOString(),
      };

      await redis(['SET', KEY, JSON.stringify(state)]);
      return res.status(200).json({ ok: true, state });
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'server error' });
  }
}
