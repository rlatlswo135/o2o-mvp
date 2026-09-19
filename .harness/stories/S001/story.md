# S001 — 고객 이름·전화번호 등록 후 목록에서 확인

## 상태
- 현재: REVIEW_DECISION
- 담당: executor
- reviewer 인계: 요청 `20261001T074651133068Z-a9bbc3656ffd`의 1회 [코드리뷰](review-1.md) PASS(변경 소스 한정), [QA](qa-1.md) BLOCKED. R1 dev CSS 미로딩·R2 기존 전체-client 검사 실패는 사용자 결정 필요. 소스 지문 일치, 소스 수정 없음. executor는 실제 코드 대조·review-brief.md 작성 후 `/accept`·`/feedback`을 기다린다. 사용자 선택 전 수정·자동 DONE 금지.
- executor 인계 수락: 2026-10-01T15:05:11+09:00. 사용자가 `/executor` 선택 UI에서 "공통 UI 1단계 (shared/ui)"를 선택해 아래 1단계 범위의 구현을 승인했다. 기준 HEAD `9f55541`. 커밋·푸시·설치·설정 변경·server/ 수정은 승인 범위 밖.
- 사용자 승인: 스토리 범위·중복 정책에 동의. 2026-10-01 FE 구조 계획 확정 및 첫 입력 UI 개발·executor 인계 승인. 근거: “저대로 플랜잡으면돼, 그럼 fe-structur는 확정짓고 바로 공통 ui개발하는거 executor한테 인계해줘”.
- 사용자 정정: 개발할 것은 `features/customers/ui/`가 아니라 `shared/ui/`의 공통 컴포넌트다. 이전 planner의 고객 feature 내부 UI 선개발·shared 선구현 금지 해석은 철회한다.
- 활성화: `/executor` 선택·인계 수락 완료(위 기록). 이번 승인 범위는 아래 1단계 도메인 독립 공통 UI이며 고객 업무 화면·API 연결은 아직 실행하지 않는다.
- 코드리뷰 Fix 횟수: 0 / 3
- QA Fix 횟수: 0 / 3
- 동일 실패 연속 횟수: 0 / 2
- 모델 변경 필요: 없음

## 사용자 요구와 가치

사장님이 고객 이름과 전화번호를 등록하고 목록에서 확인한다.
예약·회원권 관리의 기반이 되는 고객 기록을 실제 DB에 저장하며, 사용자가 구현한 서버와 AI가 구현할 프런트를 연결하는 첫 기능이다.
근거: [V1 합의 범위](../v1-scope.md).

## 범위 / 제외 범위

포함:
- 고객 이름·전화번호 입력과 서버 저장.
- 저장한 고객을 목록에서 확인. 새로고침해도 같은 기록 조회.
- 필수값 검증, 저장·조회 실패 안내. 저장 실패를 성공으로 표시하지 않음.
- 같은 샵의 동일 전화번호 중복 등록은 차단한다. blur 시점 등의 사전 중복 조회 없이 등록 POST 응답으로 결과를 알린다.

제외:
- 프로젝트 구성, 패키지 설치, 디렉터리·모노레포 설계, 빌드·린트·포매터 설정.
- AI의 백엔드 구현. 서버와 DB 구현은 사용자 담당.
- 고객 수정·삭제·상세 화면, 검색·필터, 엑셀 가져오기/내보내기.
- 예약·회원권·매출, 고객 회원가입·문자 인증, V2 고객 자동 매칭.
- 새 전역 상태·테이블·폼 라이브러리 도입.
- 최종 화면 배치·디자인은 이 문서에서 고정하지 않음.

## 의존 스토리

- 선행 기능 스토리 없음.
- 사용자 담당 프런트 구성과 서버·DB 기반이 실제 연결 전에 필요하다. 별도 구성 스토리를 만들지 않는다.
- 실사용 고객정보는 사장님 인증과 샵 접근 범위 보호가 준비된 환경에서만 다룬다. 준비 전에는 비공개 개발 환경에서 가상 데이터로 검증한다.

## 업무 규칙

- 고객은 이름이 같더라도 서로 다른 기록으로 식별할 수 있어야 한다. 전화번호의 앞자리 0을 보존한다.
- 입력 검증과 같은 샵 내 전화번호 중복 차단은 서버에서도 수행한다. 동시 등록 요청에서도 중복 저장을 막는다.
- 고객정보는 인증된 샵 범위에서만 저장·조회할 수 있다.
- API 경로·요청/응답 형식·오류 코드는 스토리에 지정하지 않는다. 실제 구현·연결 시 사용자 서버 규약에 맞춘다.

