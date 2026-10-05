# UI003 구현 기록

## 인계 수락

- 수락: 2026-10-05. executor가 planner `implementation_request` `20261005T114719226000Z-bc4b18b1499f`을 수신·검증했다.
- 승인 근거: 런타임 checkpoint `approval.kind = handoff`, `story_hash = 2bd79a847df94254635ddede5dc04a8504734c3ea9e65898afeafc2445a86777`. `shasum -a 256 .harness/stories/UI003/story.md`가 같은 hash. 계획 출처 `planning_from = 20261005T113815501000Z-2ead20f9eb04`(UI002 완료 인계).
- 승인 범위: story.md, [공통 범위](../shared-ui-scope.md), [현재 UI 구조](../ui-structure.md)의 UI003 범위만. 커밋·푸시·새 의존성·설정·server/ 변경 없음.
- 작업 시작 기준: HEAD `fb260a1`. 작업 트리에 UI002 완료본의 미커밋 변경(`routes/index.tsx`, `shared/ui/theme.stylex.ts`, `routes/-table-review.tsx`, `shared/ui/badge/`, `shared/ui/table/`)이 있으며 이 상태를 기준으로 한다.
- 착수 재확인(2026-10-06): `resume executor` = UI003/implementing/implement, story.md hash 동일. 위 UI002 미커밋 변경은 이후 HEAD `1f85d8b`로 커밋되어 작업 트리 clean 상태에서 시작했다(내용 변경 없음).

## 구현

### 변경 파일

| 파일 | 내용 |
| --- | --- |
| `client/src/shared/ui/dialog/dialog.tsx` (신규) | `Dialog`(flame-ui Dialog를 `keepMounted`·`closeOutside`로 감쌈, `initialFocusRef`, 열린 동안 `html` overflow 잠금/복구, `onOpen`·`onClose`), `DialogTrigger`(=flame Trigger), `DialogClose`(=flame Closer), `DialogContent`(title·description·tone·closeLabel·actions·본문) |
| `client/src/shared/ui/dialog/dialog.test.tsx` (신규) | SSR 6개: 제목→aria-labelledby, 설명→aria-describedby, 설명 없으면 describedby 없음, 닫힌 상태 open 속성 없음+내용 유지, 닫기 버튼 접근 가능한 이름·기호 숨김, danger 표시 분기, 트리거 aria-haspopup |
| `client/src/routes/-dialog-review.tsx` (신규) | 06 조립: 트리거(기존 Button danger), 대상 요약, Field+Input 사유, 돌아가기/예약 취소, 긴 안내 Checkbox, 마지막 결과·확인 동작 횟수 표시. 소비자 로컬 상태 |
| `client/src/routes/index.tsx` | `Dialog` 검토 섹션 추가 |
| `client/src/shared/ui/theme.stylex.ts` | `colors.overlay` 토큰 추가(기존 토큰 이름·값 변경 없음) |

### 설계 근거·결정

- flame-ui 1.0.1 설치본(`dist/index.js`)을 직접 읽었다. Content는 `<dialog ref ... {...props} onClose>` + 내부 `<section onClick=stopPropagation>`이다. dialog 자체의 padding을 0으로 두어 패널 안 클릭은 section에서 멈추고, backdrop 클릭만 dialog 대상이 되어 `closeOutside`로 닫힌다.
- 닫힌 dialog는 UA 기본 `display:none`으로 숨긴다. dialog에는 display를 지정하지 않고 레이아웃은 내부 패널 div가 맡는다.
- 초기 포커스: React 19 클라이언트는 `autoFocus`를 HTML 속성으로 쓰지 않고 마운트 시 `focus()`를 호출한다(`react-dom-client.development.js`의 `case "autoFocus": break`). `keepMounted`에서는 페이지 로드 때 포커스를 뺏으므로 쓰지 않았다. 대신 flame이 `showModal()` 직후 호출하는 `onOpen`에서 `initialFocusRef`로 포커스를 옮긴다(소비자는 취소 버튼 ref 전달).
- 닫힘 결과: 공통 `onClose`는 모든 닫힘 통지다. 확인 여부는 소비자가 구분한다. 확인 버튼이 결과를 먼저 기록하고 `close()`를 호출하며, `onClose`는 `current ?? 취소`로 이미 기록된 확인을 덮지 않는다. 다시 열 때(`onOpen`) 사유·결과를 소비자가 초기화한다.
- 배경 스크롤: native modal은 페이지 스크롤을 막지 않는다. 그래서 열린 동안 `document.documentElement.style.overflow = "hidden"`로 잠그고 닫힘·언마운트 때 이전 값을 복구한다. CSS 진입점은 수정하지 않았다.
- 트리거는 flame clone 경로를 사용한다(`<DialogTrigger><Button/></DialogTrigger>`, onClick=open·aria-haspopup 주입, 기존 Button onClick 경로와 충돌 없음). 확인 버튼만 render-prop `close`를 받는 작은 소비자 컴포넌트다. 프로젝트 lint `react-perf/jsx-no-new-function-as-prop`·`jsx-no-jsx-as-prop` 때문에 핸들러·actions는 `useCallback`·`useMemo`로 둔다.
- 설명은 본문 아래 보조 문구로 렌더한다(시안 06 위치). 기존 Button danger(테두리형)를 그대로 쓰고 시안의 채움 버튼 variant는 추가하지 않았다(story 지침).
- 새 의존성·설정·CSS 진입점·server/·기존 Button/Field/Input/Table/Badge API 변경 없음. shared/ui/dialog는 routes·features를 import하지 않는다.

