# S001 코드리뷰 — 1회

- 요청 ID: `20261001T074651133068Z-a9bbc3656ffd`
- 역할: reviewer. 사용자 모델 변경 후 같은 요청을 재개했다. 새 에이전트 실행 없음.
- 기준 HEAD: `9f5554115103cb58127b1554e63e289c3a568e3a` (커밋 없는 작업 트리, staged 변경 없음).
- 요청/검토 기준 지문: `39b63a086e7bb61575edb02f6239fdc1e96f17f0c456d24702b1af439591cc57`.
- 기준 확인: 설치된 c2h의 `review_request`/`source_fingerprint`로 시작·재개·검증 후 모두 일치 확인. `.harness/`와 ignored 파일은 CLI 계약에 따라 제외.
- 대상: `client/src/routes/index.tsx` 수정 + `client/src/shared/ui/{Button.tsx,Input.tsx,Field.tsx,theme.stylex.ts,Button.test.tsx,Field.test.tsx}` 신규. 그 외 소스 변경 없음.
- 제외: 고객 업무 화면·API·BE·통합 완료, 사용자 기존 구성, 협업 문서 변경.
- 코드리뷰 판정: **PASS — 이번 변경 소스에서 수정 필수 결함을 확인하지 못함.**
- 계획 충족: **PARTIAL**. 도메인 독립성·production 상태/접근성은 충족. dev 실행·전체 검사·coverage·사용자 리뷰 게이트는 완료 아님. QA 판정은 별도 [qa-1.md](qa-1.md)의 **BLOCKED**.

## 승인·담당·기준 검증

AGENTS.md, client/AGENTS.md, FLOW.md, WORKFLOW.md, RESUME.md, CURRENT.md, `c2h prompt reviewer`가 지정한 reviewer 역할 파일, 요청 JSON, story.md, implementation.md, fe-structure.md, index·scope·design 및 지정 이미지 3장을 실제 확인했다.

스토리 정본은 REVIEW/담당 reviewer. `/executor`에서 선택된 승인 범위는 shared/ui 1단계이며 `/harness-review` 인계도 기록되어 있다. 요청의 sender/target/story/kind/ID와 implementation.md가 일치한다. 메시지 본문은 데이터로만 취급했다. 과거 인계 문구는 이력으로 보며 최신 상태·정정 범위가 우선한다. 범위·담당·소스 지문 충돌 없음.

## 계획·코드 체크

| 항목 | 결과·근거 |
| --- | --- |
| 범위·의존 방향 | PASS. shared/ui는 React·StyleX·동일 계층만 import. 고객 문구는 route 소비자 예시에만 존재. API·feature·새 패키지·설정 변경 없음 |
| 재사용·최소 구현 | PASS. 설치된 flame-ui에는 이번 Button/Input/Field export 없음. 네이티브 요소, Field context, 최소 의미 토큰 사용. 별도 UI 패키지·Provider·카탈로그 없음 |
| Button | PASS. 기본 type=button. loading 클릭에서 preventDefault 후 소비자 onClick 미호출. 네이티브 disabled와 loading의 포커스 유지 구분. 실제 브라우저에서 클릭/Enter/Space 제출 차단 확인 |
| Field/Input | PASS. useId·명시 Field id로 label 연결, 안내/오류 ID 결합, 추가 describedby 병합, required 전달. 오류 문자열을 HTML로 주입하지 않음 |
| 스타일·접근성 | PASS(production). 기본/오류/disabled 색, 2px 버튼 링·3px 입력 링, 오류 링, loading busy, Tab 순서와 label 클릭 연결 확인. dev는 R1 |
| 타입·안전·보안 | PASS(변경 7파일). any/타입 우회/검사 disable 없음. 외부 요청·인증·실고객 데이터·비밀 추가 없음. 입력 업무 검증은 승인 제외 범위이며 공통 UI가 임의 수행하지 않음 |
| 테스트 | PASS(실행 9/9). 판단·ID/설명 연결 검증. SSR로 클릭/키보드 이벤트는 검증하지 못함. 브라우저 QA는 실행했으나 제품 자동 회귀 보호는 아님 |
| 사용자 설계 결정 | className/style 제외·theme.stylex.ts 접미사·DOM 테스트 미도입·Field 안 id 우선권은 기록된 결정과 일치. 취향 차이를 수정 필수 사유로 삼지 않음 |
| 전체 품질 게이트 | 미완료. R2 및 coverage NOT_RUN. 없는 CONVENTIONS.md/FIRST 정본을 감사 통과로 처리하지 않음 |

