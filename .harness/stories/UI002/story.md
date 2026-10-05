# UI002 — 목록에서 행과 상태를 구분한다

## 사용자 요구와 가치

시안 `ui-02-feedback.png`의 05 영역을 구현한다. 가상 목록에서 열·행을 읽고 한 행을 선택하며, 상태를 색상뿐 아니라 문구로 구분한다. UI001의 선택·금액 기반을 재사용하고 고객 업무 기능과 분리한다.

## 범위

[공통 범위·검증·완료 게이트](../shared-ui-scope.md)를 유지한다. UI001 완료 이후의 파일 배치·검증 기준은 아래 조건을 적용한다.

- 네이티브 table 기반 Table 표현: 헤더·본문·행·셀, 숫자 열 오른쪽 정렬, 선택 행 강조. 접근 가능한 표 이름(caption 등)과 헤더 관계를 유지한다.
- Badge: 정보/성공/중립/경고/위험 다섯 의미 표현. 예정·완료·취소·확인 필요·처리 실패·사용 안 함은 소비자 예시 문구이며 공통 업무 enum으로 고정하지 않는다.
- 기존 `/` 검토 화면에 시안처럼 가상 고객·시술·상태·금액 세 행을 표시하고, 한 행을 선택해 현재 선택 값을 확인한다. 별도 상태 예시로 다섯 Badge 표현을 모두 보여준다.
- 행 선택은 접근 가능한 네이티브 radio 등 명시적 조작부로 제공한다. name을 공유하며 각 이름에 행 식별 문구를 포함한다. 상태·콜백은 검토 화면이 소유하고 Table은 선택 표현만 제공한다. 행 클릭 전용 구현은 하지 않는다.
- 기존 `formatAmount`로 120000/30000/0을 120,000/30,000/0원으로 표시한다. 셀은 일반 텍스트/data로 조립해 기존 AmountDisplay의 폼 output·상자 스타일을 표에 강제하지 않는다.
- `theme.stylex.ts`에 실제 필요한 성공·경고·정보 배경 등 의미 토큰만 추가한다. 기존 토큰 이름·값, 기존 UI의 API·스타일은 유지한다.

## 대상 파일 / 구조

[UI001에서 확정된 현재 UI 구조](../ui-structure.md)를 따른다.

- `client/src/shared/ui/table/table.tsx`, `table.test.tsx`(자체 판단이 있는 경우).
- `client/src/shared/ui/badge/badge.tsx`, `badge.test.tsx`(의미 매핑 등).
- `client/src/shared/ui/theme.stylex.ts`: 필요한 토큰 추가만.
- `client/src/routes/index.tsx`, `-table-review.tsx`(후보): 기존 검토 화면의 05 영역 조립. 기존 `-review-layout.tsx`를 재사용하고 필요한 배치 확장만 허용한다. `-` 파일은 새 라우트가 아니다.
- 컴포넌트별 폴더·테스트 동반, barrel 없음, 직접 경로 import. `internal/`은 shared/ui 안에서만 사용한다. 기존 입력·금액 util·CSS 진입점 파일은 수정 대상이 아니다.

## 제외 범위

실제 고객/예약 목록·상태 전이, 검색·정렬·필터·페이지네이션·다중 선택·가상화, Table 라이브러리·범용 column schema·공통 선택 상태 manager, 잔액 계산·API·저장, Dialog·피드백(UI003/UI004), 새 의존성·DOM 테스트 도구·설정·server/ 변경·커밋·푸시. 기존 Button/Field/Input·UI001 컴포넌트 재설계는 제외한다.

## 의존성 / 남은 결정

