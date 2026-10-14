## 컴포넌트 타입

- 컴포넌트 Props와 관련 입력·옵션·컨텍스트 타입은 `interface` 대신 `type` alias를 사용한다.
- 네이티브 Props는 중간 별칭 없이 `Omit<ComponentPropsWithRef<...>, ...> & { ... }`로 직접 정의한다.
- 선언 병합이 필요한 `interface`와 자동 생성 코드는 변경하지 않는다.

## 파일 이름

- 이름은 kebab-case로 쓰고, 역할은 점 뒤 접미사로 붙인다.
- 기능 폴더(`features/<도메인 복수형>/`)의 역할 파일은 `<폴더 이름>.<역할>.ts`로 짓는다. 서버와 같은 규칙이다. 예: `customers.schema.ts`(zod 스키마·추론 타입), `customers.api.ts`(query 객체·등록 등 서버 상태 함수).
- 컴포넌트 파일은 컴포넌트 이름의 kebab-case로 짓는다. 단·복수는 컴포넌트 이름을 따른다. 예: `CustomerForm` → `customer-form.tsx`, `CustomersPage` → `customers-page.tsx`.
- 역할 파일에는 그 역할만 둔다. 스키마 파일에 검증 래퍼·문자열 가공 함수를 쌓지 않는다.

## 테스트

- 기능 테스트는 `<폴더 이름>.test.ts`에 동작 시나리오로 쓴다. 파일 단위가 아니라 "목록 조회", "등록"처럼 사용자가 겪는 동작으로 `describe`/`it`을 나누고, 경계(HTTP 계약) 안쪽은 실물로 돌린다.
- 공용 UI는 컴포넌트 옆 `<이름>.test.tsx`에 둔다.

## 메모이제이션

- 메모이제이션은 React Compiler가 맡는다. `useMemo`·`useCallback`·`memo`를 쓰지 않는다.
- 함수 identity에 기대는 effect 의존성을 만들지 않는다. cleanup이 컴포넌트 안 함수를 참조하면 렌더마다 다시 실행된다.

## 서버 상태 (TanStack Query)

- 도메인별 query 객체를 둔다. `all()`은 부분 키 무효화용 키를, 나머지는 `queryOptions(...)`를 반환하며 queryKey는 `all()`에서 이어 만든다.

  ```ts
  export const customerQueries = {
    all: () => ["customers"] as const,
    list: () => queryOptions({ queryKey: [...customerQueries.all(), "list"], queryFn }),
  };
  ```

- 특정 쿼리의 키는 `customerQueries.list().queryKey`로 꺼낸다. 키 배열을 직접 쓰지 않는다.
- query 객체에는 queryKey·queryFn만 둔다. 앱 공통 staleTime·retry는 QueryClient `defaultOptions`, 화면별 값은 사용처에서 `useQuery({ ...customerQueries.list(), retry: 1 })`로 덮는다.
- mutation은 `mutationOptions` 래퍼 없이 컴포넌트에서 `useMutation({...})`을 인라인으로 쓴다.
- 콜백 위치를 나눈다.
  - 캐시 갱신·무효화처럼 화면과 무관하게 반드시 일어나야 하는 일 → `useMutation` 옵션(`mutationFn`·`onSuccess` 등). 컴포넌트가 언마운트돼도 실행된다.
  - 패널 닫기·토스트·폼 오류·포커스처럼 화면에 묶인 일 → `mutate(input, { onSuccess })`. 언마운트되면 실행되지 않는다.

## 조회 목록

- 목록 화면은 `@/shared/ui/data-table/data-table.tsx`의 `DataTable`로 그린다. 불러오는 중·실패·빈 결과·재조회 실패(이전 목록 유지) 판정과 다시 시도는 DataTable이 맡으므로 기능마다 조회 상태를 변환하는 함수를 만들지 않는다.
- `useQuery`는 목록 컴포넌트 안에서 부르고 결과를 그대로 `query`로 넘긴다. 같은 데이터가 필요한 다른 곳(건수 등)도 같은 query 객체로 `useQuery`를 부른다.
- 목록에 대한 동작(등록 버튼 등)은 `toolbar`, 합계 등은 `footer` 슬롯에 둔다. 페이지 레이아웃에 걸친 패널은 슬롯에 넣지 않고 페이지에 둔다.
- 선택·정렬 등 DataTable이 다루지 않는 표는 `table/`의 기본 요소를 직접 쓴다.

## 폼

- 폼 값·항목 오류는 TanStack Form `useForm`으로 다룬다. 입력 확인은 zod 스키마를 `validators.onSubmit`에 그대로 넘긴다.
- 확인은 스키마 변환(trim 등)을 적용한 값을 돌려주지 않는다. `onSubmit`에서 `schema.parse(value)`로 다듬은 값을 얻어 넘긴다. 확인을 통과한 뒤라 실패하지 않으며, 저장 함수는 다시 확인하지 않고 스키마 출력 타입만 받는다.
- 서버가 돌려준 항목 오류(중복 등)는 `form.setFieldMeta(name, (meta) => ({ ...meta, errorMap: { ...meta.errorMap, onSubmit: message } }))`로 넣는다. 스키마 오류처럼 해당 입력을 고치면 사라진다.

## 결과 알림

- 처리 결과는 `@/shared/ui/toast/toast.tsx`의 `toast.success`·`toast.warn`·`toast.error`에 `{ title, description }`을 넘겨 알린다. 정해진 모양 없이 그릴 때만 `toast(jsx)`를 쓴다. flame-ui의 `toast`를 직접 import하지 않는다.
- 토스트는 저절로 사라진다. 입력 오류는 토스트가 아니라 필드 가까이에 두고, 사라지면 다시 확인할 방법이 없는 결과나 버튼 같은 조작 요소는 토스트에 넣지 않는다.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
