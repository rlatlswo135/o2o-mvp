# S001R2 구현 기록

## 다음 작업용 요약

- 전체 스토리 미완료. 현재 phase·승인 정본은 [checkpoint.md](checkpoint.md)와 runtime resume이다. FE 사용자 확인을 BE·통합·학습 완료로 확대하지 않는다.
- 제공 결과: `/customers` 고객 목록·등록·오류/로딩·모바일 화면과 가상 동작. 위치 `client/src/features/customers/`, `client/src/routes/customers.tsx`. 실제 API·DB 연결 없음.
- 유지 계약: 저장 성공은 대기 조회보다 우선하며 목록을 확정한다. 기존 `/` 검토 예시·공통 UI 계약 유지. 사용자 BE는 [be-guide.md](be-guide.md)를 참고하되 서버 규약을 AI가 임의 확정하지 않는다.
- FE 확인·선택된 F1/F2 반영 근거: 아래 '리뷰 1 반영'·'사용자 완료 선택·FE 확인', [review-brief.md](review-brief.md). 당시 테스트/브라우저 결과이지 유지보수 후 새 QA 결과가 아니다.
- 남은 게이트: 사용자 BE, 별도 승인된 FE 실제 연결, 영속성·동시성·실패 흐름 검증, 상속 deep-guide/eli5/quiz와 최종 사용자 확인.
- 보류: 등록 패널·알림 레이아웃 시프트/모달 등 디자인 디테일, BE 이후 feature/mock 구조·MSW 여부. 기존 수정 승인으로 범위를 확대하지 않는다.
- 검사 제약: 기존 TS2882·생성 routeTree 포맷 진단·경고·Vitest 종료 timeout 기록. 실제 스크린리더·Safari/Firefox·실기기·coverage 미검증. DOM 이벤트 단위 테스트 대신 당시 브라우저 검증을 사용했다.
- 하네스 리소스·문서 배치 갱신으로 소스 지문이 바뀌었다. 기존 verified_baseline은 보존했다. 실제 연결 재개 시 새 범위 승인·재검증·사용자 확인이 필요하며 현재 blocked를 자동 해제하지 않는다. [유지보수 근거](planning.md).
- 상세 원본은 아래에 보존한다. 관련 계약·결함·승인 근거 확인 때만 필요한 구간을 읽는다.

## 인계 수락

- 수락: 2026-10-06. executor가 planner `implementation_request` `20261006T063921038000Z-eae14113be08`(approved true)을 수신·검증했다.
- 승인 근거:
  - 런타임 checkpoint `approval.kind = handoff`, `story_hash = dcde0526aa0b26b53b907351337af1816b4cb5ddcc3a0c3cb457df7a619d4c8b`. `shasum -a 256 .harness/stories/S001R2/story.md` 결과가 같은 hash다.
  - 계획 출처 `planning_from = 20261006T041635308000Z-c8e7d91206a1`(UI004 완료 인계). resume errors 없음.
- 승인 범위: story.md의 **A(고객 관리 화면 완성·가상 동작)만**.
  - B(사용자 직접 BE)·C(실제 연결)는 범위 밖이다.
  - server/·API 연결·설치·설정 변경·커밋·푸시는 하지 않는다.
  - A 확인은 전체 S001 DONE이 아니며, done 명령을 실행하지 않는다.
- 작업 시작 기준: HEAD `bf61529`("shared/ui", UI001~UI004 완료본 포함, 사용자 커밋). 착수 시 `client/` 작업 트리 변경 없음. 이전 커밋 `1f85d8b`는 사용자 히스토리 정리로 현재 브랜치에 없다.

## A 구현 결과 (2026-10-06)

### 변경 파일

