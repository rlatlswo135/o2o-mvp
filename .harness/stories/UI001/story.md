# UI001 — 선택 값·사유·금액을 입력하고 확인한다

## 사용자 요구와 가치

시안의 선택 요소와 사유·금액 영역을 도메인 독립 공통 UI로 제공한다. 검토 화면에서 선택 → 사유/금액 입력 → 현재 값 확인까지 조작한다. 기존 Button·Field·Input은 사용자 확인된 기반으로 유지한다.

## 범위

[공통 범위·검증·완료 게이트](../shared-ui-scope.md)를 적용한다. 디자인은 `ui-01-inputs.png`의 03·04 영역이다.

- Select, Checkbox, Radio, Switch, 분할 단일 선택(시안 블루/플럼/세이지 모양).
- Textarea: 여러 줄 입력, label·안내·오류·required·disabled 연결.
- 금액 입력과 읽기 전용 금액 표시: 오른쪽 정렬, 원 단위, 양수/음수/0/빈 값 구분. 표시에는 `Intl.NumberFormat('ko-KR')` 활용.
- 기존 검토 화면에 모든 종류의 조작 예시와 현재 선택/입력 값 확인 영역을 추가한다. 이름·사유·금액은 가상 예시이고 계산·저장하지 않는다.
- 후보: `shared/ui/select.tsx`, `checkbox.tsx`, `radio.tsx`, `switch.tsx`, `segmented-control.tsx`, `textarea.tsx`, `amount-field.tsx` 및 작은 관련 테스트. 구성요소 수만큼 별도 추상화/파일을 강제하지 않는다.

## 제외 범위

기존 세 컴포넌트 재구현/API 변경, Table·Dialog·알림, 검색형/다중 Select, 중간 체크 상태, 실제 테마 변경, 폼 프레임워크, 고객 검증, 회원권 계산, 소수/외화, 입력 중 자동 쉼표·커서 보정, 새 의존성·설정·서버 변경.

## 의존성 / 남은 결정

- 기능 스토리 선행 없음. 현재 Field/Input/Button·StyleX 사용. S001의 전체 완료는 선행 조건이 아니다.
- 단순 선택은 네이티브 select/radio/checkbox 기반. Switch는 체크 가능한 컨트롤에 switch 의미를 제공하고 분할 선택은 radio 그룹 의미를 유지한다.
- Field의 단일 입력 id 연결은 Select/Textarea에 재사용한다. 라디오·분할 선택 그룹은 fieldset/legend 등 적합한 그룹 이름을 사용한다.
- 금액 입력은 정수 원 단위, 편집 중 원문을 보존한다. 빈 값은 0이 아니며 숫자로 바꿀 수 없거나 안전한 정수 범위를 벗어난 값은 오류로 알리고 NaN·0으로 조용히 변환하지 않는다. 음수 허용 여부 등 업무 규칙은 소비자 책임이다. 읽기 전용 예시 값은 소비자가 별도로 제공하며 '변경 후 잔액' 계산은 하지 않는다.
- 남은 차단 결정 없음. 세부 props는 기존 방식과 네이티브 이벤트를 우선한다. 기존 계약 변경 필요 시 구현 전 논의한다.

## 완료 조건

1. Given 선택 예시 When 마우스/키보드로 변경 Then Select·Checkbox·Radio·Switch·분할 선택의 값과 표시가 일치하고 radio 그룹에는 하나만 선택된다.
2. Given disabled 요소 When 클릭/키보드 조작 Then 값이 바뀌지 않는다. 활성 요소에는 접근 가능한 이름과 보이는 포커스가 있다.
3. Given Select/Textarea/금액 입력 When Field label 클릭 또는 안내·오류·required 제공 Then 해당 입력과 올바르게 연결되고 오류를 보조기기에서도 식별한다.
4. Given 사유 입력 When 여러 줄을 입력 Then 줄바꿈과 입력 값이 유지되며 공통 컴포넌트가 업무 검증·저장 요청을 하지 않는다.
5. Given 금액 예시 When 음수·0·양수·빈 값·잘못된 값 입력 Then 부호와 빈 값이 유지되고 유효하지 않은 값은 실패로 구분된다. 읽기 전용 -10000/0/30000은 -10,000/0/30,000과 원 단위로 표시된다.
6. Given 기존 Button·Field·Input 예시 When 신규 UI를 조립 Then 기존 동작·스타일·9개 테스트에 회귀가 없다. 작은 화면에서도 컨트롤과 단위를 사용할 수 있다.
7. Given 구현 결과 When 시안 03·04와 사용자 대조 Then 다섯 선택 종류·Textarea·금액 입력/표시 중 누락이 없음을 확인한다.

## 검증 / 완료 게이트

- 공통 문서의 client `vp check`, `vp test --run`, `vp run build`, dev/preview 브라우저 확인을 적용한다. 결과는 executor의 `implementation.md`에 남긴다.
- 최소 자동 검증: 새 Field 연결과 금액의 부호·0·빈 값·잘못된 값·안전 정수 경계. 네이티브 prop 전달만 검사하는 테스트를 늘리지 않는다.
- 수동: 각 선택 컨트롤 키보드 조작, label 클릭, disabled 차단, 사유 입력, 금액 표시·오류, 375px 화면. 사용자 최종 화면 확인 필요.
- 정확한 revision 구현 승인·QA·고정 기준 리뷰 및 사용자 결정·수동 확인·사용자 최종 완료 확인이 필요하다. 학습은 신규 필수 아님.
- `checkpoint.md`는 런타임만 갱신한다. 진행은 `implementation.md`, 리뷰는 `review-N.md`·`review-brief.md`. 승인 후 본 파일 동결.
