import { authorized, cors } from '../lib/common.js';

const DESTINATION = 'https://megacheck.vercel.app/api/push-check';
const schedules = [
  { id: 'megapass-guard-2200', cron: 'CRON_TZ=Asia/Seoul 0 22 * * *', level: 'early' },
  { id: 'megapass-guard-2300', cron: 'CRON_TZ=Asia/Seoul 0 23 * * *', level: 'urgent' },
  { id: 'megapass-guard-2320', cron: 'CRON_TZ=Asia/Seoul 20 23 * * *', level: 'final' },
];

export default async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  const qstash = process.env.QSTASH_TOKEN;
  const access = process.env.ACCESS_TOKEN;
  if (!qstash) return res.status(500).json({ error: 'QSTASH_TOKEN is missing' });
  if (!access) return res.status(500).json({ error: 'ACCESS_TOKEN is missing' });

  try {
    const results = [];
    const encoded = encodeURIComponent(DESTINATION);
    for (const s of schedules) {
      const r = await fetch(`https://qstash.upstash.io/v2/schedules/${encoded}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${qstash}`,
          'Content-Type': 'application/json',
          'Upstash-Cron': s.cron,
          'Upstash-Schedule-Id': s.id,
          'Upstash-Retries': '2',
          'Upstash-Forward-Authorization': `Bearer ${access}`,
          'Upstash-Redact-Fields': 'headers',
        },
        body: JSON.stringify({ level: s.level }),
      });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!r.ok) throw new Error(`QStash ${s.id}: HTTP ${r.status} ${text}`);
      results.push({ id: s.id, cron: s.cron, response: data });
    }
    return res.status(200).json({ ok: true, schedules: results });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'schedule setup failed' });
  }
}
