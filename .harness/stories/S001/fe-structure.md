# FE 구조 확정 — shared/ui 공통 컴포넌트 먼저

## 목적과 승인 경계

현재 스캐폴딩을 유지하면서 공통 UI를 먼저 개발하고, 이후 업무 기능 화면에서 조립하는 기준이다.
사용자는 FE 구조 확정·공통 UI 개발 인계를 승인했고, 이번 정정으로 `features/customers/ui/` 선개발이 아니라 **`src/shared/ui/`의 도메인 독립 컴포넌트 선개발**임을 명확히 했다.
이전의 '두 번째 기능 소비자가 생겨야 shared로 이동', 'shared 선구현 금지' 지침은 철회한다.
현재 실행 범위는 첫 공통 UI 묶음 Button·Input·Field·최소 StyleX 테마다. 고객 업무 화면·API 연결은 이 묶음의 리뷰 뒤 진행한다.
S001 전체는 고객 등록·목록 통합 스토리다. 이번 공통 UI 단계 완료만으로 S001을 DONE 처리하지 않는다.
`/executor` 선택·인계 수락 전까지 AWAITING_APPROVAL/담당 planner를 유지한다. planner는 소스 구현하지 않는다.

## 현재 스캐폴딩 근거

- `client/vite.config.ts`: Vite+·TanStack Start·StyleX·React 구성.
- `client/src/router.tsx`와 `src/routes/`: 생성된 routeTree를 사용하는 파일 기반 Router.
- `src/routes/__root.tsx`: 문서 shell·head·스타일 로딩·개발 도구·Scripts 유지.
- `src/routes/index.tsx`: 현재 `/` 스타터 화면. `src/routeTree.gen.ts`는 직접 수정하지 않는다.
- `src/styles.css`: 전역 reset 유지.
- `client/package.json`: React 19·StyleX·flame-ui 설치됨. Query·Zod·Zustand·Table·Form은 선언되지 않음.
- 현재 소스 테스트·coverage 설정·루트 CONVENTIONS.md 없음. 검증 통과나 FIRST 감사 완료를 주장하지 않는다.

## 확정 구조

| 위치 | 책임 | 제외 |
| --- | --- | --- |
| `src/routes/` | 파일 기반 라우팅·페이지 조립·라우트 옵션. 필요한 loader는 기능 함수에 위임 | 업무 검증·폼/목록 로직 집중 |
| `src/features/<feature>/` | 업무 페이지·도메인 UI·로컬 상태·검증·데이터 접근·기능 hooks | 범용 Button/Input/Field를 고객 전용으로 소유 |
| `src/shared/ui/` | 기능 간 공통으로 쓸 도메인 독립 UI·공통 스타일/테마. 처음부터 여기서 개발 | 고객·예약 등 업무 규칙/문구·API 의존 |
| `src/shared/hooks/` | 실제 공통으로 필요한 범용 hooks | 기능 전용 hook·불필요한 hook 선구현 |

의존 방향은 `routes → features → shared`. shared는 features/routes를 import하지 않는다. features는 라우트 모듈을 import하지 않는다.
'여러 기능에서 공유되는 범용 UI'는 도메인 독립 책임을 뜻한다. 이번 명시 승인된 공통 UI 작업에 두 번째 feature 구현을 선행 조건으로 추가하지 않는다.

```text
client/src/
  shared/
    ui/                         # 지금 구현할 첫 공통 UI 묶음
      Button.tsx
      Input.tsx
      Field.tsx
      theme.stylex.ts
  features/
    customers/                  # 공통 UI 리뷰 이후 업무 화면 단계
      CustomersPage.tsx
      CustomerForm.tsx
      CustomerList.tsx
  routes/
    __root.tsx                  # 기존 Start 문서 shell
    index.tsx                   # 필요한 최소 UI 검토용 조립만 허용
    customers.tsx               # 후속 업무 화면 단계에서 /customers 연결
```

파일 구분은 책임 기준이다. 별도 패키지·전체 UI 카탈로그·빈 hooks 디렉터리·barrel을 의무로 만들지 않는다.
`/customers` 경로는 확정이다. `/`의 구체 진입 UX는 업무 화면 단계에서 확인한다. 이번에는 redirect나 업무 라우트를 추가하지 않는다.

