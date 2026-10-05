# UI004 구현 기록

## 인계 수락

- 수락: 2026-10-06. executor가 planner `implementation_request` `20261006T024531435000Z-98f43431fdce`(approved true)를 수신·검증했다.
- 승인 근거: 런타임 checkpoint `approval.kind = handoff`, `story_hash = 81cf432da3fa9bdb17415caa5346d0acde841f6b9d83263434d0c183b2655c09`. `shasum -a 256 .harness/stories/UI004/story.md`가 같은 hash. 계획 출처 `planning_from = 20261006T022710116000Z-796f13c22fdd`(UI003 완료 인계). status errors 없음.
- 승인 범위: story.md, [공통 범위](../shared-ui-scope.md), [현재 UI 구조](../ui-structure.md)의 UI004 범위만. 커밋·푸시·새 의존성·설정·server/ 변경 없음.
- 작업 시작 기준: HEAD `1f85d8b` + 미커밋 UI003 완료본(`shared/ui/dialog/`, `routes/-dialog-review.tsx`, `routes/index.tsx`, `theme.stylex.ts`). 이 상태를 기준으로 한다.

## 구현

### 변경 파일 (client/src)

| 파일 | 내용 |
| --- | --- |
| `shared/ui/empty-state/empty-state.tsx` (+test 2) | 제목·설명(항상 표시)·선택적 액션 children. 점선 경계·가운데 정렬. live 의미 없음 |
| `shared/ui/skeleton/skeleton.tsx` (+test 3) | `aria-busy="true"` 컨테이너 + 보이는 로딩 문구 `<p>` + `aria-hidden` 정적 placeholder(`rows` 기본 3, `data-skeleton-row`). 애니메이션·타이머 없음 |
| `shared/ui/error-state/error-state.tsx` (+test 2) | 실패 문구 + 숨긴 `!` 기호 + 선택적 액션. dangerSurface/dangerBorder. live 의미 없음 |
| `shared/ui/notice/notice.tsx` (+test 5) | `Notice`: 기호(`badgeMark` 재사용, 숨김)·의미색 원·제목·설명·선택적 닫기(`${title} 닫기` 기본 이름). 정적 표현, live 의미 없음. `LiveNotice`: 빈 `role=status`·`role=alert` 두 영역을 항상 두고 성공/경고는 status, 실패는 alert에만 Notice를 넣는다 |
| `shared/ui/toast/toast.tsx` (+test 2) | 화면 오른쪽 아래 고정 컨테이너(역할 없음) + `LiveNotice elevated`. 표시 상태·문구·닫기는 소비자 소유. 저장소·imperative API·타이머·본문 클릭 닫기 없음 |
| `routes/-feedback-review.util.ts` (+test 4) | `createVirtualRetry(delayMs)`: 대기 중 재시작 무시(false), `cancel`로 늦은 완료 차단 |
| `routes/-feedback-review.tsx` | 07 `FeedbackStatesReview`: SegmentedControl로 loading/empty/error/data 선택, 조회 영역(region, tabIndex -1), 재시도 800ms 가상 대기, 액션 없는 빈 예시, 확인값 dl. 08 `FeedbackNoticeReview`: 정적 3종(닫기·다시 표시), 긴 문구 토글, 인라인 LiveNotice, Toast, 확인값 dl, 시안 하단 안내 문구 |
| `routes/index.tsx` | 07·08 섹션 2개 추가, 페이지 `paddingBottom: 160px`(하단 토스트가 마지막 내용을 가리지 않게) |

theme 토큰 추가·변경 없음(기존 success/warning/danger·surface·border 재사용). 새 의존성·설정·server/ 변경 없음. flame-ui Toast 미사용(story 결정).

### 설계 근거·결정

