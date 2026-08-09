import { authorized, cors } from '../lib/common.js';

export default async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  return res.status(410).json({
    error: '고정 스케줄 기능은 v1.6에서 제거되었습니다. /api/alarms를 사용하세요.',
  });
}