## 검증 결과 (2026-10-06, client)

| 명령 | 결과 |
| --- | --- |
| 착수 전 `vp test --run` | 10파일 39/39 PASS(기준선) |
| 착수 전 `vp check` | FAIL(기존): `package.json`, `src/routeTree.gen.ts`, `src/router.tsx` 포맷 3파일 |
| 신규 테스트 선작성 후 `vp test --run src/shared/ui/dialog` | FAIL(모듈 없음) 확인 → 구현 후 6/6 PASS |
| `vp check <변경 5파일>` | 포맷 PASS, 0 경고 / 0 오류 |
| `vp check --no-fmt` (전체 37파일) | 0 errors / 1 warning(기존 `_dev/dev-stylex-inject.tsx` promise 경고) |
| `vp check` (전체) | FAIL(기존, 변동 없음): 위 3파일 포맷 |
| `vp test --run` | 11파일 45/45 PASS(기존 39 + 신규 6). 종료 시 Vitest "close timed out … 2 Vite servers" 메시지와 exit 1은 착수 전 기준선에서도 동일 |
| `vp run build` | PASS(client·server 산출) |
| `git diff --check` | 출력 없음 |

브라우저(headless Chrome + CDP, 신뢰 입력 이벤트, 원본 화면·주입 없음, 세션 scratchpad `qa-ui003.mjs`): **dev(3100) 38/38, production preview(4173) 38/38 PASS**.

