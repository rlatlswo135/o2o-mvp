# UI001 구현 기록

## 인계 수락

- 수락: 2026-10-05. executor가 planner `implementation_request` `20261005T084705804000Z-543aa97f9df3`을 수신·검증했다.
- 승인 근거: 런타임 checkpoint `approval.kind = handoff`, `story_hash = c8d85f129bca2544546cdbab70dbf9204d3f5bddc655ed2bb678f06f1af8022d`.
  `shasum -a 256 .harness/stories/UI001/story.md` 결과가 같은 hash와 일치함을 확인했다.
- 승인 범위: story.md 및 [공통 범위](../shared-ui-scope.md)의 UI001 범위만. 커밋·푸시·새 의존성·설정 변경·server/ 수정은 범위 밖.
- 작업 시작 기준(사용자 미커밋 변경 포함, executor가 만들지 않음):
  - HEAD `8b5deb0`.
  - `client/src/shared/ui/{Button,Field,Input}.tsx` 및 테스트가 소문자 파일명으로 rename(staged).
  - `button.tsx`: `type` 그대로 전달, loading 주석 제거(unstaged).
  - 루트 `vite.config.ts`: `react/button-has-type` 규칙 제거(unstaged).
  - executor는 위 변경을 되돌리거나 수정하지 않았다.

## 변경 파일

신규 공통 UI (`client/src/shared/ui/`, 기존 Button·Field·Input·theme 미변경):

| 파일 | 내용 |
| --- | --- |
| `select.tsx` | 네이티브 단일 `select`. Field의 id·required·aria-describedby·invalid 연결 재사용, 꺾쇠 표시(aria-hidden). |
| `textarea.tsx` | 여러 줄 입력. Field 연결 동일, 기본 rows 3, 세로 크기 조절. |
| `choice.tsx` | `Checkbox`, `Switch`(체크박스 + `role="switch"`), `RadioGroup`(fieldset/legend, name·value·defaultValue·disabled·onChange 전달) + `Radio`. 세 컨트롤이 label 구조·스타일을 공유해 한 파일로 묶었다. |
| `segmented-control.tsx` | 분할 단일 선택. 의미는 라디오 그룹(fieldset/legend, 숨김 legend 옵션). 숨긴 라디오의 checked·focus-visible을 `stylex.when.siblingBefore`로 표시 span에 반영해 제어/비제어 모두 CSS로 일치. |
| `amount-field.tsx` | `parseAmount`(empty / valid / invalid(format·range)), `formatAmount`(`Intl.NumberFormat('ko-KR')`), `AmountInput`(원문 보존·자동 쉼표 없음·오른쪽 정렬·단위를 aria-describedby로 연결), `AmountDisplay`(`output` + `data`, Field label 연결, null/undefined는 "—"+보조기기용 "값 없음"으로 0과 구분, 계산 없음). |
| `control-styles.ts` | Select·Textarea·AmountInput 공통 입력 상자 모양(Input과 같은 값), visuallyHidden, fieldset/legend 스타일. |
| `amount-field.test.tsx`, `field-controls.test.tsx`, `choice.test.tsx` | 신규 테스트 21개. |

검토 화면 (`client/src/routes/`):

- `index.tsx`: 03·04 섹션 추가, 작은 화면(≤640px) page·card padding 축소, 기존 grid 열을 `minmax(min(260px, 100%), 1fr)`로 변경해 좁은 화면 넘침 방지. 이 파일에 있던 기존 포맷 오류도 포매터 적용으로 함께 정리됨(import 순서 등).
- `-selection-review.tsx`, `-amount-review.tsx`, `-review-layout.tsx`: 검토 섹션 내용. `-` 접두사로 라우터 생성 대상에서 제외(TanStack router-generator 기본 `routeFileIgnorePrefix: "-"`, `routeTree.gen.ts` 변경 없음 확인). index.tsx의 `import/max-dependencies`(10) 경고를 피하려고 분리. 가상 데이터·로컬 상태만, 저장·계산 없음.

설계 메모:

