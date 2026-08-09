# Megapass Guard server v1.5 — Android Web Push

## 추가 기능
- Android Chrome Web Push
- 테스트 푸시
- 60분 완료 시 완료 푸시
- QStash 기반 매일 22:00 / 23:00 / 23:20 (Asia/Seoul) 미완료 경고
- Mac이 꺼져 있어도 Vercel + QStash가 서버에서 검사/전송

## Vercel 환경변수
기존:
- ACCESS_TOKEN
- KV_REST_API_URL
- KV_REST_API_TOKEN

추가:
- QSTASH_TOKEN

QSTASH_TOKEN은 Upstash Console → QStash → API Keys/Tokens에서 복사한 뒤 Vercel Settings → Environment Variables에 추가하고 재배포하세요.

VAPID 키는 별도 환경변수가 필요 없습니다. `/api/push-config`를 처음 호출할 때 서버가 생성해 Redis에 저장합니다.

## 배포
저장소 루트에 이 패키지의 파일들을 그대로 덮어씁니다.
새 파일: package.json, lib/common.js, push 관련 API, public/sw.js, manifest, icons.
GitHub 커밋 후 Vercel 자동 배포를 기다립니다.

## Android 설정
1. Chrome에서 https://megacheck.vercel.app 열기
2. ACCESS_TOKEN 입력
3. `알림 켜기` → Android 알림 권한 허용
4. `테스트 알림` 확인
5. `22시·23시·23:20 스케줄 설치` 클릭
6. 선택: Chrome 메뉴에서 `홈 화면에 추가` / `앱 설치`

스케줄 버튼은 같은 ID를 사용해 재실행해도 기존 스케줄을 업데이트합니다.