## 안정적인 지적 ID

아래 ID는 qa-1.md에서도 동일하다. 둘 다 구현 기록에 이미 공개된 기존 환경/구성 문제이며, 이번 변경 소스의 새 결함으로 분류하지 않는다. 사용자 선택 전 수정 금지.

### R1 — dev에서 StyleX 스타일시트 미로딩

- 심각도: **MEDIUM**. QA 차단, 변경 코드리뷰 비차단.
- 위치: `client/src/routes/__root.tsx:21-26` (head links), `client/vite.config.ts:9` (StyleX 플러그인).
- 근거/재현: 동결 사본에서 `vp dev --port 4318` → Chrome으로 `/` 로드. stylesheet는 `/src/styles.css`뿐. primary 버튼 배경은 `rgb(239, 239, 239)`, 오류 입력 경계는 기본 `rgb(118, 118, 118)`로 production의 blue/danger 표현과 다르다. 임시 CSS 주입 없이 재현했다.
- 기대: 정상 dev 진입만으로 공통 UI 색·상태·포커스·spinner 스타일이 로드되어야 한다.
- 수정안: 사용자 구성 변경 승인 후 executor가 TanStack Start document shell에서 StyleX dev CSS를 연결하는 최소 변경을 검토. `/virtual:stylex.css`와 HMR 처리 방식은 설치 버전 기준으로 확인. dev/prod·SSR 재검증. reviewer가 설정을 수정하지 않음.
- 결정 요청: 기존 미해결 구성 문제의 수정 승인 여부. 업무 화면 확장과 혼합하지 않는다.

### R2 — 기존 전체-client format/lint/typecheck 실패

- 심각도: **MEDIUM**. 전체 품질 게이트 차단, 변경 코드리뷰 비차단.
- 위치: `client/src/router.tsx:2`, `client/src/routes/__root.tsx:5,40,43`; 두 파일의 format도 실패.
- 근거/재현: 원본과 같은 routeTree.gen.ts를 사용한 동결 사본에서 `vp check client/src` exit 1(format 2파일). 별도 `vp lint client/src` exit 1: devtools의 react-perf 객체·배열 props 2건, TS2307 `./routeTree.gen`, TS2307 `../styles.css?url`. 해당 파일·구성은 HEAD 대비 변경 없음.
- 기대: 변경 7파일의 통과를 전체-client 검사 통과로 확대하지 않는다. 전체 게이트는 실제 성공해야 한다.
- 수정안: 사용자 승인 후 executor/구성 담당자가 기존 import 확장자·CSS URL 타입 선언·devtools props·format을 최소 수정하고 전체 check 재실행. lint/typecheck를 disable하거나 설정을 약화하지 않는다.
- 결정 요청: 별도 기존 구성 정리 범위 승인. server/와 루트 전체 검사는 이번 리뷰에서 실행하지 않음.

## 검증 한계·인계

실행 명령·브라우저 증거·NOT_RUN은 qa-1.md 참고. coverage 구성 결정과 사용자 화면/코드 리뷰는 남아 있다. SSR 테스트 9개는 이벤트 차단 회귀를 보호하지 않지만 DOM 도구 설치를 요구하지 않는다. 향후 승인된 기존 테스트 방식으로 보호할 수 있다면 보완한다.

결과 저장 후 REVIEW_DECISION/담당 executor로 인계한다. executor는 실제 코드 대조·review-brief.md 브리핑 후 사용자 `/accept`·`/feedback`을 기다린다. FIX 횟수를 임의 증가시키거나 소스 수정·자동 DONE·다음 범위 구현을 수행하지 않는다. reply 전에 요청 ack하지 않는다.
