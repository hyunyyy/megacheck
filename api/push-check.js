import { authorized, cors, getState, kstDate, parseBody, sendPush } from '../lib/common.js';

function formatRemaining(seconds) {
  const s = Math.max(0, 3600 - Math.max(0, Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return sec ? `${m}분 ${sec}초` : `${m}분`;
}

export default async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  try {
    const body = parseBody(req);
    const alarmTime = String(body.alarmTime || '').trim();
    const state = await getState();
    const today = kstDate();
    const sameDay = state && state.date === today;
    const seconds = sameDay ? Number(state.contentSeconds || 0) : 0;
    const completed = sameDay && Boolean(state.completed || seconds >= 3600);

    if (completed) {
      return res.status(200).json({ ok: true, skipped: 'completed', alarmTime });
    }

    const remaining = formatRemaining(seconds);
    const currentMinutes = Math.floor(seconds / 60);
    const last = sameDay && state.syncedAt
      ? new Date(state.syncedAt).toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '오늘 기록 없음';

    const title = '🚨 메가패스 아직 미완료';
    const message = sameDay
      ? `${alarmTime ? `${alarmTime} 알람 · ` : ''}현재 ${currentMinutes}/60분 · ${remaining} 남음 · 마지막 동기화 ${last}`
      : `${alarmTime ? `${alarmTime} 알람 · ` : ''}오늘 수강 기록이 없습니다. 강의 분량 60분이 남았습니다.`;

    const result = await sendPush({
      title,
      body: message,
      tag: `megapass-alarm-${alarmTime || 'custom'}-${today}`,
      url: '/',
    });

    return res.status(200).json({ ok: true, seconds, today, alarmTime, ...result });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'server error' });
  }
}
