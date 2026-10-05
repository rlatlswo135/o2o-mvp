# UI004 — 로딩·빈 결과·실패를 구분하고 처리 결과를 확인한다

## 사용자 요구와 가치

시안 `ui-02-feedback.png`의 07·08 영역을 구현한다. 기존 `/` 검토 화면에서 가상 조회 상태를 바꾸고 실패 후 재시도하며, 성공/경고/실패 결과를 인라인 Notice와 화면 가장자리 Toast로 확인한다. 공통 UI 묶음의 마지막 스토리이며 고객 업무 기능(S001) 완료와 구분한다.

## 범위

[공통 범위·검증·완료 게이트](../shared-ui-scope.md)와 [현재 UI 구조](../ui-structure.md)를 적용한다.

- EmptyState: 제목·설명·선택적 액션. 액션 유무를 각각 시연한다.
- Skeleton: 시안의 목록 placeholder. 장식은 보조기기에서 숨기고 소비자 조회 영역에 로딩 문구·busy 의미를 제공한다. 기본은 정적 표현으로 움직임·타이머를 추가하지 않는다.
- ErrorState: 조회 실패 설명·선택적 재시도 액션. 오류를 빈 결과로 표현하지 않는다.
- Notice: 성공·경고·실패의 기호·텍스트·의미색, 제목·설명·선택적 닫기. 정적 시안 예시와 동적 결과 알림을 구분한다.
- Toast: Notice 표현을 재사용하는 도메인 독립 비모달 알림. 소비자가 표시 상태·문구·닫기 콜백을 관리하며 성공/경고/실패 모두 수동 닫기만 제공한다. 공통 컴포넌트에 알림 저장소·전역 imperative API·자동 소멸 타이머를 만들지 않는다.
- 검토 route 로컬 상태로 loading/empty/error/data를 선택한다. error → 재시도 → loading → 가상 data 흐름을 시연한다. data는 UI002의 공통 Table·Badge를 사용한 작은 읽기 전용 표로 조립한다. 기존 TableReview를 복제해 행 선택 그룹을 중복 마운트하지 않는다.
- Notice/Toast는 별도 조작으로 시연한다. 한 사건을 양쪽에 동시에 알리지 않는다. Toast 데모는 한 번에 하나만 표시하고 열린 동안 새 표시 버튼을 막는다. 닫기 후 다른 결과를 다시 띄울 수 있다. 큐·중첩·알림 이력은 만들지 않는다.
- 기존 시안 01~06과 공통 UI API·토큰 값은 유지한다. 실제 API 요청·저장·고객 등록·예약 변경은 발생하지 않는다.

## 대상 파일 / 구조

- `client/src/shared/ui/empty-state/empty-state.tsx`, `skeleton/skeleton.tsx`, `error-state/error-state.tsx`, `notice/notice.tsx`, `toast/toast.tsx`: 최소 공통 표현·접근성. 자체 분기·연결 테스트는 해당 폴더에 함께 둔다. prop 전달뿐인 테스트용 util이나 불필요 공통 framework는 추가하지 않는다.
- `client/src/routes/-feedback-review.tsx`(후보), `routes/index.tsx`: 07·08 조립·소비자 로컬 상태. 기존 `-review-layout.tsx` 배치를 재사용한다. 필요한 배치 보강만 허용한다.
- `theme.stylex.ts` 기존 success/warning/danger 및 surface/border 토큰을 우선 재사용한다. 실제 부족한 토큰만 추가하며 기존 이름·값은 바꾸지 않는다.
- 소문자 컴포넌트별 폴더·직접 경로 import·barrel 없음. shared/ui는 routes/features·업무 규칙을 import하지 않는다. Notice/Toast의 같은 표현은 재사용하되 중첩 live region은 만들지 않는다.

## 제외 범위

실제 fetch·서버 연결·재시도 정책·캐시·에러 수집, 폼 오류 정책 변경, 전역 알림 저장소·provider·imperative toast API·알림 큐·영속 알림함, 자동 Toast 소멸·타이머 pause 기능·애니메이션 시스템, 새로운 업무 route·카탈로그 도구, 새 의존성·DOM 테스트 도구·설정/CSS 진입점 변경·server/ 수정·커밋·푸시, UI001~UI003 또는 Button/Field/Input 재설계.

