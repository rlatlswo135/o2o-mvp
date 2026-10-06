# Impact — UI004 조회 상태·처리 결과 피드백

## Target

신규 `client/src/shared/ui/{empty-state,skeleton,error-state,notice,toast}/`와 `routes/-feedback-review.tsx`(후보), 기존 `routes/index.tsx` 검토 영역 07·08 추가. 기존 공통 API·CSS 진입점·설정·토큰 값 변경 없음. `theme.stylex.ts`는 현재 의미 토큰 재사용을 우선하고 부족한 값만 추가 가능.

## Dependents

- 현재 검토 route 진입점 `routes/index.tsx` 한 곳에 신규 조립 추가. 기존 01~06 소비자는 그대로 유지한다.
- 직접 기반: 공통 Button, Table, Badge, `routes/-review-layout.tsx`. 기존 TableReview를 다시 마운트하지 않고 읽기 전용 가상 표를 조립해 라디오 name/id 충돌을 피한다.
- 테마는 Button/Field/Input/Select/Textarea/Choice/SegmentedControl/AmountField/Table/Badge/Dialog·검토 route들이 소비한다. 토큰 이름·값 변경은 이번 범위가 아니다. 추가만 해도 dev/preview CSS 적용·기존 UI를 확인한다.
- 신규 Notice 표현을 Toast가 재사용한다. live region 역할은 한 곳만 소유하며 정적 예시를 동적 결과와 구분한다.
- `rg -n 'Toast|Notice|Skeleton|EmptyState|ErrorState' client/src`에서 기존 제품 구현/소비자는 없다.

## Affected Stories

- UI004: 시안 07 조회 상태·재시도, 08 Notice/Toast. 로컬 상태·모든 Toast 수동 닫기의 계획안.
- UI001~UI003: 01~06은 변경 대상이 아니며 같은 검토 페이지의 회귀 대상이다. UI003 drag 보호를 유지한다.
- S001: 후속 업무 소비자. 고객 화면/API·BE 연결·기존 필수 학습 게이트 완료를 뜻하지 않는다.

## Test Coverage

- UI003 executor 최종 기록: 기존 SSR/Vitest 11파일 45/45, build 성공, dev/preview 각 41/41. planner 재실행 증거가 아니다.
- Button은 loading 속성·표시, Table은 caption·표 의미·선택 분기, Badge는 기호·정적 비알림 의미, Dialog는 aria 연결/닫힘 상태 등 SSR 검증이 있다.
- 신규 필요: 정적/동적 알림 role·의미 분기, 선택적 액션/닫기·설명 연결, 로딩 장식/busy. 실제 재시도 비동기 정리·키보드·포커스·반복 알림·단일 전달은 executor 브라우저 검증과 구분한다.
- 공백: 스크린리더 실제 낭독·다른 브라우저/OS·실기기. AX 결과로 대체 완료를 주장하지 않는다. 전체 check 기존 포맷 실패·Vitest 종료 timeout/exit 1은 기록과 실제 기준선을 비교한다.

## Prior Art / 설치본 한계

flame-ui 1.0.1 README·Toast 타입·dist 구현 직접 확인. 항상 예약되는 소멸 타이머·void 반환·pause/dismiss 공개 API 없음·role=status/aria-live=polite 고정·Toaster wrapper 클릭 제거 때문에 실패/경고 유지·실패 alert 요구를 충족하지 못한다. 설치본 수정이나 timeout 우회 대신, 소비자 로컬 상태 + 공통 Notice 표현 재사용·수동 닫기 Toast를 제안한다. 성공 자동 소멸·전역 store·provider·큐는 제외하며 handoff 선택이 해당 계획안의 구현 승인이다.

## Risk: Medium

신규 컴포넌트의 기존 fan-in은 없고 기존 API도 유지하지만, live region 중복 전달·동적 알림 인지·제거 시 포커스·가상 비동기 늦은 완료가 SSR만으로 보호되지 않는다. 토큰 값 변경은 폭넓은 회귀를 부르므로 금지한다.

## Recommended action

[UI004 계획](story.md)의 정확한 revision을 사용자에게 제시해 handoff/refine/discuss 선택. 승인 후 executor가 최소 자체 분기 자동 검증·dev/preview 조작 QA·사용자 시안 확인을 수행한다. 자동 DONE 없음.

근거: 현재 소스 import 검색, Button/TableReview/Badge/테마/검토 배치, 설치된 flame Toast 구현·타입, UI003 완료 기록, 시안 이미지. 제품 실행 검증 NOT_RUN. 승인된 UI001~UI003 story.md·공통 범위·구조 문서는 수정하지 않았다.
