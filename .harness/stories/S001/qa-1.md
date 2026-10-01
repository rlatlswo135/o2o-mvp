# S001 QA — 1회

- 요청 ID: `20261001T074651133068Z-a9bbc3656ffd`
- 기준 HEAD: `9f5554115103cb58127b1554e63e289c3a568e3a`.
- 기준 지문: `39b63a086e7bb61575edb02f6239fdc1e96f17f0c456d24702b1af439591cc57` (시작·재개·검증 후 동일).
- 대상: implementation.md의 1단계 shared/ui 7파일. S001 고객 기능 통합 완료 조건과 구분.
- 판정: **BLOCKED**. production 공통 UI 검증은 PASS지만 dev CSS(R1)·기존 전체-client 검사(R2)·미구성 coverage·사용자 검증은 완료 아님.
- 코드리뷰 별도 판정: [review-1.md](review-1.md) **PASS(변경 소스 한정)**.

## 검증 환경·원본 보존

현재 Git 추적·미추적 소스를 임시 디렉터리에 copy2로 복사했다(.harness/server 제외). 원본 root/client node_modules를 symlink로 참조했으며 새 dependency를 의도적으로 설치하지 않았다. 명령 도움말 조회 `pnpm exec vp check --help`가 pnpm의 자동 동기화(`Packages: +272 -4`, pnpm 11.28.2)를 유발했다. ignored 의존성 환경이 변경된 사실을 기록하며 frozen 소스·lockfile 지문은 그대로였다. 이후 모든 검증은 기존 `node_modules/.bin/vp`를 직접 호출했다.

- 임시 사본: `/var/folders/28/zk0bxscn47584lwdhkpz5x700000gn/T/s001-review-hjcmshsv`.
- 명령 위치: check/lint는 사본 루트, test/build/dev/preview는 사본 client.
- 검사 결과는 아래에 보존. 임시 로그 존재만을 통과 근거로 삼지 않음.
- 사본의 test/build/dev는 routeTree.gen.ts를 생성했다. 원본에는 해당 명령을 실행하지 않았으며 원본 생성 파일도 수정하지 않았다. 전체-client 검사는 원본 routeTree.gen.ts를 사본에 다시 복사한 뒤 실행.
- 브라우저: 설치된 Chrome 154 headless + CDP, 사본 production preview `localhost:4317`, dev `localhost:4318`. 독립 임시 프로필 사용. 새 모델·CLI 에이전트 없음.
- CSS 파일·React 소스를 고치거나 CSS 링크를 임시 주입하지 않았다. loading submit 확인을 위한 form/type 변형은 production 브라우저 DOM에서만 수행했다.

## 실행 검증

| ID | 실행/범위 | 실제 결과 |
| --- | --- | --- |
| Q1 | c2h `review_request`/`source_fingerprint`, Git HEAD/staged/변경 파일 확인 | PASS. 요청 ID·S001·executor→reviewer·지문·승인·담당 일치. staged 없음 |
| Q2 | `vp check client/src/shared client/src/routes/index.tsx` | PASS, exit 0. 7파일 format/lint/typecheck, 경고·오류 0 |
| Q3 | `vp test --run` | PASS, exit 0. Vitest 5.0.1, 2 files, 9 tests. 종료 경고: `close timed out after 10000ms` / `Tests closed successfully but something prevents 2 Vite servers from exiting`. 경고를 숨기지 않음 |
| Q4 | `vp run build` | PASS, exit 0. client 141 modules/server 126 modules. `dist/client/assets/styles-Cy9mn3j8.css` 생성(6.48 kB). server는 client의 SSR 산출물이며 프로젝트 server/ 실행 아님 |
| Q5 | 빌드 CSS `var(--x...)`와 선언 비교 | PASS. 사용한 변수 24개, 정의 누락 0 |
| Q6 | production preview HTTP·실제 브라우저 렌더 | PASS. `/` HTTP 200. stylesheet `/assets/styles-Cy9mn3j8.css`; primary #2f5d9b, danger #b9382f, disabled 배경 #eef1f5·텍스트 #a3abb7. disabled 버튼 hover에도 disabled 색 유지 |
| Q7 | CDP Tab keyDown/keyUp, 상태 전환 후 200ms 대기 | PASS. 등록→취소→예약 취소→저장 중→이름 input→오류 전화 input. disabled 버튼/input 제외. 버튼 focus-visible solid 2px #2f5d9b, 일반 input 경계 primary + rgba(47,93,155,.18) 3px 링, 오류 input 경계 danger + rgba(185,56,47,.16) 3px 링 |
| Q8 | CDP 접근성 트리·label 실제 클릭 | PASS. 이름/전화번호 textbox 이름·description·required, 오류 invalid=true. loading busy=1·접근성 disabled=true이지만 focusable=true, native disabled 버튼은 focusable 아님. label 클릭 후 focused id와 htmlFor 일치 |
| Q9 | 실제 hydrated 버튼에 cancelable click 전달 | PASS. 일반 버튼 defaultPrevented=false, loading=true 버튼 true |
| Q10 | 실제 loading 버튼을 DOM 임시 form의 submit 버튼으로 지정, focus·click·Enter·Space | PASS. submit listener는 실행되지 않음(`submitted=no`), loading 버튼 포커스 유지(`focused=true`, 키보드 후 activeElement="저장 중"). 제품 소스 변경 없음 |
| Q11 | `vp dev --port 4318`, 브라우저 `/` 진입 | FAIL(R1). HTTP 200이나 StyleX CSS 링크 없음, 상태 색·스타일 빠짐 |
| Q12 | `vp check client/src` | FAIL(R2), exit 1. router.tsx·routes/__root.tsx format 2파일. format 실패로 다음 검사가 자동 실행됐다고 주장하지 않음 |
| Q13 | `vp lint client/src` 별도 실행 | FAIL(R2), exit 1. __root.tsx:40 jsx-no-new-object-as-prop, :43 jsx-no-new-array-as-prop, router.tsx:2 TS2307 './routeTree.gen', __root.tsx:5 TS2307 '../styles.css?url' |
| Q14 | `git diff --check -- client` 및 원본 c2h 지문 재확인 | PASS. whitespace 문제 없음, source unchanged |

