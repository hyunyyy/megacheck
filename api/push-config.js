import { authorized, cors, getVapidKeys } from '../lib/common.js';

export default async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    const keys = await getVapidKeys();
    return res.status(200).json({ publicKey: keys.publicKey });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'server error' });
  }
}
