# Discord Card Bot

Discord 사용자 설치형 카드게임 봇의 Cloudflare Workers 프로젝트입니다. 기존 Cloudflare Worker `discord-card-bot`를 기준으로 환경을 구성했습니다.

## 현재 상태
- Cloudflare Worker: `discord-card-bot`
- Cloudflare D1: `discord-card-db` (바인딩 `DB`)
- HTTP 엔드포인트: `GET /health`, `POST /interactions`
- Discord Ed25519 서명 검증, PING 응답, 기본 슬래시 명령어 응답 구현
- **미구현:** `/게임시작` 등록, 텍사스 홀덤/7포커/블랙잭 게임, 버튼별 상태 처리 및 실제 D1 게임 스키마

## 준비
Node.js 22 이상을 사용합니다.

```bash
npm install
npm run check
cp .dev.vars.example .dev.vars  # Windows PowerShell: Copy-Item .dev.vars.example .dev.vars
# .dev.vars에는 개발용 실제 값만 로컬에서 작성 (Git 업로드 금지)
npm run dev
```

`http://localhost:8787/health`에서 로컬 D1 바인딩 상태를 확인할 수 있습니다.

## 설정
`wrangler.jsonc`에는 기존 Worker 이름과 D1 데이터베이스의 공개 바인딩 정보만 포함합니다.

실제 Cloudflare Worker에는 다음 세 가지 **Secret 이름이 이미 등록**되어 있습니다(값은 저장소에 존재하지 않습니다).

- `DISCORD_APPLICATION_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_TOKEN` (Bot Token — 절대 커밋하거나 로그로 출력하지 마십시오)

설정값을 변경한 뒤에는 Cloudflare Dashboard > Workers & Pages > `discord-card-bot` > Settings > Variables and Secrets에서 점검하십시오.
실행 코드에서는 `env.DISCORD_TOKEN`을 사용해야 합니다. 임의로 `DISCORD_BOT_TOKEN`으로 이름을 변경하지 마십시오.

## 배포
- `npm run deploy:dry-run`: 번들링 검증, **실제 배포 없음**
- `npm run deploy`: **현재 운영 중인** `discord-card-bot` Worker를 교체합니다.
- GitHub Actions > CI: 자동 검사만 수행하며 배포하지 않습니다.
- GitHub Actions > Deploy Worker (manual): 수동 실행했을 때만 배포합니다. 실행 전에 GitHub Actions **Repository secrets**에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`를 별도로 입력해야 합니다. GitHub Actions 권한이 있는 API 토큰은 Worker 배포에 필요한 범위로 제한하십시오.
- 이미 설정된 Cloudflare의 Discord Secret은 GitHub에 복사할 필요가 없습니다.

> 주의: 이 GitHub 저장소는 클라우드 개발 환경의 **프로젝트 의존성/Worker 바인딩**을 재현합니다. ChatGPT/Codex의 플러그인 설치 및 OAuth 권한 자체는 별도 제품 설정이며 저장소 구성만으로 부여되지 않습니다.
> 또한 첫 배포 전에 기존 Worker와 코드의 차이를 검사하십시오. 이 저장소에는 현재 운영 중인 Worker의 기본 코드를 보존했습니다.

## 개발 지침
[AGENTS.md](AGENTS.md)를 참고하십시오.

## 참고 문서
- [Cloudflare Wrangler 설정](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Cloudflare Secret 관리](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/get-started/)
- [Discord Interactions](https://discord.com/developers/docs/interactions/receiving-and-responding)
