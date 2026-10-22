# S033 — TanStack 기반 공통 테이블과 고객·시술 목록 이관

## 한 일
- `@tanstack/react-table` 9.3.1 기반으로 공통 테이블을 교체하고 `DataTable.Root`, `Header`, `Count`, `Content`, `Footer`, `PageSize`, `Pagination`을 조합하는 compound API를 제공했다. 기존 네이티브 표와 StyleX 디자인을 재사용했다.
- 고객·시술 목록을 새 테이블로 이관했다. 정적 컬럼은 파일 하단에 두고 고객 수정 버튼의 이벤트는 화면에서 직접 연결하며, 기존 등록·수정 Drawer와 포커스 복귀를 유지했다.
- 두 목록에 클라이언트 페이지네이션을 적용했다. 초기 10행과 10/20/50행 선택, 이전·다음 이동, 전체 건수·페이지 안내를 제공한다. 행 증가 시 첫 페이지 이동, 수정 시 현재 페이지 유지, 목록 감소 시 페이지 범위 보정을 처리한다.
- 조회 상태 판정을 공통화하고 스켈레톤·오류·빈 결과를 컴포넌트 슬롯으로 구성했다. 재조회 실패 시 기존 결과를 유지하며, 빈 목록의 재조회 실패와 오프라인 재시도도 구분해 표시한다.
- 공용 재시도 오류 컴포넌트를 추가해 재시도 중 중복 조작 방지·상태 안내·포커스 유지를 제공했다. 수정 행 배경 강조와 `selectedKey` 등 선택 전용 API·스타일은 제거했다.
- 외부 페이지 상태와 `manualPagination`·전체 건수를 연결할 수 있게 하고, 관련 테스트와 `client/AGENTS.md`의 사용 규칙을 갱신했다. 셀·헤더 템플릿은 hook 없는 렌더 함수로 사용하도록 규칙을 명시했다.
- 서버·공유 API 계약·React Compiler 설정은 변경하지 않았다. 실제 두 목록은 전체 조회 결과를 FE에서 나누며, 시술 데이터의 가상 저장 방식과 안내도 유지했다.

## 바뀐 파일
- `client/src/shared/ui/data-table/` — compound UI·조회 상태·TanStack 엔진·테스트
- `client/src/shared/ui/error-state/retry-error-state.tsx` 및 테스트
- `client/src/shared/ui/table/`, `client/src/shared/ui/theme.stylex.ts` — 선택 API·스타일 제거
- `client/src/features/customers/`, `client/src/features/treatments/` — 목록 이관·페이지 연결·회귀 테스트
- `client/AGENTS.md`, `client/package.json`, `pnpm-lock.yaml`

<!-- c2h:sealed 20261021T100849132000Z-10601f056876 -->
