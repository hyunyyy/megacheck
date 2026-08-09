import { STATE_KEY, authorized, cors, getState, redis, sendPush } from '../lib/common.js';

export default async function handler(req, res) {
  cors(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  try {
    if (req.method === 'GET') {
      const state = await getState();
      return res.status(200).json({ state });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const contentSeconds = Number(body.contentSeconds || 0);
      const realSeconds = Number(body.realSeconds || 0);
      if (!Number.isFinite(contentSeconds) || !Number.isFinite(realSeconds)) {
        return res.status(400).json({ error: 'invalid seconds' });
      }

      const previous = await getState();
      const completed = Boolean(body.completed || contentSeconds >= 3600);
      const state = {
        date: String(body.date || ''),
        contentSeconds: Math.max(0, contentSeconds),
        realSeconds: Math.max(0, realSeconds),
        playbackRate: Number(body.playbackRate || 1),
        lastSignalAt: body.lastSignalAt || null,
        completed,
        completedAt: body.completedAt || (completed ? new Date().toISOString() : null),
        lectureTitle: body.lectureTitle || null,
        detectionMethod: body.detectionMethod || null,
        syncedAt: new Date().toISOString(),
      };

      await redis(['SET', STATE_KEY, JSON.stringify(state)]);

      // 완료를 처음 서버가 관측한 순간에만 폰에 완료 알림을 보낸다.
      const newlyCompleted = completed && (!previous || previous.date !== state.date || !previous.completed);
      if (newlyCompleted) {
        sendPush({
          title: '✅ 메가패스 오늘 완료',
          body: `강의 분량 ${Math.floor(contentSeconds / 60)}분을 서버가 확인했습니다.`,
          tag: `megapass-complete-${state.date}`,
          url: '/',
        }).catch(() => {});
      }

      return res.status(200).json({ ok: true, state });
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'server error' });
  }
}