- **단일 전달 구조**: live 의미는 `LiveNotice` 한 곳에만 있다. 정적 `Notice`·Toast 컨테이너에는 role/aria-live가 없어 중첩·중복 영역이 없다. 두 영역은 내용이 없어도 렌더해 삽입 전부터 존재한다(브라우저에서 표시 전후 같은 DOM 노드 확인).
- **포커스**: 표시할 때는 옮기지 않는다. 닫기 후 포커스는 소비자 책임으로, 인라인·토스트는 마지막 표시 버튼으로, 정적 예시는 다음(없으면 이전) 닫기 버튼, 모두 닫으면 "예시 다시 표시"로 보낸다. 재시도는 버튼이 사라지므로 조회 영역(region, tabIndex -1)으로 옮긴다.
- **열린 토스트 동안 표시 막기**: 기존 `Button`은 `aria-disabled`를 내부 loading 값으로 덮어써 소비자가 전달할 수 없다. native `disabled`를 쓰면 방금 누른 버튼이 포커스를 잃는다. 그래서 동작은 핸들러에서 막고(교체 없음·막힌 횟수 기록), 막힌 이유 문구를 보이게 하고 `aria-describedby`로 연결했다. 버튼이 시각적으로 비활성으로 보이지 않는 한계는 **리뷰 확인 항목**이다(Button API 변경은 범위 밖).
- **ErrorState/EmptyState는 live 의미 없음**: 조회 영역 상태 표현이며, 별도 결과 알림이 필요하면 소비자가 LiveNotice/Toast를 쓴다.
- **닫기 버튼 스타일**: Dialog 닫기와 비슷하지만 UI003 완료본을 건드리지 않으려 notice.tsx에 별도 정의했다(28px). 공통화는 하지 않았다.
- **늦은 완료**: 수동 상태 변경과 언마운트 때 `retry.cancel()`. 같은 틱 중복 클릭은 util 가드로 1회만 실행.

## 검증 결과 (2026-10-06, client)

| 명령 | 결과 |
| --- | --- |
| 착수 기준 | UI003 최종: 11파일 45/45, build PASS, 전체 check 기존 포맷 3파일 FAIL·경고 1 |
| 신규 테스트 선작성 후 `vp test --run <6파일>` | FAIL(모듈 없음 6파일) 확인 → 구현 후 6파일 18/18 PASS |
| `vp check <변경 파일>` | 포맷 PASS, 0 오류. 경고 2: `import(max-dependencies)` `routes/-feedback-review.tsx`(15), `routes/index.tsx`(11) — 아래 미해결 참고 |
| `vp check --no-fmt` (전체 50파일) | 0 errors / 3 warnings = 기존 1(`_dev/dev-stylex-inject.tsx`) + 위 신규 2 |
| `vp check` (전체) | FAIL(기존, 변동 없음): `package.json`, `src/routeTree.gen.ts`, `src/router.tsx` 포맷 |
| `vp test --run` | 17파일 63/63 PASS(기존 45 + 신규 18). Vitest "close timed out … 2 Vite servers" 메시지는 기준선과 동일 |
| `vp run build` | PASS |
| `git diff --check` | 출력 없음 |

브라우저(headless Chrome + CDP, 신뢰 입력 이벤트, 원본 화면·주입 없음, 세션 scratchpad `qa-ui004.mjs`): **dev(3100) 59/59, production preview(4173) 59/59 PASS**. 첫 dev 실행 53/59의 실패 6건은 모두 스크립트 오판으로, 수정 후 재실행해 PASS했다. 오판 내용: AX busy 값이 1로 반환됨, innerText 첫 줄이 기호, 01 Button loading spinner까지 애니메이션으로 셈. 제품 코드는 바꾸지 않았다.

