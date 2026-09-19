# S001 구현 기록 — 1단계 shared/ui 공통 컴포넌트

**1단계 공통 UI 묶음 완료 ≠ S001 고객 기능 통합 완료.** 고객 업무 화면·API·BE 연결은 시작하지 않았다.

## 기준

- 기준 커밋: `9f55541` (`- client: vite-plus setting`).
- 작업 트리 기준: planner의 미커밋 `.harness/` 문서(CURRENT.md, design/README.md, stories/index.md, stories/v1-scope.md, S001/story.md, S001/fe-structure.md)를 보존하고 그 위에서 작업했다.
- 대상 커밋: 없음(커밋 미승인). 리뷰 기준은 `/harness-review` 시 `c2h review`의 지문으로 고정한다.
- 승인 근거: 2026-10-01T15:05:11+09:00 `/executor` 단일 선택 "공통 UI 1단계 (shared/ui)".

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `client/src/shared/ui/theme.stylex.ts` (신규) | 잉크 블루 시안 기준 의미 토큰 `colors`(배경·텍스트·경계·주요·포커스·위험·비활성)와 `controls`(높이·반경·여백·글자 크기). 테마 선택·Provider 없음 |
| `client/src/shared/ui/Button.tsx` (신규) | `variant`: primary / secondary / danger. `disabled`는 네이티브 disabled. `loading`은 포커스를 유지하고 `aria-busy`·`aria-disabled`를 표시하며 클릭·폼 제출을 막는다(`preventDefault`). 스피너는 `aria-hidden`. 기본 `type="button"` |
| `client/src/shared/ui/Field.tsx` (신규) | `label`·`description`·`error`·`required`·`id`. label `htmlFor`와 입력 id 연결, 설명·오류를 `aria-describedby`로 연결, 오류 시 invalid 전달, 필수 `*`는 `aria-hidden`이고 입력에 `required` 전달. 연결 정보는 context(`useFieldControl`)로 제공. 빈 문자열 오류는 오류로 보지 않음 |
| `client/src/shared/ui/Input.tsx` (신규) | 네이티브 input. Field 안이면 id·required·invalid·describedby를 Field에서 받고, 직접 준 `aria-describedby`와 합친다. Field 밖에서는 `invalid` prop. 기본·hover·focus(경계+3px 링)·오류·disabled 스타일 |
| `client/src/shared/ui/Button.test.tsx`, `Field.test.tsx` (신규) | `react-dom/server` 마크업 기반 동작 테스트 9개(DOM 환경 없음). 아래 "테스트 범위" 참고 |
| `client/src/routes/index.tsx` (수정) | 스타터 화면을 1단계 공통 UI 검토용 조립으로 교체(인계에서 허용한 범위). 업무 화면 단계에서 교체 예정 |

- 도메인 독립성: shared/ui는 features/routes를 import하지 않는다. 고객 문구·전화번호 검증·중복 처리·API 요청이 없다. 검토 화면의 "고객 이름" 등은 소비자(route) 쪽 예시 문구다.
- flame-ui 1.0.1 실제 export(Accordion, Dialog, Drawer, Funnel, Popover, Select, Tabs, Toast, Tooltip)에는 Button·Input·Field가 없어서 재사용하지 않고 네이티브 요소를 사용했다.
- 상대 import는 `.js` 확장자를 쓴다. tsconfig `module: nodenext`에서 확장자 없는 import는 TS2307이 된다. server 코드도 같은 방식을 쓴다.

## 실행 중 사용자 결정

- 의존성: 사용자가 "frozen 설치"를 선택했다. 루트에서 `pnpm install --frozen-lockfile`(pnpm 11.28.2) 실행 결과 "Lockfile is up to date", 513개 패키지를 복원했다. 추적 파일 변경은 없고 새 패키지도 추가하지 않았다.
- 테스트: 사용자 답변 "DOM테스트는 없는거로 할거야". jsdom·Testing Library는 도입하지 않았다. 대신 Vitest node 환경의 SSR 마크업 테스트를 남기고, 키보드·포커스·클릭 차단은 브라우저에서 직접 확인했다. SSR 마크업 테스트도 불필요하다면 리뷰에서 제거할 수 있다.

## 설계 결정과 근거 (사용자 확인, 2026-10-01)