| 파일 | 내용 |
| --- | --- |
| `client/src/features/customers/customer.ts` (+test) | 고객 타입, 입력 확인(이름 trim·공백뿐 거절, 전화번호 필수·숫자/공백/하이픈만 허용, 문자열 보존), 비교용 `comparablePhone`(공백·하이픈만 제거) |
| `client/src/features/customers/customer-mock.ts` (+test) | 가상 예시 5명, 페이지 인스턴스용 메모리 저장소(`list(outcome)`, `save(input, outcome)`: 실패 → 중복 → 맨 앞 추가, 식별자 `c-1006`부터), 지연 작업 `createDelayedTask`(대기 중 재시작 무시·취소) |
| `client/src/features/customers/use-customer-mock.ts` | 화면의 가상 조회·저장 상태. 결과(outcome)는 요청 시작 때 고른 값을 쓰고 목록은 완료 시점 데이터를 읽음. 저장 성공은 목록이 loaded일 때만 맨 앞 반영. unmount 시 조회·저장 대기 취소. 실제 연결(C)에서 교체할 범위 |
| `client/src/features/customers/customer-list.tsx` (+SSR test) | `전체 고객` 영역: 불러오는 중 Skeleton / 실패 ErrorState+다시 시도(목록 영역 포커스) / 빈 결과 EmptyState / Table(숨김 caption `고객 목록`, 행 번호 01.., key=id, `등록된 고객 N명`) |
| `client/src/features/customers/customer-form.tsx` (+SSR test) | 새 고객 등록 패널: 열리면 이름 포커스, 입력 시 해당 오류 해제, 제출 시 확인 → 첫 오류 입력 포커스(오류 연결 뒤), 중복은 전화번호 Field 오류+포커스. 저장 중 입력 readOnly·저장 버튼 loading `저장 중`·취소/× disabled·form aria-busy·재제출 무시 |
| `client/src/features/customers/customer-mock-controls.tsx` | `가상 동작 확인`: 다음 조회 결과(정상 목록/빈 결과/조회 실패), 다음 저장 결과(정상 저장/저장 실패) SegmentedControl, `다시 조회`(조회 중 loading) |
| `client/src/features/customers/customers-shell.tsx` | 화면 틀: 어두운 좁은 레일(로고·`고객` Link만, aria-current), 상단 바 `MORU | 모루 네일(가상)` · `가상 데이터 · 저장 미연결`, `main`. 720px 미만에서 레일 가로 배치. feature 내부 파일이며 공통 shell로 추출하지 않음 |
| `client/src/features/customers/customers-page.tsx` | 조립: 헤더(CUSTOMER MANAGEMENT·h1 고객·loaded일 때만 `N명`·`+ 고객 등록` aria-expanded/열렸을 때만 aria-controls, 이미 열렸으면 이름 입력으로 이동), 패널, 단일 LiveNotice(noticeKey 증가, 닫기 시 등록 버튼 포커스), 목록+가상 데이터 안내, 가상 동작 영역. 저장 시작 시 이전 알림 비움, 성공 → 패널 닫힘·등록 버튼 포커스·status `고객을 등록했어요.`, 실패 → alert `고객을 저장하지 못했어요.`(입력 유지), 중복 → Field 오류만. 960px 이상+패널 열림이면 우측 360px 패널, 그 외 헤더-패널-알림-목록-가상 동작 순서로 쌓음 |
| `client/src/routes/customers.tsx` | `/customers` route, 페이지 조립만 |
| `client/src/routes/index.tsx` | 제목 아래 `업무 화면: 고객 관리(가상 동작)` Link 추가(기존 01~08 유지, 같은 모듈 import라 의존 수 변화 없음) |
| `client/src/routeTree.gen.ts` | `vp run build`의 TanStackRouterVite가 `/customers` route를 추가 생성(직접 편집 없음). 이 파일의 format 불일치는 기준선과 같은 생성물 형식 문제 |

설계 판단(리뷰·사용자 확인 대상):
- story.md는 “작은 책임은 억지로 hooks/util 파일로 쪼개지 않는다”고 한다. 다음 3개 파일은 책임이 따로 있어 분리했다.
  - `use-customer-mock.ts`: C에서 교체할 가상 비동기 범위.
  - `customer-mock-controls.tsx`: 검토용 영역.
  - `customers-shell.tsx`: 레일·상단 바.

  분리하지 않으면 page의 import가 lint `import(max-dependencies)` 한도(10)를 넘는다. 합치는 쪽을 원하면 refine으로 되돌릴 수 있다.
- StyleX theme vars는 `@/` 별칭으로 해석되지 않아 상대 경로(`../../shared/ui/theme.stylex.ts`)로 import한다. `routes/index.tsx`와 같은 방식이다.
- 저장 API는 `save(input, onResult)` 콜백형이다. lint `promise(avoid-new)` 경고를 새로 만들지 않기 위해서다.
- 빈 결과도 조회 성공이라 `0명`을 표시한다. 조회 실패·불러오는 중에는 개수를 숨긴다.

