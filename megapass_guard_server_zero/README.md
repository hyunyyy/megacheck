# Megapass Guard — zero-dependency Vercel backend

No npm packages are required.

## Deploy

1. Put this folder in a GitHub repository.
2. In Vercel: Add New -> Project -> import that repository -> Deploy.
3. In the Vercel project: Marketplace / Storage -> install **Upstash for Redis** and connect a Redis database.
   The integration should inject `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
4. Project Settings -> Environment Variables -> add `ACCESS_TOKEN` with a long random value (32+ chars).
5. Redeploy.
6. Open `https://YOUR_PROJECT.vercel.app/api/health`. It should return `{ "ok": true, ... }`.
7. Open the root URL, enter the same ACCESS_TOKEN. The dashboard checks `/api/sync` every 5 seconds.

## Test POST

```bash
curl -X POST 'https://YOUR_PROJECT.vercel.app/api/sync' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"date":"2026-08-09","contentSeconds":1200,"realSeconds":600,"playbackRate":2,"lastSignalAt":"2026-08-09T08:30:00+09:00","completed":false,"detectionMethod":"HTML5 video"}'
```

Reload the dashboard; it should show 20:00 / 60:00 and real playback 10:00.

## What the extension will send later

```json
{
  "date": "2026-08-09",
  "contentSeconds": 2831,
  "realSeconds": 1417,
  "playbackRate": 2,
  "lastSignalAt": "2026-08-09T08:34:10+09:00",
  "completed": false,
  "completedAt": null,
  "lectureTitle": null,
  "detectionMethod": "HTML5 video"
}
```

The extension service worker should POST this every 10–30 seconds when state changes. Add the deployed Vercel origin to the extension's `host_permissions` so the service worker can fetch it.