- 세부 props는 네이티브 이벤트 우선(`onChange` + `event.target.value/checked`). 기존 Field `useFieldControl`·`joinIds`를 그대로 사용, Field/Input/Button 계약 변경 없음. 새 토큰 추가 없음.
- 금액 해석은 소비자가 `parseAmount`로 하고 오류 문구는 Field `error`로 전달한다. 음수 허용 등 업무 규칙은 공통 컴포넌트에 넣지 않았다. 부호 `-`·`−`·`+`, 세 자리 묶음 쉼표만 허용, `-0`은 0으로 정규화, 소수·지수·16진수·단위 문자는 format 오류, `Number.MAX_SAFE_INTEGER` 초과는 range 오류.
- `AmountInput`은 `inputMode`를 지정하지 않는다(모바일 숫자 키패드에 `-`가 없는 경우가 있어 음수 입력을 막지 않기 위함). 소비자가 필요 시 전달.
- flame-ui는 사용하지 않았다(모든 컨트롤이 네이티브로 충분).
- 알려진 중복: `control-styles.ts`의 입력 상자 스타일은 기존 `input.tsx` 스타일과 같은 값이다. 기존 Input 변경 금지 범위라 Input은 그대로 두었다.

## 검증 (모두 `client/`에서 실행)

| 명령 | 결과 |
| --- | --- |
| `vp check <변경 13개 파일>` | PASS: 포맷 13/13, lint·type 0 경고/0 오류 |
| `vp check --no-fmt` (전체) | 0 errors, 1 warning — 기존 `src/_dev/dev-stylex-inject.tsx:8` no-floating-promises (작업 전부터 존재) |
| `vp check` (전체) | FAIL(기존): `package.json`, `src/routeTree.gen.ts`, `src/router.tsx` 포맷. 작업 전에는 `routes/index.tsx` 포함 4개였다. executor가 만든 실패 아님 |
| `vp test --run` | PASS 30/30 (기존 9 + 신규 21). 종료 시 "Vite server 2개 종료 지연" 경고는 작업 전에도 동일 |
| `vp run build` | PASS. `routeTree.gen.ts` 변경 없음 |

브라우저 검증: headless Chrome + CDP 스크립트(세션 scratchpad, 의존성 추가 없음). dev `vp dev --port 3100`, preview `vp preview --port 4173`.

| 완료 조건 | dev 결과 |
| --- | --- |
| 1 선택 값·표시 일치, radio 하나만 | PASS: Checkbox 클릭/Space, Radio 클릭/화살표(disabled 건너뜀), Switch 클릭/Space(썸 위치 변경), Segmented 클릭/화살표, 현재 값 영역과 일치. Select는 label 클릭 포커스·값 변경 표시 일치 확인. **Select 키보드 변경은 자동화 불가** — macOS Chrome은 닫힌 select에서 ArrowDown이 OS 메뉴를 열어 headless에서 ArrowDown / ArrowDown+Enter / Space+ArrowDown+Enter 모두 값 불변. 네이티브 동작이므로 수동 확인 필요 |
| 2 disabled 불변·접근 가능한 이름·보이는 포커스 | PASS: disabled Select·Checkbox·Radio·Switch·Segmented 그룹·Textarea·AmountInput 클릭/키 입력 시 값 불변. AX 트리 이름: combobox "담당자", checkbox "선택됨", radio "일회성"(그룹 "차단 방식"), switch "알림 사용" checked, segmented 그룹 "테마 선택 예시"(숨김 legend). Tab 이동 38개 요소 모두 outline 또는 focus ring 표시 |
| 3 Field label·안내·오류·required 연결 | PASS: Select·Textarea·금액 입력 label 클릭 포커스, aria-describedby 안내/오류 id, required, aria-invalid, AX invalid=true |
| 4 여러 줄 사유 | PASS: "첫 줄⏎둘째 줄" 입력 후 값·표시 줄바꿈 유지(2줄). 공통 컴포넌트는 검증·저장 없음(필수 오류 문구는 검토 화면 소비자 코드) |
| 5 금액 | PASS: `-10000`/`0`/`30000` 유효, 빈 값은 "빈 값", `abc`·`10.5` 형식 오류, `9007199254740992` 범위 오류, `-9007199254740991` 유효, 원문 유지·오른쪽 정렬. 읽기 전용 `-10,000원`/`0원`/`30,000원`, 빈 값 "—"(값 없음) |
| 6 기존 회귀·작은 화면 | 기존 9개 테스트 PASS, 기존 Button 5개·전화번호 오류 테두리 유지. 375px: 아래 dev CSS 문제로 원본 dev에서는 13px 넘침, 배포 기준 전역 reset 주입 시 넘침 0·단위가 입력 안에 표시 |
| 7 시안 대조 | 사용자 확인 필요. executor 스크린샷 대조: 다섯 선택 종류·Textarea·금액 입력/표시 모두 존재 |