### 자동 검증 (변경 후 실제 결과)

| 명령 | 결과 | 기준선 대비 |
| --- | --- | --- |
| `vp test --run` | 21파일 85/85 PASS (기존 64 + 신규 21: customer 5, customer-mock 7, customer-list 5, customer-form 4). Vitest "close timed out … 2 Vite servers" 메시지 | 메시지는 기준선과 동일(`vp test --run src/shared`에서도 재현) |
| `vp check --no-fmt` (64파일) | 1 error: `src/main.tsx:6` TS2882 `./styles.css`. 3 warnings: `-feedback-review.tsx` max-dependencies(15), `index.tsx` max-dependencies(11), `_dev/dev-stylex-inject.tsx` no-floating-promises | 기준선과 동일, 신규 진단 0 |
| `vp check` (format) | `src/routeTree.gen.ts` 1파일만 format 불일치 | 기준선과 동일(생성물). 변경 소스는 `vp fmt --write` 적용 후 통과 |
| `vp run build` | exit 0, `customers-*.js` 12.29 kB 별도 chunk | — |
| `git diff --check` | 출력 없음(exit 0) | — |
| 경계 확인 | `src/shared`·`src/routes`(customers.tsx 외)에서 `features/` import 없음, features에 localStorage/sessionStorage/fetch 없음, UI004 검토 util import 없음 | — |

미실행: coverage(기존 미구성 유지), DOM 이벤트 단위 테스트(DOM 테스트 패키지 미설치 방침. 이벤트·포커스·타이밍은 아래 브라우저 QA로 확인).

### 브라우저 QA (headless Chrome + CDP, 원본 화면)

스크립트 `scratchpad/qa-s001r2.mjs`(48 checks)와 회귀용 `scratchpad/qa-ui004-f1.mjs`(69 checks, 01~08 대표 동작·UI003 Dialog drag 보호·UI004 알림 반복 재표시 포함)를 썼다.

| 대상 | S001R2 | 회귀(`/`) |
| --- | --- | --- |
| dev `vp dev --port 3100` | 48/48 PASS | 69/69 PASS |
| preview `vp preview --port 4173` (build 결과) | 48/48 PASS, 직접 `/customers` HTTP 200 | 69/69 PASS |

확인 항목(완료 조건 대응):
1. 진입
   - 직접 진입 직후 Skeleton 문구가 보이고 표·개수는 없다. 완료 후 5명, 01~05, `5명`, footer가 맞다.
   - 화면 틀 확인: h1, nav `주요 메뉴`, `고객` 링크 1개(aria-current=page), 가상 표기, main 1개.
   - AX 이름: 목록 영역 `전체 고객`, 표 `고객 목록`.
   - `/` 링크로 이동할 수 있고, 새로고침하면 예시 5명으로 돌아간다. (조건 1·7)
2. 등록
   - 열면 aria-expanded=true, aria-controls가 일치하고, 이름 입력에 포커스가 간다. AX region 이름은 `새 고객 등록`이다.
   - 이미 열린 상태에서 등록 버튼을 누르면 이름 입력으로 이동한다.
   - Tab 순서: 등록 버튼 다음이 `등록 닫기`다.
   - 빈 저장: 두 Field에 오류와 aria-invalid가 붙고, describedby로 연결되며, 이름에 포커스가 간다. 저장은 시작하지 않는다.
   - 입력하면 해당 오류가 해제된다.
   - Enter 제출 + 허용 외 문자: 전화번호 오류와 포커스.
   - 중복(`010 0000 1001`): 전화번호 오류와 포커스가 생기고 입력(`  한지민 `)은 그대로이며, 목록·알림은 변하지 않는다.
   - 저장 중: readOnly, `저장 중`, busy(AX 포함), 취소·× disabled, form busy.
   - 저장 중 requestSubmit, 재클릭, ×·취소를 눌러도 패널이 유지되고 결과는 1회만 추가된다.
   - 성공: 패널이 닫히고, 등록 버튼에 포커스가 가며, aria-expanded=false가 된다. 맨 위에 `01,한지민,010-5555-0001`이 생기고 `6명`과 footer가 갱신된다. status 알림이 뜨고 alert는 비어 있다.
   - 새 저장을 시작하면 이전 알림이 비워진다.
   - 동명이인은 별도 행으로 표시된다.
   - 취소와 ×: 닫히고 등록 버튼에 포커스가 가며, 다시 열면 빈 폼이다. (조건 2·3·4·6)
