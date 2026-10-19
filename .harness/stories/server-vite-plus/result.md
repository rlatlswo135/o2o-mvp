# server-vite-plus — 서버 테스트·lint 도구를 Vite+로 전환

## 한 일
- 서버 unit·E2E·coverage 테스트를 Vite+(내장 Vitest)로 옮기고, unit/E2E를 한 `vite.config.ts`의 test projects로 합쳤다. 직접 Vitest·tsconfig-paths 의존성과 중복 `server/pnpm-lock.yaml`은 지웠다.
- 단독 prettier·oxlint 설정을 지우고, 서버 스크립트를 client와 같은 check:fix·format:fix·lint:fix로 맞췄다. 기존 서버 옵션은 루트 fmt·lint의 server 전용 override로 옮겼다.
- Nest CLI 호환을 위해 서버 TypeScript만 `^6.0.0`으로 고정했다(client는 7 유지). tsconfig.build.json 분리는 Nest 빌드 출력 경로 때문에 유지한다.

## 바뀐 파일
- server/package.json, server/vite.config.ts, server/tsconfig.json, pnpm-lock.yaml, 루트 lint·fmt 설정
- 삭제: server/vitest.config*.ts, server/pnpm-lock.yaml, server/.prettierrc, server/.oxlintrc.json