## 의존성 / 결정 / 남은 결정

- UI003 done·사용자 최종 확인·planning_request `20261006T022710116000Z-796f13c22fdd` 검증됨. UI002 Table/Badge와 기존 Button이 기반이고 UI001~UI003은 회귀 확인 대상이다. 현재 계획 작성은 구현 승인이 아니다.
- 설치된 flame-ui 1.0.1 README·타입·`dist/index.js` Toast 구현을 확인했다. `toast(content, { timeout? })`는 항상 타이머를 예약하며 void를 반환한다. 유지·pause·개별 dismiss API가 없고 ToastRoot는 전달 props 뒤에 `role=status`·`aria-live=polite`를 고정한다. Toaster는 wrapper 클릭으로 제거한다. timeout=0/Infinity 같은 우회로 유지 요구를 만족했다고 하지 않는다.
- 따라서 기존 초안의 조건부 대안으로 로컬 상태 + Notice 표현 재사용의 수동 닫기 Toast를 계획한다. 한계와 최소 대안을 사용자에게 제시한 뒤 받은 “UI004 플랜 들어가자”는 계획 착수 요청이다. 이 대안을 포함한 정확한 범위는 handoff 선택으로 별도 승인받는다. flame-ui/설치본 수정·억지 재사용은 제외한다.
- 문구·조회 상태·결과·재시도는 소비자 소유. 가상 재시도는 잠깐의 로딩 후 data로 전환한다. 실제 비동기 대기 구현 시 중복 재시도를 막고 상태 변경·언마운트 뒤 늦은 완료가 새 상태를 덮지 않게 정리한다. 업무 재시도 엔진은 만들지 않는다.
- 정적 08 시안 예시는 live region 없이 표시한다. 동적 성공·경고는 status(정중한 알림), 즉각 알려야 할 실패는 alert 의미를 사용한다. 기호는 장식으로 숨기며 텍스트로 결과를 설명한다. 같은 결과를 중첩/복수 live region에서 중복 전달하지 않는다. 동적 알림은 빈 알림 영역을 먼저 유지하고 내용 갱신하는 등 실제 전달 가능한 구조를 브라우저에서 확인한다.
- 알림 표시 시 포커스를 빼앗지 않는다. 닫기 버튼에 대상 식별 가능한 이름과 보이는 포커스를 제공한다. 키보드로 닫아 해당 버튼이 사라지면 소비자가 관련 표시 트리거 등 유효한 곳에 포커스를 돌린다. Toast 전체 클릭을 닫기 동작으로 만들지 않는다.
- Toast 한 개 제한은 검토용 최소 범위다. 실제 업무에서 동시 알림이 필요하면 별도 계획한다. 성공 자동 소멸은 이번 범위가 아니므로 hover/포커스 pause 구현도 필요 없다.
- 남은 차단 결정 없음. 저장된 계획안을 검토·보강·논의할 수 있으며 구현은 명시적 handoff 전 금지다.

## 완료 조건