| 완료 조건 | 확인 내용 (dev·preview 동일) |
| --- | --- |
| CSS | dialog StyleX 클래스 적용, 경계 `rgb(211,218,228) 1px`, 흰 배경, radius 8px, padding 0, `::backdrop` `rgba(30,42,59,0.45)`, 위험 표시 색 `rgb(185,56,47)`/`rgb(255,244,242)` |
| 1 열기·이름·초기 포커스·배경 차단 | 트리거 Enter로 `:modal` 열림, 최초 포커스 `돌아가기`(focus-visible solid 2px). AX: dialog 이름 "예약을 취소할까요?", 설명 "일정에서 제외되며…", modal=true, heading·textbox "취소 사유"·button "닫기"/"돌아가기"/"예약 취소". 제목·대상·사유·설명 텍스트 표시. 배경 트리거 `focus()` 무시(inert), 배경 좌표 hit-test 대상 = dialog backdrop |
| 2 Tab/Shift+Tab | 순서 닫기 → 사유 입력 → 돌아가기 → 예약 취소. 페이지 요소로 이동하지 않음. 마지막 요소에서 Tab 시 한 번 `body`(브라우저 UI로 나가는 Chrome native 동작) 후 다시 닫기 버튼. 닫기·확인 focus-visible outline, 입력 focus ring |
| 3 취소 경로 | Escape·닫기(X)·돌아가기·배경 클릭 각각 닫힘, 결과 "취소 · 확인 동작 없음", 확인 횟수 0회, 포커스 트리거 복귀, html overflow 복구. 제목·대상·입력·설명 클릭은 닫지 않음. 입력 내용은 닫기 전까지 유지 |
| 4 확인 | 사유를 "고객이 일정 변경을 요청함"으로 바꾼 뒤 확인하면 닫힘. 400ms 후에도 결과 "확인 · 사유: 고객이 일정 변경을 요청함"(onClose가 덮지 않음), 확인 1회, 포커스 트리거. 네트워크 저장 요청 코드 없음 |
| 5 반복·닫힌 상태 | 닫힌 dialog `display:none`·checkVisibility=false. 페이지 Tab 70회 중 dialog 내부 진입 없음. 재열기 시 사유 초기값·결과 초기화·초기 포커스, 확인 후 재열기 후 Escape 시 확인 횟수 1회 유지. 열기/닫기 3회 반복 정상 |
| 6 긴 내용·375px | 375×640에서 "긴 안내 포함" 선택 후 열기: dialog 16~624px로 화면 안, 본문만 스크롤(526>477), 돌아가기·예약 취소·닫기 화면 안. 본문 휠 scrollTop 0→49, backdrop·패널 휠에도 페이지 scrollY 고정(데스크톱 1501, 375px 2716 유지). 닫은 뒤 overflow·scrollY·포커스 복구. 페이지·dialog 가로 넘침 없음 |
| 7 회귀(스모크) | 01~06 섹션 6개, 표 초기 선택 이지우만 강조, 행 선택 변경, Badge 여섯 문구, Select 존재, 375px 페이지 넘침 없음·표 region만 가로 스크롤. 자동 테스트 기존 39개 유지 |
| 콘솔 | 오류·예외 없음. 브라우저 자동 `/favicon.ico` 요청 404 1건은 프로젝트에 favicon이 없어서 생긴 것으로 이번 변경과 무관(별도 기록) |
| 8 시안 06 대조 | executor 스크린샷 대조: 위험 표시·제목·닫기·대상 상자·사유 입력·설명·구분선·오른쪽 정렬 버튼 존재. 차이: 확인 버튼은 기존 danger(테두리형)로 시안의 채움형과 다름(story 지침) → **사용자 확인 필요** |

## 미해결 / 수동 확인

- 사용자 확인: 시안 06 대조, 사유 입력 후 확인, 모든 취소 경로(Escape·X·돌아가기·배경), 포커스 복귀, 좁은 화면·긴 내용 스크롤.
- Tab 순환은 Chrome native showModal 동작이다. 마지막 요소 다음에 브라우저 UI로 한 번 나갔다가 dialog로 돌아오며, 페이지 내용으로는 가지 않는다. 별도 focus trap은 story 제외 범위라 추가하지 않았다.
- 입력 안에서 마우스를 누른 채 backdrop까지 끌어 놓으면 click 대상이 dialog가 되어 닫힐 수 있다(flame closeOutside 구현 특성). 확인하지 않은 가능성으로 기록만 한다.
- 스크롤 잠금으로 스크롤바가 사라질 때 overlay 스크롤바가 아닌 환경(Windows 등)에서는 가로 레이아웃이 약간 이동할 수 있다. iOS Safari의 html overflow 잠금 효과는 확인하지 않았다.

## 미실행

- 스크린리더 실청취(AX 트리 결과로 대체 완료를 주장하지 않음), Safari·Firefox·다른 OS·실기기.
- 01~04의 UI001/UI002 전체 브라우저 검사 스크립트(이전 세션 scratchpad에 있어 현재 없음)는 재실행하지 않았다. 위 스모크와 자동 테스트 45개로 대체했고, 전체 재검이 필요하면 별도로 실행한다.
- 커밋·푸시 없음.

## 리뷰 인계

- 2026-10-06 사용자가 실행 완료 선택에서 **리뷰어에게 넘기기(review)**를 골랐다. 첫 리뷰 요청이다.
- 리뷰 대상(Git 기준 HEAD `1f85d8b`): 수정 `client/src/routes/index.tsx`, `client/src/shared/ui/theme.stylex.ts` / 신규(untracked) `client/src/routes/-dialog-review.tsx`, `client/src/shared/ui/dialog/dialog.tsx`, `client/src/shared/ui/dialog/dialog.test.tsx`. 삭제 없음.
- 검토 요청 초점: flame-ui Dialog 감싸기(keepMounted·closeOutside·initialFocusRef·스크롤 잠금/복구), aria 연결, 확인/취소 결과 분기(소비자), 공통 경계(업무 문구·규칙 미포함), StyleX 닫힘 숨김 유지, 위 "미해결" 항목의 타당성.
- 리뷰 요청 ID `20261006T020259072000Z-1386d9c40435`. 인계 후 소스 동결. 커밋·푸시 없음.