## 1단계 완료 기준 대조

| 기준 | 판정 | 증거/제약 |
| --- | --- | --- |
| shared/ui 및 theme가 features/routes에 독립 | PASS | 실제 import·전체 caller 확인. route만 공통 UI를 소비 |
| 공통 props·문구·검증·API에 업무 규칙 없음 | PASS | Field의 label/error/description은 소비자 제공. 고객·전화번호 예시는 route에만 존재 |
| 기본·포커스·오류·disabled/loading 실제 렌더 | PASS(production) / FAIL(dev) | Q6–Q11. 원래 dev 화면을 수정 없이 검증했으므로 임시 링크 주입 결과를 일반 실행 PASS로 표현하지 않음 |
| label·설명·오류·required 접근성 연결 | PASS | Q3, Q8. SSR 테스트는 description+error 및 추가 describedby 결합·빈 error도 검증 |
| 결과·미검증 기록 및 사용자 리뷰 대기 | PASS(기록) / NOT_RUN(사용자 리뷰) | implementation.md에 실행·결정·공백 있음. 사용자 직접 승인/수동 테스트 결과 없음 |

## 안정적인 지적 ID·조치

### R1 — MEDIUM · dev 스타일 미로딩

- 위치: `client/src/routes/__root.tsx:21-26`, `client/vite.config.ts:9`.
- 재현/증거: Q11. dev stylesheet는 `/src/styles.css`만, primary 버튼 `rgb(239,239,239)`, 오류 경계 `rgb(118,118,118)`.
- 기대: dev에서도 기본·오류·disabled·포커스·loading 스타일 자동 적용.
- 수정안: 사용자 구성 승인 후 executor가 dev StyleX CSS/HMR shell 연결을 검토·최소 적용하고 dev/prod 재검증. 기존 공개 문제이며 reviewer 수정 없음.

### R2 — MEDIUM · 기존 전체-client 검사 실패

- 위치: `client/src/router.tsx:2`, `client/src/routes/__root.tsx:5,40,43` 및 두 파일 format.
- 재현/증거: Q12/Q13. 원본의 해당 파일·설정은 HEAD 대비 변경 없음.
- 기대: 전체 검사를 실제 통과하거나 미해결 기존 문제로 명시. 부분 검사 성공을 전체 성공으로 기록하지 않음.
- 수정안: 별도 사용자 승인 후 import/CSS URL 타입/devtools props/format 정리 및 전체 check 재실행. 게이트 비활성화·설정 완화 금지.

## NOT_RUN — 실행하지 않은 검증

- coverage 측정·gate: 설정/정본 기준 없음. 새 도구 설치·설정 변경·임계값 추측 안 함. 사용자 구성 결정 필요.
- DOM 테스트 프레임워크 기반 자동 이벤트 회귀: 사용자가 도입하지 않기로 결정. Q9/Q10 브라우저 검증과 구분.
- 상태가 false→true로 바뀌는 loading 전환의 자동 회귀, 화면낭독기 실제 음성, 실기기 시각 검증: NOT_RUN. CDP AX 트리 결과를 사람·기기 검증과 동일시하지 않음.
- 사용자 화면·코드 리뷰 및 수동 테스트 승인: NOT_RUN. 사용자 확인을 대행하지 않음.
- S001 전체 완료 조건 8항목: 유효 고객 DB 저장·목록, 새로고침 영속성, 필수값 서버 검증, 저장/조회 실패 구분, POST 중복, 동시 등록, blur 중복 API 미호출, 실제 API/서버/사용자 리뷰 모두 NOT_RUN(승인된 이번 단계 밖).
- 루트 전체 check 및 프로젝트 server/ 검증: NOT_RUN. 변경 범위 밖이며 BE는 사용자 담당.
- CONVENTIONS.md 정본 기반 FIRST 감사: NOT_RUN. 정본 없음.

## 재검증·인계

executor는 R1/R2를 실제 코드와 대조하고 브리핑한 뒤 사용자 선택을 받는다. 사용자 승인 범위만 수정하고 새 리뷰 기준으로 요청한다. 수정 불필요 판단이라도 coverage·사용자 검증·통합 완료 게이트는 남는다. REVIEW_DECISION/담당 executor로 기록하며 자동 FIX·DONE 처리하지 않는다. 리뷰/QA Fix 카운터는 0 유지.

임시 실행 로그: 사본의 check.log/test.log/build.log/full-client-check.log/full-client-lint.log/browser-qa.json. 브라우저 검증 스크립트 `/tmp/s001-browser-qa.mjs`. 임시 경로는 보존 보장이 없으므로 본 문서의 명령·관찰값을 정식 증거로 남긴다.
