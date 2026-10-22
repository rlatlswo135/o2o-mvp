# S031 — 고객 건수 표시 정리와 flame-ui Drawer 적용

## 한 일
- 고객 페이지 제목 옆 배지와 `CustomerCount`, 표 하단 중복 건수를 제거하고 표 머리에 `전체 n명`을 한 번 표시하도록 정리했다.
- DataTable이 건수 계산·공통 표시·조회 상태별 노출을 맡고, 사용하는 기능은 `countLabel`로 단위와 문구를 지정하도록 했다. 정상 빈 결과는 0을 표시하고 숫자는 천 단위로 구분한다.
- 보이는 표 제목을 건수로 대체하면서 섹션·표의 접근 가능한 이름과 범용 footer 슬롯은 유지했다.
- 직접 구현한 모달 시트를 설치된 flame-ui Drawer 기반으로 교체했다. 기존 오른쪽/하단 배치·스타일·스크롤 잠금·포커스·저장 중 닫힘 차단과 고객 등록·수정 동작을 유지했다.
- 건수 표시와 Drawer 연동의 회귀 테스트를 보강했다.
- flame-ui 후속 개선 후보를 정리했다: 사용자 닫기 정책, 제어형 open/onOpenChange, 반응형 placement, Content의 ref·이벤트 전달, 인라인 크기 스타일, section 래퍼 높이, 배경 클릭의 누름·뗌 판정. 라이브러리 자체·의존성·서버·공유 contract는 변경하지 않았다.

## 바뀐 파일
- `client/src/shared/ui/sheet/sheet.tsx`
- `client/src/shared/ui/sheet/sheet.test.tsx`
- `client/src/shared/ui/data-table/data-table.tsx`
- `client/src/shared/ui/data-table/data-table.test.tsx`
- `client/src/features/customers/customer-list.tsx`
- `client/src/features/customers/customers-page.tsx`

<!-- c2h:sealed 20261020T093001741000Z-58ccb10b7075 -->
