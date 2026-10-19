# UI001 — 선택 값·사유·금액을 입력하고 확인한다

## 한 일
- 공통 입력 컴포넌트 추가: Select, Textarea, Checkbox·Switch·RadioGroup·Radio(choice), SegmentedControl, AmountInput·AmountDisplay. 기존 Field의 label·오류·설명 연결을 그대로 재사용한다.
- 금액 해석·표시 util(`parseAmount`, `formatAmount`). 업무 규칙(음수 허용 등)은 소비자가 정한다.
- 사용자 요청으로 `shared/ui`를 컴포넌트별 폴더(테스트 동반, `internal/`, barrel 없이 직접 경로 import)로 재배치. 기존 Button·Field·Input은 위치만 옮겼다.
- 검토 화면 `/`에 03·04(선택·사유·금액) 섹션 추가.

## 바뀐 파일
- client/src/shared/ui/: select/, textarea/, choice/, segmented-control/, amount-field/(amount-field.util.ts 포함), internal/control-styles.ts, button/·field/·input/ 폴더 이동
- client/src/routes/: index.tsx, -selection-review.tsx, -amount-review.tsx, -review-layout.tsx
