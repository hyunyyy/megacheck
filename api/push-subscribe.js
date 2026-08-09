import { PUSH_SUB_KEY, authorized, cors, parseBody, redis } from '../lib/common.js';

export default async function handler(req, res) {
  cors(res, 'POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    if (req.method === 'DELETE') {
      await redis(['DEL', PUSH_SUB_KEY]);
      return res.status(200).json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    const { subscription } = parseBody(req);
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'invalid subscription' });
    }
    await redis(['SET', PUSH_SUB_KEY, JSON.stringify(subscription)]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'server error' });
  }
}