- UI001 `done` checkpoint와 사용자 완료 확인 검증됨. 완료 인계 ID `20261005T105204104000Z-f41fd5f31b9b`. 이번 계획은 별도 handoff 전 구현 미승인이다.
- UI001의 CSS 진입점 수정과 폴더 재배치 완료본을 기반으로 사용한다. 이전 dev/preview CSS 결함을 남아 있는 것으로 간주하거나 설정을 다시 수정하지 않는다. 회귀 여부는 executor가 확인한다.
- 표 데이터·문구·금액·선택은 소비자 소유. 필요하면 기존 선택 컨트롤을 재사용하되 RadioGroup의 fieldset/div를 tbody/tr 사이에 넣지 않는다. 네이티브 radio를 셀 안에 배치하는 최소 구현으로 충분하다.
- Table/Badge 공개 API는 네이티브 props와 children 조립을 우선한다. 기능 없는 추상화는 추가하지 않는다. 남은 차단 결정 없음. 기존 계약 변경 필요 시 멈추고 범위 확인.

## 완료 조건

1. Given 가상 세 행 When 렌더 Then 표 이름과 헤더·셀 관계를 보조기기가 식별하고 네이티브 table 구조가 유지된다. 금액 열이 오른쪽 정렬되며 0원도 빈 값으로 숨기지 않는다.
2. Given 여러 행 When 키보드/마우스로 선택 조작부 변경 Then 해당 행 하나만 강조되고 현재 선택 값이 일치한다. radio 이름·checked 의미로 보조기기도 선택을 식별한다. 임의의 grid 역할이나 지원되지 않는 aria-selected를 table에 추가하지 않는다.
3. Given 시안의 여섯 상태 문구 When Badge 표시 Then 다섯 의미 표현이 제공되고 색상을 보지 못해도 문구로 구분된다. 정적 Badge마다 live region을 붙이지 않는다.
4. Given 375px 화면 When 표 조회·키보드 조작 Then 필요한 가로 스크롤은 표 영역에만 생기고 키보드로도 내용을 볼 수 있다. 페이지 전체 넘침이나 선택 조작부 잘림이 없다.
5. Given 기존 01~04 검토 예시 When Table·Badge 추가 Then 기존 동작·CSS·금액 표시와 기존 30개 테스트에 회귀가 없다. shared/ui는 features/routes·업무 규칙에 의존하지 않는다.
6. Given 구현 결과 When 시안 05와 사용자 대조 Then 표·선택 행·금액 정렬·여섯 상태 문구가 모두 확인된다. 이 결과를 공통 UI 전체 또는 S001 완료로 기록하지 않는다.

## 검증 계획

- executor가 client에서 `vp check`, 변경 파일 검사, `vp test --run`, `vp run build` 실행. 기존 전체 검사 실패와 새 실패를 구분하고 gate를 완화하지 않는다. UI001 마지막 기록은 8파일 30테스트 PASS, 전체 check는 기존 포맷 3파일 실패·기존 경고 1개이며 현재 상태는 다시 확인한다.
- 자동: 자체 Badge 의미 매핑·선택 행 표시 분기와 표 구조에 필요한 작은 SSR 검증. 기존 테스트 유지. 네이티브 prop 전달만 확인하는 테스트·과도한 snapshot은 제외한다.
- executor dev/production preview: 원본 CSS 적용, 표 구조/AX 이름·헤더, radio 클릭·Tab/화살표·보이는 포커스·선택 불일치 없음, 다섯 Badge 의미, 금액 정렬, 375px 가로 스크롤·페이지 넘침 없음 확인.
- 수동 테스트 필요: 사용자 시안 05 대조·키보드 행 선택·좁은 화면 확인. 스크린리더 실청취 등 미실행은 별도로 기록하고 AX 결과로 대체 완료를 주장하지 않는다.
- 학습: 신규 필수 아님(사용자 선택 없음). S001의 기존 학습 게이트는 유지한다.

## 완료 게이트 / 기록

정확한 revision 구현 승인 → executor QA 증거 → 고정 기준 코드 리뷰와 사용자 결정 → 수동 사용자 확인 → 사용자 최종 완료 확인. 자동 DONE 금지. 반복 한도는 공통 범위를 따른다.

`checkpoint.md`는 런타임만 갱신한다. 진행은 `implementation.md`, 리뷰는 `review-N.md`·`review-brief.md`, 완료 인계 수락은 `planning.md`. 승인 후 본 파일 동결.
