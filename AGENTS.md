# 클라우드 코딩 에이전트 지침

## 프로젝트
- 기존 Cloudflare Worker `discord-card-bot` (TypeScript 전환 이전 JavaScript 원본)을 유지합니다.
- Discord Interactions HTTP API 기반 사용자 설치형 카드게임 봇입니다.
- 목표 게임: 텍사스 홀덤, 7포커, 블랙잭. 그룹 DM에서 사용하고 `/게임시작` 후 버튼 UI로 진행하는 흐름이 목표입니다.
- 현재 구현된 것은 헬스체크, Discord 서명 검증, PING 및 기본 명령어 응답뿐입니다. 실제 게임과 명령어 등록은 구현 전입니다.

## 환경
- Node.js 22 이상 + npm.
- `npm install`, `npm run check`, `npm run deploy:dry-run` 사용.
- 기존 Worker 소스는 `src/worker.js`. Cloudflare D1 바인딩 이름은 `DB`.
- `wrangler.jsonc`의 Worker 이름, D1 데이터베이스 ID 및 Secret 이름을 임의 변경하지 않습니다.

## 보안 및 권한
- `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_TOKEN`은 Cloudflare Secret으로만 취급합니다.
- `.dev.vars`, `.env`, 인증 토큰, 쿠키, 실제 Secret 값을 절대 커밋하거나 로그에 출력하지 않습니다.
- 기존 Discord 애플리케이션 / Cloudflare Worker / D1 / Interactions URL을 사용자 명시 승인 없이 교체, 삭제, 재생성하지 않습니다.
- Cloudflare 실제 배포는 명시적 요청이 있을 때만 수행합니다. GitHub Actions 배포도 수동입니다.
- ChatGPT 또는 Codex 플러그인은 Git 저장소 내부에 자동 설치되지 않습니다. 도구 인식 실패 시 작업 플랫폼의 플러그인 연결/권한을 별도 확인합니다.

## 검증
- Pull Request와 코드 변경에는 `npm run check` 및 `npm run deploy:dry-run` 수행.
- Discord 서명 검증 및 PING 호환성을 유지합니다.
- D1 스키마 변경은 migrations SQL로 분리하고 원격 적용 전에 검증합니다.
- 등록되지 않은 슬래시 명령어를 구현 완료 상태라고 주장하지 않습니다.

## 개발 확장
- 명령어 등록 스크립트는 Discord REST API를 사용하되 토큰은 Cloudflare Secret 또는 비공개 실행 환경에서만 사용합니다.
- 버튼 interaction custom_id에는 입력 검증과 권한 검사를 추가합니다.
- 게임 상태는 동시 요청 및 중복 이벤트 처리에 안전하게 설계합니다.
