import {
  authorized,
  cors,
  createAlarmSchedule,
  deleteAlarmSchedule,
  getAlarms,
  migrateLegacySchedules,
  normalizeAlarmTime,
  parseBody,
  setAlarms,
} from '../lib/common.js';

const MAX_ALARMS = 10;

export default async function handler(req, res) {
  cors(res, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  try {
    await migrateLegacySchedules();

    if (req.method === 'GET') {
      const alarms = await getAlarms();
      return res.status(200).json({ alarms, max: MAX_ALARMS });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const time = normalizeAlarmTime(body.time);
      if (!time) return res.status(400).json({ error: '시간 형식이 올바르지 않습니다.' });

      const alarms = await getAlarms();
      if (!alarms.includes(time) && alarms.length >= MAX_ALARMS) {
        return res.status(400).json({ error: `알람은 최대 ${MAX_ALARMS}개까지 추가할 수 있습니다.` });
      }

      const schedule = await createAlarmSchedule(time);
      const next = await setAlarms([...alarms, time]);
      return res.status(200).json({ ok: true, alarms: next, schedule });
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const time = normalizeAlarmTime(body.time);
      if (!time) return res.status(400).json({ error: '시간 형식이 올바르지 않습니다.' });

      await deleteAlarmSchedule(time);
      const alarms = await getAlarms();
      const next = await setAlarms(alarms.filter(v => v !== time));
      return res.status(200).json({ ok: true, alarms: next });
    }

    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'server error' });
  }
}