dev 결과: 47개 중 45 PASS. 실패 2건은 Select 키보드(자동화 한계)와 375px(dev 전역 CSS 미로딩).

## 미해결 / 사용자 결정 필요

1. **production preview에 CSS가 전혀 적용되지 않음 (기존 구성 문제, 범위 밖).**
   preview HTML은 `__root.tsx`의 `<DevStyleXInject cssHref="../styles.css" />`가 만든 `<link href="../styles.css">`만 가지며 `/styles.css`는 404(규칙 0개). 빌드 산출물 `dist/client/assets/stylex.css`(필요 규칙 포함)는 링크되지 않는다. 기존 Button·Input 포함 모든 StyleX 스타일이 preview에서 빠진다.
   관련 파일(`routes/__root.tsx`, `_dev/dev-stylex-inject.tsx`)은 이번 작업에서 수정하지 않았다(HEAD와 동일). 수정은 구성 변경이라 승인 범위 밖. preview에서는 동작·ARIA만 확인되고 스타일 기반 항목(오른쪽 정렬·포커스 outline·switch/segmented 선택 표시)은 실패로 측정됐다.
2. **dev에서 전역 `styles.css`(`* { box-sizing: border-box }`)가 로드되지 않음 (기존 구성 문제).** dev는 `/virtual:stylex.css`만 주입한다. StyleX 스타일은 dev에서 정상. content-box 때문에 기존 전화번호 Input도 부모보다 30px 넓고, 금액 입력은 375px에서 화면 밖으로 13px 나간다. reset 주입 시 해결됨을 확인했다. 컴포넌트에 box-sizing을 개별 추가하지 않았다(기존 Input과 같은 전제 유지).
3. Select 키보드 변경 수동 확인 필요(위 1번 조건).

## 수동 확인 방법

1. `cd client && vp run dev` → http://localhost:3000/ (위 2번 dev CSS 문제 감안).
2. 03 섹션: 담당자·시술 Select를 키보드(포커스 후 Space/화살표, macOS는 메뉴에서 선택)로 바꾸고 아래 "현재 선택 값"과 비교. Checkbox·Radio·Switch·Segmented를 마우스/Space/화살표로 조작, disabled 항목 불변 확인. '선택 안 함'으로 시술 오류 표시 확인.
3. 04 섹션: 사유에 여러 줄 입력 → 줄 수·원문 확인, 비우면 오류. 변경 금액에 `-10000`, `0`, `30000`, 빈 값, `abc`, `10.5`, `9007199254740992` 입력 → "금액 해석"과 오류 문구 확인. 읽기 전용 표시 확인.
4. 브라우저 폭 375px에서 넘침·단위 표시 확인.
5. `ui-01-inputs.png` 03·04와 대조.

## 리뷰 인계

- 2026-10-05 사용자가 실행 완료 선택에서 review를 선택. `node .harness/bin/c2h.mjs review UI001` → 요청 ID `20261005T091751737000Z-6461238a5b39`.
- 인계 후 소스 동결. 리뷰 결과 수신 전 소스 수정·커밋 없음.

## 리뷰 1 반영 (fixing → implementation_done)

- 리뷰 결과 `20261005T101941002000Z-265931c4de0a`([review-1.md](review-1.md), [브리핑](review-brief.md)). R1 높음·R2 중간, 모두 기존 CSS 구성 문제.
- 사용자 `/accept` 선택: **R1+R2 CSS 진입점 연결**만 승인(구성 파일 수정 승인 포함). **R2-대안(box-sizing 개별 지정)은 보류·미적용.**
- 코드리뷰 Fix 횟수: 1 / 3.

### 변경

| 파일 | 내용 |
| --- | --- |
| `client/src/routes/__root.tsx` | `/// <reference types="vite-plus/client" />`(`?url` import 타입; tsconfig는 미변경), `import appCss from "../styles.css?url"`, `head().links`에 stylesheet 추가, `<DevStyleXInject />`의 고정 `cssHref="../styles.css"` 제거. |
| `client/src/_dev/dev-stylex-inject.tsx` | `cssHref` prop 제거. production 분기는 `null`(StyleX 규칙이 전역 CSS 자산에 합쳐지므로). dev 분기(`/virtual:stylex.css` + runtime)는 그대로. 기존 `no-floating-promises` 경고 줄은 미변경. |