| 완료 조건 | 확인 내용 (dev·preview 동일) |
| --- | --- |
| 1 네 상태 | 초기 조회 실패: ErrorState만 표시(`!` AX ignored). 불러오는 중: Skeleton만 표시, AX busy, 장식 ignored, 로딩 문구 노출. 직접 고른 로딩은 1.5초 뒤에도 유지(타이머 없음). 데이터 없음: 제목·설명·"+ 고객 등록"만. 데이터 있음: Table 2행 + Badge(예정·완료), 조회 영역 input 0개, `reservation-row` 라디오 3개 유지(중복 없음). 조회 영역 AX region "고객 목록 조회 영역" |
| 2 재시도 | 키보드 Enter: 불러오는 중 전환, 포커스 조회 영역(focus-visible solid 2px), 재시도 1회 → 약 0.8초 뒤 데이터 있음, 포커스 유지. 같은 틱 두 번 클릭해도 1회. 대기 중 "데이터 없음" 선택 시 1.2초 뒤에도 데이터 없음 유지(늦은 완료 차단) |
| 3 빈 상태 | 액션 키보드·클릭 각 1회 → "2회 · 실제 등록 없음", 상태 유지. 액션 없는 예시는 설명 표시, 조작 요소 0 |
| 4 의미·전달 | 정적 3종: live 의미 0, 기호 ✓/!/!, 색 `rgb(43,116,73)/rgb(232,245,237)`·`rgb(138,90,0)/rgb(253,243,224)`·`rgb(185,56,47)/rgb(255,244,242)`, 기호 AX ignored. 인라인: 빈 status·alert가 표시 전부터 있고 같은 노드 재사용. 성공·경고는 status, 실패는 alert에만 들어감. 해당 제목을 가진 live 영역은 페이지 전체에서 1개, 중첩 0, AX status/alert 노드 존재, 포커스는 누른 버튼에 그대로. 토스트: 컨테이너 role/aria-live 없음, 페이지 live 영역 4개(인라인 2·토스트 2), 경고는 status·실패는 alert, 인라인 영역과 독립 |
| 5 닫기·포커스·유지 | 정적: 경고 닫기 → 대상만 제거·다음(실패) 닫기로, 실패 닫기 → 이전(성공) 닫기로, 마지막 닫기 → "예시 다시 표시"로, 다시 표시 → 3종 복원·첫 닫기로. 인라인: 키보드 닫기 → 제거·마지막 표시 버튼 복귀, 3회 반복 정상, 정적 예시 영향 없음. 토스트: 열린 동안 표시 버튼에 `aria-describedby` 안내 연결, 다른 표시 키보드·클릭 2회 막힘·내용 교체 없음, 6초 경과·본문(제목·설명) 클릭 뒤에도 유지, 키보드 닫기 → 제거·표시 버튼 복귀·안내 해제, 실패/성공/실패 반복 정상, 닫기 버튼 Tab 도달·focus-visible solid 2px. 오른쪽 아래·뷰포트 안·그림자 |
| 6 375px·긴 문구·reduced-motion | 375×700, `prefers-reduced-motion: reduce` 에뮬레이션, 긴 문구로 실패 인라인+토스트: 페이지 가로 넘침 없음, 토스트 카드·닫기 버튼 뷰포트 안, hit-test로 가려지지 않음. 07·08 영역 애니메이션 0개. 끝까지 스크롤하면 마지막 안내가 토스트에 가리지 않음(하단 여유). 재시도 버튼 노출. reduced-motion 로딩 문구 유지 |
| 7 회귀 | 01~08 섹션 8개, 표 초기 선택 lee·행 선택 변경, 문서 id 중복 0, Dialog 열기·초기 포커스·Escape 취소·트리거 복귀·확인 1회, 입력→배경 drag로 닫히지 않음(F1), 배경 클릭 닫힘 유지, 375px 넘침 없음. 별도로 UI003 `qa-ui003.mjs`를 dev·preview에서 다시 실행: 40/41. 유일한 FAIL은 "섹션 6개" 단언이 이번 07·08 추가로 8개가 된 예정된 차이이고 나머지 Dialog 40항목 PASS. 자동 테스트 기존 45개 유지 |
| CSS | Notice 카드 `rgb(211,218,228) 1px`·radius 8px·흰 배경, EmptyState dashed, ErrorState `rgb(255,244,242)`/`rgb(241,198,193)`, Skeleton 3행·`rgb(238,242,247)`·애니메이션 없음 |
| 콘솔 | 오류·예외 없음. `/favicon.ico` 404 1건은 기존과 동일한 무관 항목 |
| 8 시안 07·08 대조 | executor 스크린샷 대조: 07 빈 화면(제목·설명·+고객 등록)·Skeleton(상단 바+원·선·짧은 바 3행)·실패 띠(!·문구·오른쪽 다시 시도), 08 세 알림 카드(원형 기호·제목·설명·×)와 하단 안내 문구가 있다. 차이: 시안 07은 세 표현을 동시에 보여주지만 구현은 story 범위대로 상태 하나만 선택해 보여준다. 시안의 빈 화면 사람 아이콘은 업무 의존 아이콘이라 넣지 않았다. 다시 시도는 기존 secondary Button(40px)이라 시안보다 크다 → **사용자 확인 필요** |

## 미해결 / 수동 확인

- `max-dependencies` 신규 경고 2(오류 아님): 검토 화면이 공통 컴포넌트를 많이 조립해서 생긴다. 파일을 나눠도 10개 이하로 내려가지 않아 그대로 두었다. 정리 여부는 리뷰·사용자 판단.
- 토스트 표시 막기의 시각 표현 한계(위 결정). 기존 Button에 `aria-disabled` 전달을 허용할지는 별도 범위.
- dev 서버에만 보이는 오른쪽 아래 devtools 버튼이 1280px에서 토스트 오른쪽 아래 모서리와 겹친다. preview(production)에는 없다. 375px dev hit-test에서 닫기 버튼은 가려지지 않았다.
- 375px 긴 문구 토스트는 화면 아래쪽 상당 부분을 덮는다(수동 닫기 전용 설계). 실제 업무 사용은 별도 판단.
- 사용자 수동 확인 필요: 시안 07·08 대조, 실패→재시도, Notice/Toast 표시·닫기·다시 표시, 실패/경고 유지, 좁은 화면, 두 시안 전체 대응표(03~08), 수동 닫기 Toast 방향.