- **`className`·`style` prop 제외**: 컴포넌트가 `{...props}` 뒤에 `stylex.props()`를 펼치므로 외부 `className`/`style`은 덮여 조용히 무시된다. 타입에서 막아 오용을 드러낸다. 외부 StyleX 조합이 필요해지면 `xstyle?: stylex.StyleXStyles`를 마지막 인자로 합치는 방식으로 추가한다(현재 소비자 없음, 미구현).
- **`theme.stylex.ts` 파일명 유지**: StyleX 0.19.1 컴파일러는 `defineVars()`를 `.stylex.ts/.js` 접미사 파일에서만 처리하고 변수 해시를 계산한다(`themeFileExtension` 기본 `'.stylex'`). `theme.ts`로 바꾸려면 `unstable_moduleResolution.themeFileExtension` 구성 변경이 필요하므로 유지한다.
- **테스트 범위**: 사용자 피드백에 따라 prop을 그대로 출력하는지만 보는 테스트(disabled 전달, 명시 id·describedby 전달, submit type 유지, variant별 class 차이, Field 밖 invalid 출력)는 삭제했다. 남긴 9개는 컴포넌트가 판단·연결하는 동작이다:
  - Button: type 생략 시 `button`(폼 오제출 방지), loading이면 `aria-busy`·`aria-disabled`이고 네이티브 disabled 없음, loading이 아니면 처리 중 속성·표시 없음.
  - Field+Input: 자동 생성 id로 label 연결, 오류 시 `aria-invalid`와 안내+오류 describedby 결합, 오류가 없으면 안내만 연결, 빈 오류 문구 무시, Field와 직접 준 describedby 병합, required 전달 및 `*`의 aria-hidden.
- 테스트 도우미 `markup.test-utils.ts`는 삭제했다. 문자열 비교로 충분하다. 이후 테스트 도우미가 필요하면 별도 `test/` 디렉터리에 둔다(사용자 지침).
- **자동 테스트 공백**: loading 중 클릭·폼 제출 차단(`preventDefault`)은 이벤트가 필요해 SSR 마크업 테스트로 검증할 수 없다. 브라우저에서 수동 확인만 했으며, DOM 테스트를 도입하지 않는 동안 회귀 보호가 없다.

## 검증 명령과 실제 결과

| 명령 | 결과 |
| --- | --- |
| `pnpm exec vp check client/src/shared client/src/routes/index.tsx` (루트, 테스트 축소 후 재실행) | PASS: 7개 파일 format, lint, typecheck 오류·경고 0 |
| `pnpm exec vp test --run` (client, 테스트 축소 후) | PASS: 2 files, 9 tests. 종료 시 "2 Vite servers" 미종료 경고가 나오며 기존 환경에서도 같은 경고가 있었다 |
| 테스트 실패 감지 확인 (축소 후 재실행) | Field `invalid=false`, Button `aria-busy` 제거, Input describedby 병합 제거로 일부러 망가뜨리면 해당 3개 테스트가 FAIL하고, 복원 후 9개 PASS |
| `pnpm exec vp run build` (client) | PASS: client·server 빌드 성공 |
| 빌드 CSS 변수 대조 | `dist/client/assets/styles-*.css`에서 사용한 `var(--x…)` 24개가 모두 정의됨. `.js` import로도 StyleX 테마 해시가 일치한다 |
| 브라우저(dev, Chrome DevTools) | a11y 트리: 버튼 이름, loading=busy, disabled, textbox 이름·description·required·invalid 노출 확인. Tab 순서는 등록 → 취소 → 예약 취소 → 저장 중(loading, 포커스 가능) → 이름 입력 → 전화번호(오류)이고 disabled 버튼·입력은 건너뛴다. 버튼 `:focus-visible` 2px 링. 입력 focus는 경계 primary + 3px 링, 오류 입력 focus는 위험색 링. loading 버튼 click 이벤트는 `defaultPrevented=true`, 일반 버튼은 false. 시안과 색·상태 표현 대조 |

### 기존 상태(변경 전부터 실패, 이번 범위 밖 — 수정하지 않음)

- `vp check client/src`: `routeTree.gen.ts`, `router.tsx`, `routes/__root.tsx`에 format 이슈가 있다. lint는 `__root.tsx` devtools props의 react-perf 위반 2건, typecheck는 `./routeTree.gen` 확장자 누락(TS2307)과 `../styles.css?url` 타입 누락(TS2307)이다.
- 루트 `vp check`: 39개 파일 format 이슈(.harness·server 포함).
- 변경 전 `vp test`: 테스트 파일 없음(exit 1).
- coverage 설정 없음. coverage gate는 NOT_RUN이고 PASS로 처리하지 않는다.

