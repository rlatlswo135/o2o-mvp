# Impact — S001 고객 등록·목록 화면 (실행 revision S001R2)

## Target

신규 `client/src/features/customers/`와 `routes/customers.tsx`, 기존 `routes/index.tsx`의 최소 진입 링크, 기존 도구가 생성하는 `routeTree.gen.ts`. 이번 승인 후보는 FE 완성 화면·가상 동작뿐이다. BE·연결·학습은 같은 업무 스토리의 후속 완료 게이트다.

## Dependents / 기존 구현

- `router.tsx`가 생성된 routeTree를 소비한다. `/customers` 신규 직접 진입/새로고침·기존 `/`의 공존을 확인한다. routeTree 수작업 편집·router 설정 변경 없음.
- feature가 기존 Button/Field/Input/Table/EmptyState/Skeleton/ErrorState/LiveNotice·StyleX 토큰을 직접 소비한다. shared의 API·토큰 값·CSS 진입점 변경 없음. routes → features → shared 방향 유지.
- LiveNotice는 `noticeKey`로 같은 결과를 재전달하도록 UI004에서 보완됐다. 소비자가 매 표시 사건 id를 바꾼다. 폼 오류와 결과 요약을 중복 live region으로 만들지 않는다.
- 기존 `/`와 01~08 검토 예시 유지. 신규 업무 화면 스타일/레이아웃을 shared에 옮기거나 전체 shell framework로 확장하지 않는다.
- 현재 `features/customers`·고객 route/클라이언트 API 없음. 로컬 `server/src/app.module.ts`는 기본 AppController/Service만 등록하며 AppController는 기본 GET만 제공한다. 외부 BE 준비 상태는 추측하지 않는다. 서버 수정/테스트 실행 없음.

## Affected Stories

- 업무 S001: 화면·사용자 직접 BE·연결을 한 스토리로 유지. 이전 S001 승인 범위(shared/ui 1단계)는 동결하며 새 전체 실행 revision을 S001R2에 저장한다. FE 전용 기능 스토리 신설이 아니다.
- UI001~UI004: 완료 공통 UI 회귀 대상. 기존 `/` 링크 외 검토 동작은 유지한다.
- S002·S003·S009 등: 여전히 S001 실제 통합 완료에 의존한다. FE 확인만으로 착수 가능으로 바꾸지 않는다.

## Test Coverage

- UI004 executor 최종 기록: 17파일 64/64·build 성공·dev/preview 각 69/69. planner가 재실행한 결과 아님. 기존 전체 format 실패·경고·Vitest 종료 timeout·실제 낭독/다른 환경 미실행은 보존.
- 기존 테스트는 공통 의미/연결·일부 순수 상태 로직을 보호한다. 신규 고객 폼·목록 상태·입력 검증/중복 판정·가상 비동기 정리는 보호하지 않는다.
- 신규 최소 자동: 이름/전화번호 검증·앞자리 0·번호 비교·동명이인·중복/늦은 완료 보호. 이벤트/포커스는 dev/preview 실제 브라우저 확인과 구분한다. DOM 도구·설치 없음.
- 후속 통합에서만 입증 가능: DB 영속성·동시 중복 방지·실제 실패 대응·인증/샵 접근 보호. 목업 성공으로 PASS 처리 금지.

## Risk: Medium

첫 feature/업무 route·폼 상태와 공통 UI를 연결한다. 기존 API를 바꾸지 않아 기존 소비자 영향은 제한적이나 제출 경쟁·실패 시 입력 유실·알림/포커스·가상 저장 오인 위험이 있다.

## Recommended action

[S001R2 계획](story.md)의 A 범위만 handoff 선택으로 승인. FE 리뷰/사용자 확인 후 전체 done 대신 사용자 BE 작업 의존성 대기로 기록한다. 후속 실제 연결은 사용자 승인과 변경된 기준 재검증 후 진행한다. 현재 하네스 blocked 복구/리뷰 지문 제약을 임의 우회하지 않는다.

근거: scope/index/S001 승인 이력·FE 구조·UI004 완료 기록, 고객 시안 이미지, 실제 package/router/root/Table/LiveNotice·서버 기본 등록 구조. 제품 QA NOT_RUN. 원본 소스·설치·생성물·승인 story 수정 없음.