## 미실행

- 실제 스크린리더 낭독(VoiceOver/NVDA): live 영역 전달은 AX 트리·DOM 구조로만 확인했다. 실제 낭독 여부는 확인하지 못했다.
- Safari·Firefox·실기기, 실제 OS 동작 감소 설정(에뮬레이션으로만 확인).
- 커밋·푸시(승인 없음).

## 리뷰 인계 (2026-10-06)

- 사용자 선택: 첫 구현 후 "리뷰어에게 넘기기(review)". 선택 UI를 실수로 닫은 뒤 대화로 리뷰 인계를 지시했다.
- 리뷰 요청 ID: `20261006T035506692000Z-2c63b55870a8`.
- 리뷰 기준: `implementation_done` checkpoint(verified_baseline `601be12b…`). 기준선은 HEAD `1f85d8b` + 미커밋 UI003 완료본이다.
- UI004 대상 파일(모두 미추적 신규. 단 `routes/index.tsx`만 수정):
  - `client/src/shared/ui/{empty-state,skeleton,error-state,notice,toast}/*.tsx`(구현 + test)
  - `client/src/routes/-feedback-review.tsx`, `-feedback-review.util.ts`, `-feedback-review.util.test.ts`
  - `client/src/routes/index.tsx`(07·08 섹션, paddingBottom)
  - UI003 파일(`shared/ui/dialog/`, `-dialog-review.tsx`, `theme.stylex.ts`)은 완료본이며 이번 변경 대상이 아니다.
- 검토 요청 질문:
  1. LiveNotice 구조(빈 status/alert 상시 렌더, tone별 한 영역)가 단일 전달·비중첩 요구를 충족하는지.
  2. 토스트가 열려 있을 때 표시 버튼을 막는 방식(핸들러 가드 + `aria-describedby` 안내, native disabled 미사용)이 완료 조건 5에 충분한지.
  3. 재시도 취소·언마운트 정리와 조회 영역 포커스 이동이 적절한지.
  4. 신규 `max-dependencies` 경고 2건을 그대로 둘지.

## 리뷰 1 수정 (F1·A1)

- 승인 근거: [review-brief.md 사용자 결정](review-brief.md). accept에서 F1(R1 수정)과 A1(권고)을 모두 선택했다. checkpoint `fixing`(kind fix). 보류 항목은 없다.
- **F1 (R1):**
  - `shared/ui/notice/notice.tsx`: `LiveNotice`에 선택 prop `noticeKey`를 추가해 안쪽 Notice의 `key`로 쓴다. 생략하면 기존과 같다.
  - `routes/-feedback-review.tsx`: 인라인 상태를 `{ notice, id }`로 바꾸고, 표시할 때마다 ref 순번을 올린다. status/alert 컨테이너는 유지하고, 같은 결과를 다시 표시하면 안쪽 알림 노드만 새로 들어간다. 확인값에 "N번째 표시"를 보여준다.
  - Toast는 열린 동안 재표시를 막으므로 변경하지 않았다.
- **A1:** `notice.tsx` `elevated`일 때(Toast) 텍스트 영역에 `maxHeight: calc(100dvh - 96px)`·`overflowY: auto`·`overscrollBehavior: contain`을 둔다. 내용이 길어도 카드는 화면 안에 있고, 닫기 버튼은 카드 위쪽에 남으며, 내용만 스크롤된다. 정적·인라인 Notice에는 적용하지 않는다.
- 테스트: `notice.test.tsx`에 1개 추가. 검증 내용은 다음과 같다.
  - `noticeKey` 1/2/생략 → 안쪽 Notice key `"1"`/`"2"`/null.
  - `noticeKey`가 있어도 SSR 마크업은 동일하다.
  - key 연결을 빼면 이 테스트는 실패한다.

### 수정 후 검증 (2026-10-06, client)

| 명령 | 결과 |
| --- | --- |
| `vp check <변경 파일>` | 포맷 PASS, 0 오류. 경고는 기존 신규분 `max-dependencies`(feedback-review) 1개만 |
| `vp check --no-fmt` (전체 50파일) | 0 errors / 3 warnings (첫 구현과 동일: 기존 1 + max-dependencies 2) |
| `vp check` (전체) | FAIL(기존, 변동 없음): `package.json`, `src/routeTree.gen.ts`, `src/router.tsx` 포맷 |
| `vp test --run` | 17파일 64/64 PASS(63 + F1 1). Vitest close timeout 메시지는 기준선과 동일 |
| `vp run build` | exit 0, PASS |
| `git diff --check` | 출력 없음 |