3. 실패
   - 저장 실패: alert 알림이 뜨고, 입력·패널이 유지되며, 목록은 그대로이고, 저장 버튼에 포커스가 남는다.
   - 같은 실패를 반복하면 알림 노드가 새 노드로 바뀐다(noticeKey).
   - 알림을 닫으면 등록 버튼에 포커스가 간다.
   - 정상 저장으로 바꾸면 같은 입력으로 다시 저장된다. (조건 4)
4. 목록
   - 다시 조회: 불러오는 중, `조회 중` busy, 개수와 표가 숨겨진다.
   - 조회 실패: ErrorState와 다시 시도가 보이고 `0명`·빈 결과·표는 없다.
   - 다시 시도: 불러오는 중으로 바뀌고 목록 영역에 포커스가 간다.
   - 정상 재조회 시 저장분이 유지된다.
   - 저장·조회가 겹쳐도(양쪽 순서 모두) 새 고객은 1회만 표시된다.
   - 빈 결과: EmptyState와 `0명`. 그 상태에서 첫 등록하면 1행이 된다. (조건 5)
5. 이탈: 저장과 조회가 진행 중일 때 history.back으로 `/`에 가면 늦은 완료 오류가 없다. 다시 돌아오면 새 인스턴스(예시 5명, 이탈 중 저장분 없음)로 시작한다. (조건 5·7)
6. 배치
   - 1280px 패널 열림: 목록 오른쪽에 360px 패널. 닫힘: 목록이 본문 폭을 쓴다.
   - 375px: 패널이 목록 위에 있고, 레일은 가로 배치이며, 가로 넘침이 없다.
   - 60자 이름과 40자 번호로 저장해도 페이지 가로 넘침이 없다(표는 자체 스크롤).
   - 패널 버튼은 패널 안에 있다. (조건 1·6)
7. 기타
   - 콘솔 오류·예외 없음. 브라우저가 자동 요청하는 `/favicon.ico` 404만 1건 있다.
   - 앱의 Fetch/XHR·비GET 요청은 0건이다. dev에는 도구 요청(StyleX `virtual:stylex.css` 갱신, TanStack devtools `__tsd/console-pipe`)이 16건 있고 앱 요청과 구분했다. preview의 도구 요청은 0건이다. (조건 7)

스크린샷 육안 확인: 1280px 시안 방향 배치(`scratchpad/s001r2-desktop.png`), 375px 패널 위·목록 아래 배치(`scratchpad/s001r2-375.png`).

서버는 QA 후 모두 종료했다. dev/preview background 종료 코드 144는 pkill에 의한 것이다. 스크린샷용 preview는 셸 `&`로 띄웠다가 같은 명령 안에서 pkill로 종료했다. listener와는 무관하지만 이후에는 background 실행 도구를 쓴다.

### 미실행·미해결

- 실제 스크린리더·Safari/Firefox·실제 모바일 기기 미실행. AX 트리 검사와 headless Chrome 375px 에뮬레이션만 했다.
- 사용자 수동 확인 필요: 시안 배치 느낌, 목록/등록 흐름, 오류/입력 보존, 좁은 화면, 파일 분리 구조(위 설계 판단).
- B(사용자 BE)·C(실제 연결)·학습 게이트는 범위 밖이다. DB 영속성·동시성·접근 통제는 PASS 처리하지 않는다.
- 기준선의 TS2882(`main.tsx` styles.css), routeTree.gen.ts format, 경고 3개는 사용자 커밋 범위라 손대지 않았다.
- 커밋·푸시 안 함, server/ 변경 없음, 새 의존성 없음.

## 리뷰 인계 (첫 리뷰)

- 사용자 선택: 2026-10-06 AskUserQuestion에서 “리뷰어에게 넘기기 (review)”. 리뷰 요청 ID `20261006T070037704000Z-80bde91f87c3`.
- **A의 기준만 검토하며 전체 S001 DONE은 아님.**
  - 검토 기준은 story.md의 “A 단계 확인 기준 1~8”과 A의 화면·동작·파일 경계다.
  - B(사용자 직접 BE)·C(실제 연결)·S001 전체 완료 조건·학습 게이트는 검토·PASS 대상이 아니다.