## 완료 조건
- [ ] Given 유효한 이름·전화번호 When 고객 등록 성공 Then 서버가 식별자를 발급하고 DB에 저장하며 목록에서 확인할 수 있다.
- [ ] Given 저장된 고객 When 화면을 새로고침하고 목록을 조회 Then 같은 식별자의 고객 정보가 보인다.
- [ ] Given 필수값 누락 등 합의된 검증 실패 When 등록 요청 Then 서버는 저장하지 않고 화면에서 실패를 알 수 있다.
- [ ] Given 저장·조회 실패 When 요청 종료 Then 성공으로 오인시키지 않고 실패를 안내한다. 조회 실패와 고객이 없는 상태를 구분한다.
- [ ] Given 같은 샵에 동일 전화번호의 고객 존재 When 등록 POST 요청 Then 추가 저장 없이 중복 오류를 반환하고 화면에서 안내한다.
- [ ] Given 같은 샵에 같은 전화번호로 동시 등록 요청 When 서버 처리 완료 Then 고객은 최대 한 명만 생성된다.
- [ ] Given 전화번호 입력·blur When 등록 전 Then 중복 확인 API를 호출하지 않는다.
- [ ] 실제 API 연결, 서버 검증, 사용자 화면·코드 리뷰를 완료한다. 목업 동작만으로 완료하지 않는다.

## 검증 계획
- 명령: 사용자 프로젝트 구성을 확인한 후 실제 실행 가능한 테스트 명령을 구현 단계에 기록한다. 명령 미정은 스토리 작성 완료를 막지 않으며, 검증 없이 구현 완료로 처리할 수는 없다.
- 기대 결과: 위 등록·영속 조회·검증 실패·통신 실패 조건을 재현해 확인한다.
- 수동 테스트 필요 여부/이유: 필요. 사용자 가상 고객 등록 → 목록 확인 → 새로고침 후 유지 확인, 오류 안내 및 코드 구조 리뷰.
- 현재 검증 결과: 1단계 shared/ui만 검증. `vp check`(변경 7파일) PASS, `vp test` 9/9 PASS, build PASS, 브라우저 키보드·포커스·a11y 확인. 상세는 [구현 기록](implementation.md). S001 완료 조건은 미검증.

## executor 구현 결과 (1단계)
- 결과 문서: [implementation.md](implementation.md). 1단계 공통 UI 묶음 완료 ≠ S001 통합 완료.
- 변경: `client/src/shared/ui/`의 theme.stylex.ts, Button.tsx, Field.tsx, Input.tsx, 테스트 2개(신규). `client/src/routes/index.tsx`는 검토용 조립으로 수정.
- 실행 중 사용자 결정: 루트 `pnpm install --frozen-lockfile` 승인·실행(추적 파일 변경 없음). DOM 테스트는 도입하지 않음.
- 사용자 결정 필요: dev 모드에서 StyleX CSS가 로드되지 않는다. `__root.tsx`에 `/virtual:stylex.css` 주입이 필요하며 구성 수정이라 승인 범위 밖이다. build는 정상.
- 대기: 사용자 화면·코드 리뷰와 명시적 `/harness-review`. 자동 리뷰 요청·커밋 없음.

