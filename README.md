# Megacheck Vercel clean deployment

Repository root must contain exactly:

- public/index.html
- api/health.js
- api/sync.js
- vercel.json

Do not put these inside another folder.

Vercel Framework Preset: Other
Root Directory: ./ (repository root)
No Build Command or Output Directory required.

Environment variables:
- ACCESS_TOKEN
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
