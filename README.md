# Megacheck v1.6 — 사용자 지정 미완료 알람

v1.5의 고정 22:00 / 23:00 / 23:20 알람을 제거하고, 사용자가 원하는 시각을 자유롭게 추가/삭제할 수 있게 바꾼 버전입니다.

## 변경점

- 웹 대시보드에서 시간 선택 → `+ 추가`
- 등록 알람 목록 표시
- 각 알람 개별 삭제
- 각 알람은 `Asia/Seoul` 기준 매일 반복
- 알람 시각에 이미 강의분량 60분을 채웠으면 푸시를 보내지 않음
- 최대 10개 알람
- 같은 시간 재추가 시 QStash custom schedule ID를 이용해 중복 생성 대신 업데이트
- v1.5의 고정 schedule ID 3개는 `/api/alarms`를 처음 사용할 때 best-effort로 자동 삭제
- `/api/setup-schedules`는 더 이상 고정 알람을 만들지 않도록 비활성화

## 배포

기존 megacheck GitHub 프로젝트에 이 폴더 내용을 덮어쓴 뒤 Vercel 자동 배포를 기다리면 됩니다.

환경변수는 기존 그대로 사용합니다.

- ACCESS_TOKEN
- KV_REST_API_URL / KV_REST_API_TOKEN
- QSTASH_URL / QSTASH_TOKEN (또는 Vercel-Upstash가 만든 US/EU 별칭)

Android Web Push 구독도 기존 v1.5의 것을 그대로 사용합니다.