## 구현 인계
- 인계 준비: 완료. 다음 담당 executor. 사용자 구조 확정·첫 입력 UI 실행/인계 승인과 [FE 구조 계획](fe-structure.md)을 인계 근거로 한다. 기록 저장 후 `c2h send --from planner --to executor --story S001` 전달을 시도했으나 `Error: Run init first.`로 실패했다. 메시지는 미전달이며 executor 수락·구현 착수는 확인되지 않았다. 새 하네스 init은 실행하지 않았다.
- 활성화 방법: 기존 executor 세션에서 `/executor`로 S001을 선택받는다. executor가 선택·인계 수락 근거를 기록하고 IMPLEMENTING/담당 executor 및 CURRENT.md·index.md를 맞춘다. 새 에이전트·세션은 실행하지 않는다.
- 정정 인계: 이전 `features/customers/ui/` 선개발 지침은 폐기한다. executor는 최신 [FE 구조 계획](fe-structure.md)과 이 인계를 다시 읽는다. 현재 작업 트리에 UI 소스 구현 파일·implementation.md는 확인되지 않았다.
- 이번 실행 범위: **1단계 shared/ui 공통 컴포넌트만**. 도메인 독립 Button·Input·Field·최소 StyleX 의미 토큰 및 기본·포커스·오류·disabled·loading 상태와 접근성 연결을 개발한다.
- 파일 후보: `client/src/shared/ui/Button.tsx`, `Input.tsx`, `Field.tsx`, `theme.stylex.ts` 및 관련 테스트. 최소 렌더가 필요하면 기존 `client/src/routes/index.tsx`에서 검토용 조립만 허용한다. 전체 UI 카탈로그·새 검토 도구는 만들지 않는다.
- 위치/책임: 공통 컴포넌트는 처음부터 shared/ui에 둔다. 두 번째 feature 소비자가 생길 때까지 기다리거나 customers 내부에 먼저 만들지 않는다. 고객 필드명·전화번호 검증·중복 오류·API 요청은 포함하지 않는다. Field의 도움말/오류 문구 등은 소비자가 전달한다. shared/hooks는 필요가 없으면 만들지 않는다.
- 제외: CustomersPage·CustomerForm·CustomerList 업무 화면, 고객 목록/등록 데이터 흐름, API·BE 연결, `/customers` 업무 라우트 구현, 사이드바·다른 메뉴·Select·Drawer·Table·전체 테마 선택 기능. 1단계 리뷰 후 다음 실행 범위를 확인한다.
- 설치/설정 경계: 기존 TanStack Start·Vite+·StyleX 구성 유지. flame-ui는 설치된 실제 API·접근성을 확인해 필요 동작만 재사용한다. server/·flame 저장소·패키지·설정 수정·새 의존성 설치·커밋·푸시는 승인하지 않았다.
- 공통 UI 완료 기준: shared/ui와 공통 테마가 features/routes에 의존하지 않고 도메인 문구·검증·API 없이 재사용 가능하다. 기본·포커스·오류·disabled/loading 상태와 label/오류 설명 연결을 실제 렌더에서 확인하고 사용자 화면·코드 리뷰를 기다린다. 이 기준은 S001의 DB 통합 완료 조건과 별개다.
- 검증: lint·typecheck·tests·coverage gate를 끄거나 skip하지 않는다. 기존 명령의 범위를 확인하고 실행 결과를 남긴다. 테스트/coverage 설정과 CONVENTIONS.md가 없는 현 상태를 PASS로 처리하지 않고, 필요한 구성 결정은 사용자에게 요청한다. 키보드·포커스·오류 연결·disabled/loading 동작은 실제 렌더에서 확인한다.
- 기준 커밋: executor가 착수 시 실제 HEAD·작업 트리를 기록한다. 현재 planner의 미커밋 .harness 문서를 보존한다.
- 대상 커밋 또는 동결 스냅샷: 없음. 커밋 미승인이므로 리뷰 요청 시 FLOW.md/WORKFLOW.md에 맞춰 diff와 비밀 제외 미추적 파일 기준을 고정한다.
- 검증 명령/실제 결과: 문서 검사만 수행. 제품 검증 NOT_RUN. executor는 implementation.md에 파일·명령·실제 결과·미검증 항목과 '공통 UI 묶음 완료 ≠ S001 고객 기능 통합 완료'를 기록한다.
- 멈춤 지점: 1단계 구현·검증 결과를 보고하고 사용자 화면·코드 리뷰 및 명시적 `/harness-review` 요청을 기다린다. 고객 업무 화면/BE 연결로 자동 진행하거나 DONE으로 표시하지 않는다.
- 역할: 사용자 BE 구현·구성, executor 승인된 FE 입력 UI 구현, planner 구조·범위·완료 조건 기록.

## 다음 단계

