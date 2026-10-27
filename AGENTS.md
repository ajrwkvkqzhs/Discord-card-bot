# AGENTS.md — Discord 카드 봇 개발 지침

## 프로젝트 현황
- 저장소: Discord-card-bot
- 기존 실행 환경: Cloudflare Worker `discord-card-bot`
- 기존 데이터베이스: Cloudflare D1 `discord-card-db`, 바인딩 이름 `DB`
- Discord Interactions API 기반 카드게임 봇을 개발합니다.
- 현재 Cloudflare에는 기본 요청 처리, 서명 검증, PING 응답, D1 헬스체크가 구성되어 있습니다.
- 향후 카드게임(텍사스 홀덤, 7포커, 블랙잭) 및 슬래시 명령어·버튼 상호작용을 구현할 수 있습니다. 기능 완료로 간주하지 마십시오.

## 작업 원칙
1. 저장소는 초기 상태입니다. 실제 코드를 작성하기 전에 Cloudflare의 기존 Worker 설정과 구현을 확인하십시오.
2. 언어·프레임워크·패키지·CI·배포 구성은 작업 요구가 생길 때 필요한 만큼만 추가하십시오. 불필요한 사전 환경 설정을 만들지 마십시오.
3. 기존 Discord 애플리케이션, Cloudflare Worker, D1 데이터베이스 및 Interactions URL은 사용자 요청 없이 삭제하거나 교체하지 마십시오.
4. 실제 배포, 명령어 등록, 데이터베이스 변경 등 외부 시스템을 변경하는 작업은 명시적으로 요청된 범위에서만 실행하십시오.
5. 작업 후 구현 내용, 검증 결과, 아직 구현하지 않은 부분을 구분해 보고하십시오.

## 보안
- 기존 Cloudflare Secret 이름: `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_TOKEN`
- Secret 값과 인증 정보는 코드, Git 커밋, 문서 또는 로그에 노출하지 마십시오.
- `.dev.vars`, `.env` 등 실제 자격 증명이 들어 있는 파일은 Git에 올리지 마십시오.
- ChatGPT/Codex 플러그인 사용 권한은 GitHub 파일만으로 연결되지 않습니다. 도구가 인식되지 않으면 실행 플랫폼의 연결 설정을 확인하십시오.