## 리뷰 1 수정 (F1)

- 승인: review-1 항목 1에 대한 수정안 F1을 사용자가 accept 다중 선택으로 골랐다([브리핑·결정](review-brief.md)). checkpoint fixing --approved로 기록했다. 항목 2·3은 수정안이 없어 기록만 유지한다.
- 재현(수정 전, dev): 입력·제목에서 눌러 배경에서 떼면 3건 모두 '취소'로 닫히고 입력이 사라졌다(`repro-drag.mjs`).
- 변경: `client/src/shared/ui/dialog/dialog.tsx`만 수정했다.
  - flame `closeOutside`를 껐다.
  - `DialogContent`의 `<dialog>`에 `onPointerDown`·`onClick`을 붙였다. pointerdown과 click이 모두 dialog 요소 자체(배경)일 때만 `currentTarget.close()`를 호출한다.
  - 닫힘은 native close 이벤트를 거쳐 기존 `onClose`·스크롤 복구 경로를 그대로 탄다.
  - 공개 API·의존성·라이브러리는 그대로다.
- 참고: 배경에서 눌러 패널에서 떼는 경우는 click이 dialog로 와서 닫힌다. 배경에서 시작한 조작이라 취소로 본다. 별도 검증 항목은 아니다.

### 수정 후 검증 (2026-10-06)

| 명령 | 결과 |
| --- | --- |
| `vp check <변경 5파일>` | 포맷 PASS, 0 경고 / 0 오류 |
| `vp check --no-fmt` (전체 37파일) | 0 errors / 1 warning(기존) |
| `vp check` (전체) | FAIL(기존 포맷 3파일, 변동 없음) |
| `vp test --run` | 11파일 45/45 PASS. Vitest close timed out 메시지·exit 1은 기준선과 동일 |
| `vp run build` | PASS |
| `git diff --check` | 출력 없음 |
| 브라우저 dev(3100) / preview(4173) | 각 **41/41 PASS**: 기존 38항목(배경 클릭 닫기·Escape·X·돌아가기·확인·반복·375px·회귀 포함) + F1 drag 3건(입력→배경 좌상단, 입력→패널 아래 배경, 제목→배경: 열린 상태·입력·결과 유지). 콘솔 오류 없음(favicon 404 1건 별도) |

- 수동 확인 추가 항목: 입력칸에서 글자를 드래그 선택하다 배경까지 끌어도 닫히지 않는지, 배경을 그냥 클릭하면 닫히는지.
- 미실행은 위 항목과 같다(스크린리더 실청취, Safari/Firefox/실기기, UI001/UI002 전체 브라우저 스크립트). 커밋·푸시 없음.

## 사용자 완료 확인 (2026-10-06)

- 사용자 완료 선택: **확인 완료 · 스토리 종료**. 현재 수정본(F1 반영, 기준 `2b22d1b2…f194`)을 직접 확인하고 만족한다는 최종 승인이다. 선택 전에 수동 확인 6단계(시안 06 대조, 확인, 모든 취소 경로, drag, 재열기, 375px·긴 내용)를 안내했다.
- 게이트:
  - handoff 승인 ✔
  - executor QA ✔(test 45/45, build, 브라우저 dev/preview 41/41)
  - 고정 기준 코드 리뷰 1 ✔. 결함 지적 없음, F1만 사용자 선택·반영
  - 사용자 수동 확인·최종 완료 확인 ✔
  - 학습: 신규 필수 아님(사용자 선택 없음). S001 기존 학습 게이트는 그대로 둔다.
  - 반복 한도: 코드리뷰/Fix 1회, QA/Fix 1회.
- 남은 기록: 확인 버튼은 기존 테두리형 danger(시안과 차이, story 지침). 미실행 항목(스크린리더 실청취, Safari/Firefox/실기기, UI001/UI002 전체 브라우저 스크립트)과 전체 `vp check`의 기존 포맷 3파일 실패·기존 경고 1개는 그대로 남긴다. UI003 완료를 UI004·S001 완료로 확장하지 않는다.
- 마지막 검증 이후 소스 변경 없음(`git status` 대상 5파일 동일). 커밋·푸시 없음.