- 기준 소스 (HEAD `bf61529` 대비, Git 기준):
  - 수정: `client/src/routes/index.tsx`, `client/src/routeTree.gen.ts`(생성물).
  - 추가(untracked): `client/src/routes/customers.tsx`, `client/src/features/customers/` 12파일(위 변경 파일 표).
  - 그 외 변경은 `.harness/`, `specs/IMPACT_LATEST.md`의 하네스 런타임/계획 기록이며 제품 소스가 아니다.
- 검증 결과·미실행은 위 “자동 검증”, “브라우저 QA”, “미실행·미해결”과 같다.
- 리뷰어에게 확인을 요청하는 판단:
  1. feature 내부 파일 분리(hook/controls/shell)가 story의 “억지로 쪼개지 않는다”와 맞는지.
  2. 저장 콜백 API와 저장·조회가 겹칠 때의 처리(목록이 loaded일 때만 반영, 그 밖에는 완료 시점 데이터로 반영)가 맞는지.
  3. 빈 결과의 `0명` 표시.
  4. LiveNotice 닫기 버튼 제공과 닫을 때 포커스 복귀.

## 리뷰 1 반영 (F1·F2, 2026-10-06)

승인 근거: [review-brief.md](review-brief.md) “사용자 결정”. accept에서 F1·F2를 선택했고, 사용자는 “ㄱㄱ”로 확인했다. checkpoint `fixing --approved`. 구조 재배치는 BE 컨트롤러가 나온 뒤 결정하도록 보류했으며 변경하지 않았다.

### 변경

| 수정안 | 파일 | 내용 |
| --- | --- | --- |
| F1 (R1) | `client/src/features/customers/use-customer-mock.ts` | 저장 성공 시 `listTask.cancel()` 후 `setQuery(store.list("success"))`로 목록을 확정한다. 기존 “loaded일 때만 맨 앞 추가” updater를 대체했다. useCallback deps에 `listTask`를 추가했고 훅 설명에 “저장 성공은 대기 중인 조회보다 우선한다”를 넣었다. 저장 뒤 사용자가 새로 요청한 실패·빈 조회는 기존 시연대로 동작한다 |
| F2 (R2) | `customer.ts`, `customer-form.tsx`, `customer-list.tsx`, `customer-mock-controls.tsx` | `CustomerInput`, `CustomerFieldErrors`, `CustomerFormProps`, `CustomerListProps`, `CustomerMockControlsProps`를 `export type X = { … };`로 바꿨다. 필드·이름·기능은 그대로다. features 안에 남은 interface는 도메인 데이터 `Customer`뿐이다(reviewer 지적 대상 아님) |

### 검증 (실제 결과)

| 명령 | 결과 |
| --- | --- |
| `vp test --run` | 21파일 85/85 PASS, **exit 0**. “close timed out” 메시지는 기준선과 동일 |
| `vp check --no-fmt` | 1 error(`main.tsx:6` TS2882)·3 warnings. 기준선과 동일, 신규 진단 0 |
| `vp fmt --check` | `src/routeTree.gen.ts` 1파일만 불일치(기준선 동일 생성물). 변경 소스는 `vp fmt --write` 적용 |
| `vp run build` | 통과, `customers-*.js` 12.24 kB |
| `git diff --check` | exit 0 |
| interface 검색 | `grep "export interface" src/features/customers` → `customer.ts:3 Customer`만 |

브라우저 QA(`scratchpad/qa-s001r2.mjs`)에 “8 R1” 6개 항목을 추가해 48개에서 54개 checks가 됐다.
- 조회 실패 화면에서 저장 성공: 표와 `2명`이 보이고, 새 고객이 맨 위에 1회 표시되며, 성공 알림과 일치한다.
- 저장 → 대기 중 빈 결과 조회(저장 완료 시점에 `저장 중`·`조회 중` 동시 확인):
  - 저장 고객이 유지되고, 대기 조회는 취소되어 `다시 조회`로 돌아온다.
  - 이후 정상 재조회에서도 유지된다.
  - 같은 번호(공백 표기) 재저장은 중복으로 거절된다.