현재 스캐폴딩·선택 시안을 확인하고 [FE 구조 계획](fe-structure.md)을 작성했다.
사용자 지정 경계는 확정: `src/routes/`는 페이지 조립·라우팅, `src/features/<feature>/`는 도메인 코드, `src/shared/`는 범용 UI·hooks를 담당한다. 이번에는 shared/ui 공통 컴포넌트를 먼저 개발하고 이후 고객 업무 화면에서 사용한다.
FE 구조 계획과 인계를 사용자 정정에 맞춰 수정했다. 공통 UI 첫 묶음 실행·인계 승인을 고객 feature UI 승인으로 해석하지 않는다. 다음은 기존 executor 세션에서 `/executor`로 S001을 선택·수락하고 위 1단계 범위만 구현하는 단계다.
읽을 자료·이번 작업 경계는 [현재 작업 포인터](../../CURRENT.md)를 따른다. planner는 구현하지 않으며 승인 범위를 페이지·API·설치로 확대하지 않는다.
서버 구성·BE 구현은 사용자 담당이며 FE UI 진행의 선행 조건이 아니다.

## 완료 게이트
- [ ] 사용자 스토리 승인
- [ ] 고정된 변경 기준 코드리뷰 통과
- [ ] 완료 조건별 QA 통과
- [ ] 수동 테스트 사용자 확인 또는 불필요 사유
- [ ] deep-guide.md
- [ ] eli5.md
- [ ] quiz.md

## 이력
| 시각 | 역할 | 이전 → 다음 상태 | 근거 파일/사용자 확인 |
| --- | --- | --- | --- |
| 2026-09-23T22:29:38+09:00 | planner | 없음 → DRAFT | 사용자가 첫 기능 스토리로 고객 등록·목록 확인에 동의. API 계약과 완료 조건의 구현 승인은 별도. |
| 2026-09-25T23:19:34+09:00 | planner | DRAFT → AWAITING_APPROVAL | 중복 등록 정책 확정. 사용자 요청으로 API 초안 제거, 기능 범위·업무 규칙·완료 조건 중심으로 작성 완료. 구현 미승인·미시작. |
| 2026-10-01T14:54:52+09:00 | planner | AWAITING_APPROVAL 유지 | 사용자 FE 구조 확정·첫 입력 UI 개발/인계 승인. 1단계 범위를 고정하고 executor 활성화 준비. FLOW.md의 `/executor` 선택·인계 수락 전 상태/담당 유지. |
| 2026-10-01T15:04:01+09:00 | planner | AWAITING_APPROVAL 유지 | 사용자 정정: 도메인 UI가 아니라 shared/ui 공통 컴포넌트를 먼저 개발. 잘못된 features/customers/ui 선개발 인계를 철회하고 구조·범위·단계 완료 기준·CURRENT/index/design/scope를 일치시킴. 현재 작업 트리 UI 구현 없음. 수정 인계의 알림 발송·executor 수락은 미확인. |
| 2026-10-01T15:05:11+09:00 | executor | AWAITING_APPROVAL → IMPLEMENTING | 사용자가 `/executor` 단일 선택 UI에서 "공통 UI 1단계 (shared/ui)" 선택 = 1단계 구현 승인·정정된 planner 인계 수락. 선택 후 스토리·CURRENT.md·fe-structure.md 재확인, 변경 없음. 기준 HEAD 9f55541 + planner 미커밋 .harness 문서. |
| 2026-10-01T15:18:59+09:00 | executor | IMPLEMENTING 유지 | 1단계 shared/ui 구현·검증 완료, implementation.md 기록. 사용자 리뷰·`/harness-review` 요청 대기. dev StyleX CSS 주입은 사용자 결정 대기. |
| 2026-10-01T16:41:43+09:00 | executor | IMPLEMENTING 유지 | 사용자 피드백 반영: prop을 그대로 출력하는지만 보던 테스트 삭제(16→9), markup.test-utils.ts 삭제. className 제외·theme.stylex.ts 유지 근거를 implementation.md에 기록. check·test 재실행 PASS. |
| 2026-10-01T16:46:30+09:00 | executor | IMPLEMENTING → REVIEW | 사용자 `/harness-review` 요청. 리뷰 기준은 implementation.md "리뷰 기준". 리뷰 종료까지 executor 소스 수정 중단. |
| 2026-10-01T17:11:34+09:00 | reviewer | REVIEW → REVIEW_DECISION | 요청 20261001T074651133068Z-a9bbc3656ffd. review-1.md PASS(변경 소스), qa-1.md BLOCKED(R1/R2·남은 게이트). 동결 사본 검사·9테스트·빌드·production 브라우저 검증 실행, 원본 소스 지문 유지. 담당 executor로 인계, 브리핑·사용자 결정 대기. 회신 전 ack 없음. |