1. Given loading/empty/error/data When 상태 전환 Then 해당 표현만 보이고 실패를 데이터 없음으로 오인시키지 않는다. 로딩 영역은 busy·읽을 수 있는 로딩 문구를 갖고 Skeleton 장식은 보조기기에서 숨겨진다. data는 공통 Table/Badge로 조회할 수 있다.
2. Given error When 재시도 Then 콜백이 한 번 실행되고 loading을 거쳐 가상 data로 전환된다. 로딩 중 중복 재시도를 막으며 늦은 완료가 다른 선택 상태를 덮지 않는다. 네트워크 요청 없음.
3. Given 빈 상태 When 액션 제공/미제공 Then 설명은 항상 보이고 제공된 액션만 조작할 수 있다. 조작 결과는 검토 화면 로컬 결과일 뿐 실제 고객을 등록하지 않는다.
4. Given 성공/경고/실패 When 동적 Notice 또는 Toast 표시 Then 색상 외에 기호·텍스트로 의미가 구분된다. 성공/경고는 status, 실패는 alert로 전달하고 표시 시 포커스를 뺏지 않는다. 정적 예시·내부 재사용 표현은 같은 사건을 추가 낭독하지 않는다.
5. Given 닫을 수 있는 Notice/Toast When 키보드로 닫기 Then 대상만 제거되고 다른 예시는 유지된다. 유효한 곳으로 포커스가 복귀하며 반복 표시/닫기가 동작한다. 모든 Toast는 시간이 지나도 유지되고 본문 클릭으로 닫히지 않는다. Toast가 열려 있으면 새 표시 조작은 막혀 미확인 결과가 교체되지 않는다.
6. Given 375px/긴 문구/동작 감소 설정 When 상태·알림 조작 Then 핵심 조작이 가려지지 않고 닫기·재시도에 접근할 수 있다. 페이지 전체 가로 넘침 없음. Skeleton/Toast는 기본 정적 표현으로 reduced-motion 환경에서도 로딩 의미가 유지된다.
7. Given 기존 01~06 When 07·08 추가 Then 선택·금액·표/Badge·Dialog 열기/취소/확인/drag 보호와 기존 테스트에 회귀가 없다. 공통 UI는 업무/route에 의존하지 않는다.
8. Given UI001~UI004 결과 When 사용자가 두 시안 대응표 확인 Then 03~08 누락이 없고 기존 01~02는 유지된다. 시안 07·08 및 이번 수동 닫기 Toast 방향을 확인하며 공통 UI 완료를 S001 고객 기능 완료로 확장하지 않는다.

## 검증 계획

- executor가 client에서 착수 전 기준선·변경 후 `vp check`, 변경 파일 검사, `vp test --run`, `vp run build`를 실행한다. UI003 최종 증거는 11파일 45/45 PASS·build 성공·dev/preview 각 41/41. 전체 check 기존 포맷 3파일 실패·기존 경고 1개·Vitest 종료 timeout/exit 1은 실제 현재 결과와 비교해 신규 실패와 구분한다.
- 최소 자동: 실제 자체 분기(정적/동적 role, 성공/경고/실패 의미, 설명/액션/닫기 유무, 로딩 장식·busy 연결)를 기존 SSR/Vitest 방식으로 확인한다. 소비자 재시도에 비동기 대기를 쓰면 중복/늦은 완료 정리 검증을 남긴다. 테스트 편의를 위해 DOM 도구·불필요 상태 프레임워크를 추가하지 않는다. SSR로 확인 못 하는 이벤트·포커스·낭독은 자동 통과로 위장하지 않는다.
- executor dev 및 production preview 원본 CSS·AX 의미 확인: 네 상태·재시도·중복/늦은 완료, 빈 액션 유무, 정적 예시와 동적 알림 구분, 모든 의미의 Notice/Toast·단일 전달 구조, 키보드 닫기·포커스 유지/복귀·반복 표시, 시간 경과에도 Toast 유지·본문 클릭 비닫힘, 375px·긴 문구·reduced-motion.
- 기존 01~06은 작은 회귀 확인을 수행한다. 특히 같은 이름의 라디오 그룹·id 중복이 없어야 하고 UI003 입력→배경 drag로 닫히지 않는 완료본을 유지한다. 자동 기존 45개 보존.
- 사용자 수동 확인: 시안 07·08 대조, 실패→재시도, Notice/Toast 표시·닫기·다시 표시, 실패/경고 유지·좁은 화면 및 두 시안 전체 대응표. 실제 스크린리더 낭독·Safari/Firefox/실기기 미실행은 기록하며 AX 확인과 구분한다.
- 학습: 신규 필수 아님(선택 없음). S001 기존 학습 게이트 유지.

## 완료 게이트 / 기록

정확한 revision 구현 승인 → executor QA → 고정 기준 코드 리뷰와 사용자 결정 → 수동 사용자 확인 → 사용자 최종 완료 확인. 자동 DONE 금지. 코드리뷰/Fix·QA/Fix 각각 최대 3회, 동일 실패 연속 2회면 blocked.

`checkpoint.md`는 런타임만 갱신한다. 진행은 `implementation.md`, 리뷰는 `review-N.md`·`review-brief.md`, 완료 인계 수락은 `planning.md`. 승인 후 본 파일 동결.