원리: `@stylexjs/unplugin`은 빌드 시 수집한 CSS를 번들의 첫 CSS 자산에 덧붙인다(`pickCssAssetFromRollupBundle`). `styles.css`를 Vite 자산으로 import하면 그 자산(`styles-<hash>.css`)에 reset과 StyleX 규칙이 합쳐져 HTML head에 링크된다. 새 의존성·설정 파일(tsconfig, vite.config) 변경 없음.

### 검증

| 명령 / 확인 | 결과 |
| --- | --- |
| `vp check <변경 15개 파일>` | 포맷 PASS, 0 errors / 1 warning(기존 `dev-stylex-inject.tsx:8` no-floating-promises) |
| `vp check --no-fmt` (전체) | 0 errors / 1 warning(같은 기존 경고) |
| `vp check` (전체) | FAIL(기존): `package.json`, `src/routeTree.gen.ts`, `src/router.tsx` 포맷. 변동 없음 |
| `vp test --run` | 30/30 PASS |
| `vp run build` | PASS. CSS 산출물은 `dist/client/assets/styles-DVhxOPxL.css` 하나(reset 포함, StyleX `@layer priority` 6개). 고아 `stylex.css` 사라짐. `routeTree.gen.ts` 변경 없음 |
| preview HTML | `<link rel="stylesheet" href="/assets/styles-DVhxOPxL.css">`, 응답 200 |
| preview 브라우저(원본, 주입 없음) | 47 중 **46 PASS**. CSS·Switch/Segmented 선택 표시·금액 오른쪽 정렬·Tab 포커스 표시·375px 넘침 0 모두 통과. 실패 1: Select 키보드(macOS 자동화 한계) |
| dev 브라우저(원본, 주입 없음) | 47 중 **46 PASS**(같은 Select 1건). 전역 `/src/styles.css` 로드, 375px에서 기존 전화번호 Input 309px = 부모 309px, 금액 입력 309px = 부모 309px, scrollWidth 375 |

R1·R2 해결 확인. 이전의 "reset 임시 주입" 결과가 아닌 원본 dev/preview 화면 결과다.

### 남은 항목

- Select 키보드 변경 수동 확인.
- 사용자 시안 03·04 대조·최종 화면 확인.
- 재리뷰는 선택 사항(사용자 완료 선택에서 추가 리뷰 요청 시에만).

## 사용자 요청 수정 1: shared/ui 컴포넌트별 폴더 재배치

- 2026-10-05 사용자 완료 선택에서 "문제 있음 · 논의/수정" 선택 후 논의. 사용자 요청(근거 발화): "button/ 디렉토리 만들어서 button.tsx, button.test.tsx 넣고… 응집도가 어느 정도 있었으면", 제안 구조에 "좋다 그렇게 수정해주고", 분리 파일명은 `amount-field.util.ts`, import 방식은 **B안(폴더별 index.ts 없이 직접 경로)**.
- 승인 범위(동작·공개 API 변경 없음, 파일 위치·import 경로만):
  - `shared/ui/`에 컴포넌트별 폴더: `field/`(field.tsx, field.test.tsx), `button/`(button.tsx, button.test.tsx), `input/`(input.tsx), `select/`(select.tsx, select.test.tsx), `textarea/`(textarea.tsx, textarea.test.tsx), `choice/`(choice.tsx, choice.test.tsx), `segmented-control/`(segmented-control.tsx), `amount-field/`(amount-field.tsx, amount-field.util.ts, 각 테스트).
  - `theme.stylex.ts`는 `shared/ui/` 최상위 유지, `control-styles.ts`는 `shared/ui/internal/`로(shared/ui 밖 import 금지 규칙).
  - `field-controls.test.tsx`를 select/textarea 테스트로 분리. `parseAmount`·`formatAmount`·`AmountParseResult`를 `amount-field.util.ts`로 분리하고 테스트도 따라 분리.
  - 폴더별·최상위 barrel(index.ts) 만들지 않음. 소비자 import 경로 갱신(`routes/`).
- 기존 Button·Field·Input은 위치만 이동(내용 무변경). 사용자의 기존 rename staged 상태는 git index를 건드리지 않고 working tree에서만 이동.

### 결과 구조