- 저장 → 대기 중 실패 조회: 실패 화면 대신 저장이 반영된 목록이 보인다.
- 그 뒤 새로 요청한 실패 조회는 기존대로 실패를 표시한다.

| 대상 | S001R2 | 회귀(`/`, qa-ui004-f1) |
| --- | --- | --- |
| dev | 54/54 PASS | 69/69 PASS |
| preview | 54/54 PASS | 69/69 PASS |

- 콘솔 오류 없음(favicon 404 1건만 별도). 앱 Fetch/XHR·비GET 요청 0건. dev 도구 요청은 20건, preview는 0건이다.
- 서버는 종료했다. background 종료 코드 144는 pkill에 의한 것이다.

미실행·미해결:
- 이전과 같다: 실제 스크린리더, Safari/Firefox, 실기기, coverage.
- 훅 단위 이벤트 테스트는 DOM 테스트 패키지 미설치 방침이라 브라우저 QA로 대신했다.
- 구조 재배치와 MSW 전환 여부는 BE 이후 결정한다(보류).

## 사용자 완료 선택·FE 확인 (2026-10-06)

- 완료 선택 1차: AskUserQuestion에서 “문제 있음 · 논의/수정”.
  - 논의: 고객 등록 시 레이아웃 시프트, 그리고 모달로 등록하면 어떤지.
  - executor 설명: 시프트는 두 가지다.
    1. 데스크톱에서 패널이 열리면 1단에서 2단으로 바뀌며 목록 폭이 줄어든다.
    2. 성공 알림이 목록 위에 들어가며 목록이 밀린다.

    선택지도 함께 설명했다.
    - 모달: 승인된 story의 “비모달 등록 패널·Drawer 없음”과 다르므로 planner를 거친 스토리 변경이 필요하다. 공통 Dialog에 저장 중 닫힘 차단과 코드 닫기 보강도 필요하다.
    - 범위 안 대안: 오른쪽 360px 열을 항상 확보한다.
- 사용자 결정 원문: “일단 그대로두자, 나중에 대충다 완성됐을때 디자인디테일잡는걸 별도 스토리로해서 개발하던지해야겠네. 지금은 완료처리하고 플래너한테 말해줘”.
  - 소스 변경 없음. 수정 승인도 없음.
  - 현재 수정본(리뷰 1 F1·F2 반영, implementation_done baseline `2ce85f24…a416`)에 대한 **FE 단계 사용자 확인 완료**로 기록한다.
- 완료 처리 방식: story.md “진행·인계·대기” 2·3에 따라 **done을 실행하지 않는다.**
  - B(사용자 직접 BE)·C(실제 연결)·상속 학습 게이트(deep-guide/eli5/quiz)가 남아 있다.
  - `checkpoint S001R2 blocked`로 외부 의존성 대기 상태가 된다. blocked는 결함 확정이 아니다.
  - 이번 FE 확인으로 실제 저장·새로고침 영속성·DB 동시성·접근 통제를 통과했다고 하지 않는다.
- 확인 시 게이트:
  - 승인 revision(handoff `20261006T063921038000Z-eae14113be08`, story hash 일치).
  - 고정 기준 리뷰 1 수신·브리핑, accept F1·F2 반영·검증(test 85/85 exit 0, build, dev/preview 54/54·회귀 69/69).
  - 마지막 검증 이후 소스 변경 없음. resume baseline이 동일하다.
- planner에 넘길 보류 항목 (모두 별도 계획·승인 필요, 이번 범위 아님):
  1. **디자인 디테일 별도 스토리** (사용자 제안, 기능이 대체로 완성된 뒤): 등록 시 레이아웃 시프트, 모달 전환 여부(story 변경, 공통 Dialog의 저장 중 닫힘 차단·코드 닫기 보강 포함), 알림 삽입 시 밀림.
  2. **features 파일 구조·mock 처리** (BE 컨트롤러가 나온 뒤): `mock/` 격리 또는 모듈별 폴더, 실제 API 함수와 MSW(dev 전용, 새 의존성) 전환 여부. 테스트는 대상 옆에 둔다는 방향은 논의됐다. features 폴더 규칙을 문서화할지도 함께 정한다.
  3. 기존 B/C 단계: 사용자 BE 가이드는 요청 시 planner가 제공한다. 실제 연결은 별도 승인이 필요하다.