## 미해결·사용자 결정 필요

1. **dev 모드에서 StyleX CSS가 로드되지 않는다(기존 구성 문제).** `@stylexjs/unplugin`은 dev에서 HTML shell에 `<link rel="stylesheet" href="/virtual:stylex.css">`(+ HMR 런타임)를 넣어야 한다. 현재 `__root.tsx`에는 없어서 `vp dev` 화면에 스타일이 빠진다. production build는 `styles.css`에 StyleX CSS가 합쳐져 정상이다. 브라우저 검증은 페이지에 링크를 임시로 주입해 수행했고 파일은 바꾸지 않았다. `__root.tsx`/구성 수정은 승인 범위 밖이므로 사용자 결정이 필요하다.
2. `routeTree.gen.ts`: dev/build 때 TanStack Start 플러그인이 다시 생성하면서 따옴표 형식이 바뀌고 `@tanstack/react-start` Register 블록이 추가된다. 라우트 구성 변화가 없어 HEAD로 되돌렸다. 다음 dev/build 실행 시 다시 바뀐다.
3. Field 오류 문구에 live region(`role="alert"`)을 넣지 않았다. 등록 POST 실패 시 포커스 이동·알림 방식은 업무 화면 단계에서 정한다.
4. Field 안 Input의 id는 Field가 정한다(Input의 `id` prop은 Field 안에서 무시). label 연결이 깨지지 않게 하려는 의도다.
5. 시안의 회색 채움 보조 버튼("상세 보기")은 S001에 필요하지 않아 variant에 넣지 않았다.

## 미실행

- 사용자 화면·코드 리뷰, reviewer 코드리뷰·QA.
- coverage, DOM 상호작용 테스트(사용자 결정으로 제외). loading 클릭·제출 차단은 자동 테스트가 없다.
- S001 완료 조건(등록·영속 조회·검증 실패·중복·동시성·API 연결)은 이번 단계 대상이 아니다. 전부 미검증이다.

## 리뷰 기준 (2026-10-01T16:46:30+09:00, `/harness-review`)

- 기준 커밋: `9f55541`. 커밋 없음. staged 변경 없음.
- 리뷰 대상 소스(작업 트리):
  - 수정: `client/src/routes/index.tsx`
  - 신규(미추적): `client/src/shared/ui/theme.stylex.ts`, `Button.tsx`, `Input.tsx`, `Field.tsx`, `Button.test.tsx`, `Field.test.tsx`
- 제외: `.harness/` 협업 문서(planner 미커밋 문서 포함), Git ignored 파일(node_modules, dist). 비밀 파일 없음.
- 소스 지문: `c2h review`가 HEAD·index·추적 파일·무시되지 않은 미추적 파일 기준으로 저장한다. 리뷰 종료까지 executor는 소스를 수정하지 않는다.
- `routeTree.gen.ts`는 HEAD 상태다. dev/build/test를 실행하면 TanStack 플러그인이 다시 생성해 지문이 바뀔 수 있으므로, 리뷰 중 실행했다면 생성 파일 변화로 구분한다.
- 리뷰 요청 전 `c2h init`(옵션 없음, 사용자 승인)으로 빈 `.harness/inbox/{planner,executor,reviewer}/`만 생성했다. 다른 파일 변화는 없다.
- 리뷰 요청 시 미해결: dev 모드 StyleX CSS 주입(`__root.tsx`)은 사용자 결정 대기다. 범위 밖 구성 문제이며 이번 변경 대상이 아니다.
- 검토 요청 사항: 1단계 완료 기준(shared/ui 도메인 독립성, label·오류 설명·포커스·disabled/loading 동작), 위 "설계 결정과 근거", 테스트 범위·공백의 타당성.
- 리뷰 요청: `c2h review S001` 성공. REQUEST_ID `20261001T074651133068Z-a9bbc3656ffd` (`.harness/inbox/reviewer/`에 저장됨).
- 대기: `c2h wait 20261001T074651133068Z-a9bbc3656ffd --timeout 1800`을 Claude 백그라운드 작업 `bvzhq50jr`로 실행. 출력 파일은 Claude 세션 tasks 디렉터리의 `bvzhq50jr.output`.