```
client/src/shared/ui/
  theme.stylex.ts
  internal/control-styles.ts
  field/       field.tsx, field.test.tsx
  button/      button.tsx, button.test.tsx
  input/       input.tsx
  select/      select.tsx, select.test.tsx
  textarea/    textarea.tsx, textarea.test.tsx
  choice/      choice.tsx, choice.test.tsx
  segmented-control/  segmented-control.tsx, segmented-control.test.tsx
  amount-field/       amount-field.tsx, amount-field.test.tsx, amount-field.util.ts, amount-field.util.test.ts
```

- 기존 button/field/input은 이동 + 상대 import 경로(`../theme.stylex.js`, `../field/field.js`, `../input/input.js`)만 변경. 내용·API 변경 없음.
- `choice.test.tsx`에 있던 SegmentedControl 테스트를 `segmented-control.test.tsx`로 이동(작은 SSR 헬퍼 `inputsWith`는 두 테스트 파일에 각각 둠).
- `amount-field.util.ts`: `AmountParseResult`, `parseAmount`, `formatAmount`. `amount-field.tsx`는 `formatAmount`만 import. 검토 화면은 `parseAmount`를 util에서 직접 import.
- 소비자 import: `@/shared/ui/<name>/<name>.tsx`, util은 `@/shared/ui/amount-field/amount-field.util.ts`. barrel 없음.
- 사용자 담당 문서 `S001/fe-structure.md`는 수정하지 않음. 이 폴더 규칙(컴포넌트별 폴더·테스트 동반·`internal/`·barrel 없음)을 FE 구조 규칙으로 문서화하려면 planner 반영이 필요하다.

### 검증

| 명령 / 확인 | 결과 |
| --- | --- |
| `vp check <변경·신규 24개 파일>` | 포맷 PASS, 0 errors / 1 warning(기존 `dev-stylex-inject.tsx:8`) |
| `vp check --no-fmt` (전체 29파일) | 0 errors / 1 warning(같은 기존 경고) |
| `vp check` (전체) | FAIL(기존, 변동 없음): `package.json`, `routeTree.gen.ts`, `router.tsx` 포맷 |
| `vp test --run` | 8 파일 30/30 PASS(테스트 수 동일, 파일만 분리) |
| `vp run build` | PASS. `dist/client/assets/styles-DVhxOPxL.css` — 이동 전과 같은 hash(스타일 산출물 동일) |
| preview / dev 브라우저(원본) | 각 47 중 46 PASS — 이동 전과 동일. 실패 1: Select 키보드(자동화 한계) |

## 사용자 완료 확인

- 2026-10-05 사용자 완료 선택에서 **확인 완료 · 스토리 종료** 선택. 선택지 안내("Select 키보드와 시안 03·04 대조를 확인하셨다면")에 따른 현재 수정본(사용자 요청 수정 1 반영본)의 수동 확인·만족 최종 승인으로 기록한다.
- 완료 게이트 판단:
  - 정확한 revision 구현 승인: handoff `20261005T084705804000Z-543aa97f9df3`, story hash 일치. ✔
  - executor QA: check·test·build·dev/preview 브라우저 기록(위 표). ✔ (Select 키보드는 사용자 수동 확인으로 대체)
  - 고정 기준 리뷰·사용자 리뷰 결정: review-1 수신·브리핑, `/accept`로 R1+R2 선택·반영. ✔ 재리뷰는 FLOW상 필수 아님 — 리뷰 이후 변경(R1+R2 구성 수정, 폴더 재배치)은 재리뷰를 받지 않았다.
  - 사용자 수동 확인·최종 완료 확인: 위 선택. ✔
  - 학습 게이트: UI001 신규 필수 아님(story.md). S001 기존 게이트와 무관.
- 남은·보류 항목(완료를 막지 않음): R2-대안 보류(미적용), 폴더 규칙의 `fe-structure.md` 반영은 planner 몫, 스크린리더 청취·Safari/Firefox·다른 OS 미검증, 전체 `vp check`의 기존 포맷 실패 3파일(사용자 영역), 커밋·푸시 없음(사용자의 staged rename은 이전 경로를 가리킴).

## 미실행

- 실제 기기 스크린리더 청취(AX 트리로 이름·역할·상태만 확인).
- Windows/Linux 브라우저, Safari·Firefox.
- (리뷰 1 반영 후 preview 스타일 검증 완료 — 위 "리뷰 1 반영" 참고.)
- 커밋·푸시 없음.
