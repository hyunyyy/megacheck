import { authorized, cors, sendPush } from '../lib/common.js';

export default async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    const result = await sendPush({
      title: '🔔 Megapass Guard 테스트',
      body: '안드로이드 푸시 연결이 정상입니다.',
      tag: 'megapass-test',
      url: '/',
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'push failed' });
  }
}