## 첫 공통 UI 묶음 — 도메인 로직 없음

- **Button**: 기본/보조 표현·포커스·disabled·loading 등 첫 시안에 필요한 상태. 문구·동작은 소비자가 전달한다.
- **Input**: 기본·포커스·오류·disabled 표현과 네이티브 입력 props. 이름/전화번호 전용 검증은 넣지 않는다.
- **Field**: label·필수 표시·도움말·오류 설명 및 입력과의 접근성 연결. 고객 필드명·중복 번호 메시지는 넣지 않는다.
- **테마**: 배경·텍스트·주요 동작·경계·오류 등 필요한 의미 기반 StyleX 토큰. 테마 선택·저장·Provider는 이번 범위가 아니다.

[선택 시안](../../design/README.md)의 입력·피드백 이미지와 잉크 블루 방향을 적용한다.
설치된 flame-ui의 실제 API·접근성을 확인해 필요한 동작을 재사용하고, 그 위에 프로젝트 공통 StyleX 스타일을 적용한다. 네이티브 요소로 충분한 부분에 불필요한 래퍼는 만들지 않는다.
전역 reset은 styles.css, 공통 컴포넌트 스타일/테마는 shared/ui, 후속 업무 화면 스타일은 features에 둔다.
고객 이름·전화번호 예시는 검토용 소비자 데이터일 뿐 공통 컴포넌트의 책임이나 인터페이스가 아니다.

## 순서와 완료 기준

1. **공통 UI 개발**: shared/ui의 첫 묶음만 구현한다. 최소 렌더로 기본/포커스/오류/disabled/loading 상태와 접근성을 확인하고 사용자 화면·코드 리뷰를 받는다.
2. **업무 화면**: 리뷰된 공통 UI를 features/customers의 고객 폼·목록에서 사용하고, routes는 페이지를 조립한다. BE 준비 전에는 가상 데이터만 사용한다.
3. **실제 연결**: 사용자 BE 규약에 맞춰 고객 feature를 연결하고 S001 완료 조건을 검증한다. blur 중복 조회는 추가하지 않는다.

현재 1단계 완료 기준:
- 공통 UI와 테마가 shared/ui에 있고 customers feature를 import하지 않는다.
- props·내장 문구·검증·요청에 고객/예약 업무 규칙이 없다.
- label·오류 설명·키보드 포커스·disabled/loading의 동작을 실제 렌더에서 확인한다.
- 구현 파일·실제 검사 결과·미검증 항목을 implementation.md에 남기고 사용자 리뷰를 기다린다.

UI 묶음은 점진적으로 확장한다. Select·Drawer·Table·전체 카탈로그·업무 메뉴를 이번 첫 묶음에 자동 추가하지 않는다.

## 검증과 인계

lint·typecheck·tests·coverage gate는 모두 유지한다. disable/skip/임의 임계값 완화로 통과시키지 않는다.
executor는 기존 Vite+ 명령(`vp check`, `vp test`, `vp run build`)의 실제 검사 범위와 typecheck·coverage 누락을 확인한다.
없는 테스트/coverage 설정이나 도구 설치는 사용자 구성 결정을 요청한다. 미구성을 PASS로 처리하지 않는다.
테스트는 F.I.R.S.T 기준으로 평가하되 CONVENTIONS.md 정본 없이 감사 완료를 선언하지 않는다.
이번 planner 작업은 문서 정정만 수행했다. 제품 검증은 NOT_RUN.

문서 verify: `git diff --check -- .harness/ && test -s .harness/stories/S001/fe-structure.md`

executor는 **최신 스토리의 구현 인계와 이 수정본을 다시 읽어야 한다**. 이전 features/customers/ui 인계는 사용하지 않는다.
새 에이전트·하네스·설치·설정 변경·server/ 수정·커밋·푸시는 승인하지 않았다. 구현 뒤 사용자 리뷰 및 명시적 `/harness-review` 요청을 기다린다.