브라우저(`qa-ui004-f1.mjs` = 첫 구현 59항목 + F1·A1 10항목, headless Chrome + CDP, 원본 화면): **dev(3100) 69/69, preview(4173) 69/69 PASS**.

- **F1:** 성공·경고·실패 각각 같은 버튼을 키보드로 연속 2회 눌렀다.
  - 순번이 1 증가했다.
  - status/alert 컨테이너는 같은 노드로 유지됐다.
  - 이전 안쪽 알림 노드는 분리되고 새 노드로 교체됐다.
  - 포커스는 누른 버튼에 유지됐고, 해당 제목의 live 영역은 페이지 전체에서 1개, 반대 영역은 비어 있었다.
  - 이후 키보드로 닫으면 알림이 제거되고 표시 버튼으로 포커스가 돌아온다.
- **A1:**
  - 기본 문구 토스트는 높이 제한이 적용되지만 스크롤은 생기지 않는다.
  - 정적 Notice에는 제한이 없다(`visible none`).
  - 긴 문구 실패 토스트로 375×180, 1280×160에서 확인했다. 카드와 닫기 버튼이 화면 안에 있고, hit-test상 가려지지 않으며, 텍스트만 스크롤된다(scrollHeight > clientHeight, 휠 후 scrollTop > 0).
  - 처음 375×260·1280×300 시도는 내용이 제한 높이 안에 들어가 스크롤이 없어 스크립트 단언이 실패했다. 카드와 닫기 버튼은 그때도 화면 안이었다. 높이를 낮춰 재실행해 통과했으며, 제품 코드는 바꾸지 않았다.
  - 수정 전 코드로 같은 낮은 화면을 재현하지는 않았다.
- 회귀: UI003 `qa-ui003.mjs` preview 40/41. 유일한 FAIL은 첫 구현과 같은 "섹션 6개" 단언으로, 07·08 추가에 따른 예정된 차이다.

### 수정 후 미해결·미실행

- 실제 스크린리더에서 같은 결과를 재표시했을 때 다시 낭독되는지는 미실행. DOM 노드 교체와 AX 구조로만 확인했다.
- Toast 텍스트 스크롤 영역의 키보드 스크롤: Chrome은 스크롤 영역을 키보드 포커스 대상으로 처리하지만 Safari·Firefox는 미확인.
- 그 외 첫 구현의 미해결·미실행 항목(경고 2, 토스트 막기 시각 표현, devtools 겹침, 실기기·브라우저)은 그대로다.

## 사용자 완료 확인 (2026-10-06)

- 사용자 완료 선택: **확인 완료 · 스토리 종료**. 현재 수정본(F1·A1 반영, 기준 `5e010e7e…25ce9`)을 직접 확인했고 만족한다는 최종 승인이다. 선택 전에 `vp dev --port 3100`으로 07·08을 확인하도록 안내했다.
- 게이트:
  - handoff 승인 ✔
  - executor QA ✔: test 64/64, build, 브라우저 dev/preview 69/69
  - 고정 기준 코드 리뷰 1 ✔: R1 1건 → F1, 권고 A1까지 사용자 선택·반영
  - 사용자 수동 확인·최종 완료 확인 ✔
  - 학습: 신규 필수 아님(선택 없음). S001 기존 학습 게이트는 그대로 둔다.
  - 반복 한도: 코드리뷰/Fix 1회, QA/Fix 1회
- 남은 기록(사용자 완료 판단에 포함):
  - 신규 `max-dependencies` 경고 2개
  - 토스트 막기의 시각 표현 한계(기존 Button 계약)
  - dev devtools 버튼과 토스트 겹침(production 없음)
  - 시안과의 차이: 상태 선택형 배치, 사람 아이콘 생략, 기존 버튼 크기
  - 미실행: 스크린리더 실청취, Safari/Firefox/실기기, 실제 OS reduced-motion
  - 전체 `vp check`의 기존 포맷 3파일 실패·기존 경고 1개
  - UI004 완료로 공통 UI 묶음(UI001~UI004)이 끝났다. S001 고객 기능 완료로 확장하지 않는다.
- 마지막 검증 이후 소스 변경 없음(resume에 기준 불일치 없음). 커밋·푸시 없음.
