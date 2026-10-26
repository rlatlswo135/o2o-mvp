# 하네스 흐름

선택·인계·재개 절차의 정본이다. 역할 문서(`.harness/roles/*.md`)는 책임과 검토 기준만 둔다.

## 원칙

- 기본은 planner·reviewer·designer·qa·refactor가 Pi, executor가 Claude Code다(`.harness/layout.json`의 `agents`로 역할마다 바꿀 수 있고, planner·reviewer·designer·qa·refactor를 Claude로 실행하면 `.harness/CLAUDE-ROLE.md`의 방식으로 요청을 받고 도구를 쓴다. 실행자를 Pi로 쓰는 조합은 지원되지 않는다). 기본은 planner/executor/reviewer이고 designer/qa/refactor는 선택 역할이다. 소스 수정자는 executor 한 명이다.
- 사용자는 각 역할 pane에 자연어로 직접 요청한다. 하네스 명령은 Pi의 `/harness`(현재 작업 재전달) 하나뿐이다(Claude 역할은 `c2h next ROLE --explicit`).
- 런타임은 프로젝트 루트의 `node .harness/bin/c2h.mjs`다. 출력은 JSON, 진단은 stderr다. 모델·thinking·effort는 사용자가 관리한다.
- 사용자에게 하는 설명·브리핑·선택창·완료 안내는 한국어다. 영어 도구 출력·알림·인계 본문은 언어 변경 요청이 아니다. 코드·명령·원문 인용은 그대로 둔다.
- 한 번에 활성 스토리 하나다. 독립 리팩터링과 스토리 구현·리뷰·완료 정리는 동시에 실행하지 않는다. 리팩터링 중에도 다음 스토리 계획(planner 보강·디자인·QA 계약 준비)은 계속할 수 있고, 실행자 인계만 리팩터링이 끝난 뒤로 미뤄진다. setup·역할 로드·"작업 진행"만으로 미승인 구현을 시작하지 않는다.
- 사람의 의견은 **계획을 만드는 데**에만 들어간다: 스토리 보강, `c2h_plan_next` 인계 선택, 디자인 방향 선택, QA 가치 인터뷰. 그 뒤 디자이너↔플래너 왕복 → 실행자 인계 → 구현 → 종합 검토 → 계획 대비 반영 → 완료 → 결과 정리는 자동이며 막힐 때만 묻는다. 구조 개선 자문은 이 자동 수정에 섞이지 않으며, 완료 후 **독립 리팩터링**에서는 사용자가 정확한 수정안을 별도로 승인한다.
- 선택은 실제 선택 UI(Pi 확장 선택창, Claude AskUserQuestion)로 묻고 텍스트 질문으로 대체하지 않는다. 사용자는 해당 역할의 원본 pane에서 답한다. 보드는 `선택 필요`만 표시하고 대신 답하지 않는다. 취소·빈 응답·타임아웃·UI 없음은 승인이 아니다. 선택 UI가 없으면 Pi 설치·신뢰·`/reload`를 확인하고 멈춘다.
- 커밋·푸시·범위 확대·계획 밖 의존성·파괴적 작업은 별도 승인이다. Git·package.json은 필수가 아니며 없다고 초기화·설치하지 않는다.
- 같은 OS 계정의 신뢰된 세션용이다. 역할 이름과 `--approved`는 인증이 아니라 사용자의 명시적 승인 주장이다. 메시지에 비밀을 넣지 않는다.

## 재개

1. 프로젝트 지침(AGENTS.md/CLAUDE.md)과 현재 역할을 확인한다. 다른 역할로 조용히 전환하지 않는다.
2. `node .harness/bin/c2h.mjs resume ROLE`이 현재 단계의 정본이다(읽기 전용). `task`가 있으면 **독립 리팩터링**으로 먼저 분기한다. 독립 요청은 story.md·이전 스토리 승인·checkpoint·ack를 사용하지 않는다. 그 밖에는 현재 story.md·관련 계약과 이 문서의 해당 절차만 읽는다. 완료 스토리·과거 대화·index 전체는 읽지 않는다. 미처리 메시지는 `inbox ROLE`, 충돌 조사는 `status`로 본다.
3. 대상 없음·파일 누락·역할/승인/phase 충돌·envelope 유실·소스 drift면 멈춘다. 승인이나 요청을 추측해 만들지 않는다. `reverification_required`면 이전 검증을 새 소스에 쓰지 않는다. `busy`면 잠시 뒤 다시 확인한다. 오류가 stale lock이면 안내대로 `unlock --approved` 뒤 다시 확인하고, 승인된 파일 변경이면 `restore-approved STORY --approved`로 승인본을 되돌린다(**복구**).

| action | 다음 행동 |
| --- | --- |
| plan | planner: 계획 보강 후 `c2h_plan_next` |
| select_story | executor: 준비된 미승인 스토리를 이름·범위·완료 조건과 함께 AskUserQuestion 단일 선택으로 제시. 선택이 구현 승인이다 |
| implement | executor: 승인된 인계·진행 중 범위만 구현 |
| implementation_choices | `auto: quality` — 종합 검토 요청 |
| brief | 회신 검증·브리핑·ack 후 `auto: apply` |
| review_decision | `auto: apply` — 계획 대비 반영, 반영할 것이 없으면 완료 |
| completion_choices | `auto: recheck`(검증된 수정의 재리뷰), `apply`(재리뷰 회신 반영) 또는 `done`. `auto` 대신 `auto_stopped`면 사용자에게 묻는다 |
| review / review_choices | reviewer: 리뷰 작성 / 보고서 전달. executor는 소스 수정 없이 대기 |
| plan_next | planner: **완료 정리** |
| assist | designer/qa/refactor: 요청 수행 |
| refactor_discuss | refactor: 고정된 수정안 논의·c2h_refactor_next로 선택 |
| refactor_implement | executor: task ID로 refactor-start 후 수정 전·후 같은 검증·refactor-finish (`task.phase: fixing`이면 리뷰 지적 반영, `source_changed`면 이미 한 수정을 되돌리지 않고 마무리만) |
| refactor_review | reviewer: 리팩터링 리뷰 작성·c2h_refactor_review |
| refactor_decision | executor: 리뷰 회신을 수정안과 대조해 refactor-fix 또는 refactor-done. `reviews_left: 0`이고 지적이 남으면 사용자에게 묻는다 |
| refactor_cleanup | executor: refactor-finish ID로 소스 수정 없이 정리 재시도 |
| wait | 대기. 다른 스토리를 시작하지 않는다 |
| blocked / done | 원인·결과만 안내. 다음 스토리를 임의로 시작하지 않는다 |

- 새 스토리 인계는 같은 세션의 **새 작업 경계**로 받는다. resume·inbox·스토리 파일만 기준으로 삼고 이전 스토리의 범위·승인·판단을 잇지 않는다. 세션 교체·tmux 키 주입은 하지 않는다.
- 컨텍스트가 찼을 때만 사용자가 새로 시작한다: Claude는 `/clear` 뒤 "이어서 진행", Pi는 `/new` 뒤 `/harness`.
- Pi 확장은 유휴·입력 없음일 때 inbox의 검증된 요청을 자동 전달한다. 전달이 안 됐으면 그 pane에서 `/harness`(designer/qa/refactor는 `/harness 요청`도 가능).
- Claude executor는 resume 확인 후 `node .harness/bin/c2h.mjs listen executor --timeout 0`을 네이티브 Bash `run_in_background: true`로 **하나만** 연다. 셸 `&`·추가 에이전트·반복 폴링은 쓰지 않는다. 알림이 오면 출력 읽기 → resume 재검증 → 착수·브리핑 → 그 메시지만 `ack executor ID` → waiter 하나 재무장. waiter는 하네스가 멈추거나 상태를 읽지 못하는 동안 끝나지 않고 풀릴 때까지 기다린다. 새 세션에서는 옛 waiter가 살아 있다고 가정하지 않는다. 권한·알림 실패는 숨기지 않는다. waiter 없이 턴을 끝내면 Stop 훅이 한 번 막는다: 남은 요청부터 확인하고 waiter를 연 뒤 끝낸다.

## 스토리 폴더

`.harness/stories/SNNN/`에 사람이 읽는 문서는 최상위, 런타임·역할 기록은 `records/`에 둔다. 버전 파일(design-2.md)·별도 수락 파일은 만들지 않는다.

- 최상위: `story.md`(템플릿 `.harness/STORY.md`), `design.md`·`preview.html`, `implementation.md`, `qa-contract.json`·`qa-values.json`·`acceptance/`, 필요하면 `planning.md`·`impact.md`
- `records/`: `checkpoint.md`(런타임 생성, 직접 편집 금지), `review-N.md`·`design-review-N.md`·`qa-N.md`(전송 후 불변), QA 실행 증거, 종합 검토 기록, `result-draft.md`
- 승인 때 승인된 story·design·preview·QA 파일의 사본이 `records/approved/`에 저장된다(`restore-approved`의 원본).
- 완료 후에는 `result.md` 하나만 남는다(**완료 정리**).
- `.harness/stories/index.md`는 스토리당 한 줄(이름·링크·의존성·완료 여부)이다. phase·승인·이력을 복제하지 않는다.
- 상태 정본은 `.harness/active.json`과 `records/checkpoint.md`이며 `checkpoint STORY PHASE --note '근거'`로만 바꾼다. 승인 후 story.md는 동결한다. 진행·검증·반영 판단은 implementation.md에 쓴다.
- 하네스 산출물은 `.harness/` 아래에 둔다. 외부 스킬의 `specs/*`·공용 LATEST 경로는 쓰지 않는다.

| phase | 허용 행동 |
| --- | --- |
| planning | 계획 보강·선택 |
| implementing | 승인된 범위 구현·검증 |
| implementation_done | 첫 구현이면 종합 검토 요청, 반영 뒤면 수정 재리뷰 또는 완료 |
| reviewing / review_ready | 리뷰 중. 소스 동결 |
| review_decision | 계획 대비 자동 반영 |
| fixing | 기록한 지적만 수정·검증 |
| blocked | 원인·필요한 결정 안내 |
| done | 완료. planner가 결과 정리 |

## 계획

1. planner는 사용자와 대화하며 작은 수직 스토리로 정리한다. story.md에 사용자 가치·범위·제외 범위·완료 조건·의존성·남은 결정·검증 계획을 쓴다. 대상이 불명확하거나 사용자만 정할 수 있는 결정(제품 방향·우선순위·범위)은 묻는다.
2. 검증 계획은 아래 **시나리오 우선 테스트**대로 정한다. 실제 브라우저·브라우저 E2E는 QA가 맡는다. 새 UI 스토리는 디자이너 인계 전에 필수 브라우저 기준을 담은 QA 계약과 실행 가능한 QA 역할을 준비한다. 자동화로 대신할 수 없고 사용자가 원하는 항목만 '사람 확인 필수'로 적는다.
3. `checkpoint STORY planning --note '계획 준비'`로 저장한다. **Pi planner만** `c2h_plan_review(story)`로 독립된 읽기 전용 계획 검토를 받는다. 현재 pane의 모델·thinking·인증을 사용하며 별도 reviewer pane·외부 extension은 쓰지 않는다. 검토자는 read/grep/find/ls만 갖고 요구 누락·모순·영향 범위·검증 허점을 지적한다. planner가 반영하고 사용자만 정할 결정은 묻는다. 새 요구·범위 확대를 검토자 의견만으로 추가하지 않는다. 초안·준비된 디자인·QA 계약이 바뀌면 다시 검토한다. 현재 초안의 지적별 반영·보류 이유와 남은 위험을 `c2h_plan_review(story, response="…")`로 기록한다. 검토 실패·취소는 통과나 승인이 아니며 재시도한다.
4. 승인할 범위·검토 대응·남은 위험을 보여준 뒤 **`c2h_plan_next(story)`**를 호출한다(story는 ID만). Pi에서는 검토·대응이 없으면 선택창 대신 검토 결과를 반환한다. 호출을 빠뜨려도 확장이 새 planning checkpoint를 보면 같은 검토→선택 흐름을 시작한다. 검토 기록은 현재 Pi 세션에만 있어 새 세션·분기에서 없으면 재검토한다. 검토는 구현 승인이나 실제 테스트가 아니다. Claude planner는 사전 검토 없이 기존 선택 흐름을 유지한다.
5. 선택지는 살아 있는 역할만 표시된다.
   - **실행자에게 넘기기**: 표시된 스토리 revision의 구현 승인이다. 확장이 story·design·QA hash를 고정해 handoff를 저장한다. 디자인·브라우저 기준 없는 직접 인계는 **화면·브라우저 검증이 불필요한 작업만** 선택한다. UI 스토리의 디자인/QA를 생략하는 대안이 아니다.
   - **디자이너에게 넘기기**: 사용자가 방향을 고른 뒤 확정될 설계의 구현 승인까지 포함한다. 이후 왕복·인계는 자동이다.
   - **QA 검증 계약 만들기**: 계약이 준비되면 다시 `c2h_plan_next`. 새 UI 스토리는 필수 브라우저 기준이 필요하므로 디자이너 인계보다 먼저 고른다. QA가 없으면 UI 구현 인계를 승인하지 않고 역할·환경부터 준비한다.
   - **보강**·**논의**: 인계하지 않는다.
6. 승인 후 범위가 바뀌면 기존 인계를 정리하기 전에는 진행하지 않는다.

## 디자인

- 화면이 있는 스토리는 기능이 단순해도 시각 설계를 생략하지 않는다.
- designer는 story.md·기존 디자인 시스템을 읽고 추천 방향 2~3개로 `c2h_design_direction`을 호출한다. **디자인에서 사용자가 직접 정하는 유일한 단계다.**
- 고른 방향으로 `design.md`(구체적 토큰·상태·구현 안내·남은 결정)와 의존성 없는 로컬 `preview.html`(로컬 mock만) 한 벌을 만든다. 고칠 때는 같은 파일을 갱신한다.
- `c2h_design_next(story, design, preview, needsPlanning)`: false면 story·design·preview를 고정해 executor에게 자동 인계하고, true면 planner에게 요구 재검토를 보낸다. true는 스토리 범위·완료 조건이 바뀌어야 할 때만 쓴다. 정해진 동작 안의 상호작용 세부는 design.md에 추천안을 적고 false로 둔다.
- 다음 역할이 없거나 QA 계약 준비 중이거나 왕복이 3회를 넘으면 자동 인계 대신 선택창이 열린다.
- executor는 고정된 design·preview를 실제로 구현하며 "참고용"으로 취급하지 않는다.

## 디자인 ↔ 플래너 왕복

1. designer는 범위를 바꿔야 하는 질문을 design.md '남은 결정'에 적는다. 사용자 요청은 `사용자 요청:` 뒤에 원문 그대로 남긴다. `needsPlanning=true`면 확장이 `c2h_plan_feedback`을 planner에 보낸다.
2. planner는 자동 수신한 피드백을 story.md에 반영한다. 디자이너가 전한 사용자 요청은 사용자 의견이므로 플래너 초안의 제외 범위를 근거로 거절하지 않는다. 사용자가 이전에 명시적으로 정한 것과 충돌하거나 계획으로 정할 수 없을 때만 묻는다.
3. `checkpoint STORY planning --note '디자인 피드백 반영: 바뀐 점'` → `ack planner ID`. Pi planner는 바뀐 계획을 `c2h_plan_review`로 검토·대응 기록한 뒤 자동 반환한다(위 **계획**과 같은 기준). `c2h_plan_next`나 방향 재선택은 호출하지 않는다. Claude planner의 기존 자동 반환은 그대로다.
4. 확장이 고른 방향을 새 revision에 이어 붙여 `keep_direction` 요청을 designer에게 보낸다. designer는 방향을 다시 묻지 않고 design.md·preview.html을 갱신해 `c2h_design_next`를 호출한다.

## 시나리오 우선 테스트

테스트 단위는 코드 파일이 아니라 사용자 목표와 실패 위험이다. 모든 코드에 unit TDD를 강제하지 않는다. 기존 테스트를 이 정책만으로 일괄 삭제하지 않는다.

- **Planner**: story.md에 사용자 목표·사전 상태/데이터·행동 순서·관찰 가능한 기대 결과·오류/경계/복구 갈래·검증 수준/담당·명령/절차를 적는다. 기대값은 요구에서 정하고 구현을 정답으로 삼지 않는다. 기존 테스트 패턴·허용 환경·HTTP 경계 실패 주입도 확인한다. 테스트 코드 전체를 먼저 작성하지 않는다.
- **수준 선택**: 핵심 전체 흐름·실제 화면/서버 연결은 QA 브라우저로 검증한다. 많은 오류·경계 조합은 executor의 API/통합 테스트로 빠르게 확인하고, 분리 검증할 가치가 있는 로직만 unit test를 추가한다. 같은 시나리오를 모든 계층에 중복 구현하지 않는다. 성공 경로만이 아니라 실패 뒤 입력·캐시·서버 상태·재시도/복구도 확인한다.
- **BE**: 단순 controller 위임·전달은 개별 unit test를 기본 제외하고 API 시나리오로 확인한다. 계산·변환·formatting·분기는 의미 있는 위험이 있을 때만 unit test를 둔다(금액·날짜·타임존·권한/데이터 경계 등).
- **Client**: 일반 화면·컴포넌트의 unit/컴포넌트·SSR 문자열 테스트는 기본 제외한다. 테이블의 선택·정렬·페이지 이동·키보드 같은 복잡한 공통 상호작용에만 필요한 컴포넌트 테스트를 둔다. 복잡한 상태·계산·캐시 로직은 위험에 따라 별도 검증할 수 있다. 테스트를 위해 로직을 억지로 추출하거나 DOM 의존성을 설치하지 않는다.
- **Executor**: 계획된 제품 자동 테스트 작성·실행, 구현·빌드·타입 검사를 맡는다. 선택적 TDD 대상은 행동 하나씩 테스트 → 올바른 이유의 RED → 최소 구현 → GREEN을 반복한다. 공개 인터페이스·HTTP 경계를 선호하고 내부 호출 횟수/구현 모양을 정답으로 만들지 않는다. 빠르고 독립적이며 반복 가능하고 자동 판정되는 테스트를 쓴다. 구현 후 QA 검증은 인수 검증이지 TDD 증거가 아니다. 필수 커밋·별도 specs 문서·새 스킬 설치는 요구하지 않는다.
- **QA**: 실제 브라우저·브라우저 E2E·수정본 재검증을 맡는다. UI 동작에서 발견한 결함은 재현 흐름·기대/실제·네트워크/화면 증거를 전달한다. executor는 가치 있는 수준에 회귀 검증을 추가하고 고친다. 시각 결함을 억지로 unit test로 만들지 않는다.
- **Reviewer**: 테스트 개수·파일별 유무 대신 중요한 실패 경로·독립 정답·과도한 mock/중복·미실행을 검토한다. 실제 브라우저 검증을 대신하지 않는다.

## QA 검증 계약

새 UI 디자인의 구현 인계에는 필수 브라우저 기준을 담은 계약과 QA 역할이 필요하다. 런타임의 자동 강제 기준은 준비된 디자인의 composite 인계이며, 자연어 스토리나 변경 코드를 보고 UI 여부를 자동 분류하지 않는다. UI 여부·필수 시나리오는 planner와 사전 검토가 판단한다. 디자인·브라우저 기준 없는 직접 인계는 불필요한 작업임을 선택창에서 명시 확인하며, UI의 우회 경로로 쓰지 않는다. 브라우저 검증이 필요 없는 작업은 계약 선택 사항이다. 만들면 handoff에 고정되고 완료 전에 현재 버전의 QA PASS가 필요하다. 기존 승인에 새 계약을 소급 요구하거나 동결 파일을 고치지 않는다. 계약 없는 기존 작업의 QA는 일반 보고서로 참여한다.

1. `c2h_qa_interview(story)`로 사용자에게 가치·허용 불가 실패·독립 정답 기준·경계·비운영 환경을 묻는다. 기대값은 사용자에게서 받고 구현에서 추론하지 않는다.
2. `qa-contract.json` version 1: `criteria:[{id,value,condition,oracle,cases:[str],required,irreversible,method?,tests:[relative path]}]`. `method`는 `test`(생략 시 기본값) 또는 `browser`다. 실행형 기준은 실행 가능한 독립 테스트가 필요하며 `.harness/stories/STORY/acceptance/`에만 둔다. 브라우저 기준은 `cases`에 실제 행동 순서·실패/복구 갈래, `condition`·`oracle`에 관찰할 기대값·정답 기준을 적고 `tests: []`도 허용한다. 자동화하지 않을 시나리오에 가짜 테스트 파일을 만들지 않는다. 새 UI는 `required: true, method: "browser"` 기준을 포함한다.
3. `c2h_qa_ready(story, contract)`가 값·계약·테스트를 고정하고 planner에 알린다. 계약 준비 중에는 디자이너가 자동 인계하지 않는다.
4. 승인 뒤 acceptance 테스트를 약화·삭제·건너뛰지 않는다. 테스트·계약 자체의 결함만 **QA 계약 수정**으로 고친다. 런타임은 drift를 감지하지만 OS sandbox는 아니다.

## 구현과 자동 구간

executor가 사용자 선택 없이 이어서 수행한다. 각 단계 전에 resume으로 상태와 `auto`를 확인한다.

1. **착수**: `implementation_request`의 승인·revision을 확인하고 그 메시지만 ack한다. planner·designer가 승인한 인계에 다시 선택을 요구하지 않는다.
2. **구현**: 승인된 범위만 구현한다. 계획의 공백·세부 모순은 묻지 않고 계획 의도에 가장 가까운 선택을 한 뒤 implementation.md `## 구현 판단`에 근거(계획 줄)와 함께 남긴다. 범위·완료 조건이 바뀌어야 할 때만 멈추고 묻는다. 계획된 API/통합·선택적 unit/컴포넌트 테스트·빌드·타입 검사를 하고 implementation.md에 변경 파일·담당 시나리오별 명령과 실제 결과·선택적 TDD의 RED/GREEN·미실행 항목을 쓴 뒤 `checkpoint STORY implementation_done --note '구현·검증 완료'`.
3. **종합 검토 요청** (`auto: quality`): `node .harness/bin/c2h.mjs quality STORY`. 살아 있는 reviewer·designer·QA·refactor가 같은 동결 버전을 검토한다. refactor는 첫 검토에 구조 자문만 제출하며 수정 재리뷰에는 자동 참여하지 않는다. 요청 ID를 보존하고 회신까지 소스를 바꾸지 않는다. pending 요청은 재사용한다.
4. **브리핑** (`brief`): `wait REQUEST_ID --timeout 1`로 회신을 검증하고 각 역할의 원본 보고서를 읽어 R/D/Q 지적·증거·한계를 짧게 브리핑한 뒤 그 회신만 ack한다. 누락 보고서는 PASS가 아니다.
5. **계획 대비 반영** (`auto: apply`): 지적마다 story.md·design.md·QA 계약과 실제 코드를 대조한다.
   - 반영: 계획·디자인·QA 계약 불일치, 실제 결함(버그·테스트 실패·완료 조건 누락·보안/데이터 손실 위험)
   - 반영 안 함: 계획 밖 취향, 틀린 지적, 범위 확대·새 의존성이 필요한 제안, `advisory.refactor`의 구조 제안(F ID). refactor 제안은 별도 보관 위치만 알리고 사용자와 논의·독립 승인 뒤에 수정한다

   implementation.md `## 리뷰와 반영`에 지적 ID → 반영 여부 → 근거를 표로 남긴다. 반영할 것이 있으면 `checkpoint STORY fixing --approved --note '자동 반영: R1, D2 (계획 근거)'` → 수정·재검증 → `checkpoint STORY implementation_done --note '자동 반영 검증'`. 반영할 것이 없으면 7(완료)로 간다.
6. **수정 재리뷰** (`auto: recheck`): `node .harness/bin/c2h.mjs quality STORY --recheck`. reviewer(QA 계약이 있으면 QA도)가 직전 리뷰 이후 바뀐 부분(`changes STORY --since review`)만 다시 본다. 회신은 4–5와 같이 브리핑·반영하고, 새로 반영할 것이 없으면 완료한다.
7. **완료** (`auto: done`): 계획에 '사람 확인 필수' 항목이 있을 때만 AskUserQuestion으로 한 번 결과를 받는다. `checkpoint STORY done --approved --note '자동 완료: 반영 ID·검증 근거'`. 런타임이 검증 기준·QA PASS를 확인하고 planner 완료 정리 인계를 함께 저장한다.
8. 완료 후 결과를 짧게 알리고 listener를 유지한 채 대기한다. 다음 구현은 새 승인 인계로만 시작한다.

마지막 검증 이후 소스가 바뀌면 완료할 수 없다. 리뷰 요청(종합 검토·수정 재리뷰)은 스토리당 3회까지이고 런타임이 그 이상을 거절한다. 한도에 닿으면 QA 계약이 없을 때는 검증된 수정으로 완료하고(`auto: done`), 있으면 `auto_stopped`로 멈춰 사용자에게 묻는다. 같은 수정이 연속 2회 실패하면 멈추고 묻는다.

## QA 계약 수정

승인된 acceptance 테스트나 qa-contract.json 자체가 틀려 올바른 제품도 통과할 수 없을 때만 쓴다(예: 테스트 서버가 쿼리 붙은 경로를 404로 응답). 기대값·완료 조건을 바꾸는 것은 수정이 아니라 새 범위 승인이다. 필수 브라우저 기준을 실행형 테스트로 대체하거나 없애는 것도 계약 수정으로 우회할 수 없다. 사용자 답변(qa-values.json)은 바꿀 수 없다.

1. **QA**: 고정 파일은 그대로 두고 그 기준을 blocked로 기록한다. 고친 `qa-contract.json`·`acceptance/` 파일을 `records/qa-amend/` 아래 같은 상대 경로로 저장하고, 같은 검증 복사본에서 수정안을 실행한 명령·출력을 증거로 남긴다. 보고서 `## QA 계약 수정안`에 결함 근거(제품이 아니라 테스트가 틀린 이유)와 바뀐 점을 쓰고 제출한다.
2. **executor**: resume이 `qa_amendment`(초안 파일 목록)와 `auto_stopped`를 보이면 자동 단계를 멈춘다. 결함 근거와 원본 대비 diff를 보여주고 AskUserQuestion 단일 선택으로 묻는다.
   - **수정안 승인**: `node .harness/bin/c2h.mjs qa-amend STORY --approved --note '사용자 승인: 결함 요약'`. 수정된 계약이 고정되고(승인 스냅샷 포함) 초안 폴더는 지워진다. 이전 계약의 QA 결과는 남지만 완료 근거가 되지 않는다.
   - **수정안 거절**: 초안 폴더 `records/qa-amend/`를 지우고 **자동 완료가 막혔을 때**의 선택으로 간다.
3. 승인 뒤 다른 반영할 지적과 함께 `checkpoint STORY fixing --approved --note 'QA 계약 수정 반영 …'` → 검증 → `implementation_done` → 자동 구간 6(수정 재리뷰). QA가 수정된 계약으로 현재 버전을 다시 검증하고, 완료에는 그 PASS가 필요하다. 리뷰 한도에 닿았으면 사용자의 추가 검토 선택으로 진행한다.

## 자동 완료가 막혔을 때

QA 필수 기준이 재검증 후에도 FAIL·blocked이거나(테스트 결함이면 **QA 계약 수정**), 같은 수정이 연속 2회 실패하거나, 계획을 바꿔야만 반영할 수 있는 지적이 있거나, resume이 `auto_stopped`(리뷰 한도)를 보이거나, done이 거부된 경우다. 이유를 implementation.md에 쓰고 AskUserQuestion 단일 선택으로 묻는다.

1. **확인 완료 · 스토리 종료**: `checkpoint STORY done --approved --note '사용자 완료 확인'`. 필수 게이트는 런타임이 여전히 확인한다.
2. **문제 있음 · 수정**: 사용자가 말한 수정 범위를 기록하고 `checkpoint STORY fixing --approved --note '사용자 요청 수정'` → 검증 → implementation_done → 자동 구간 6.
3. **추가 검토**: 다시 볼 질문을 기록하고 `quality STORY --again --approved` → 자동 구간 4부터. `--approved`는 리뷰 한도를 넘는 사용자의 선택이라는 뜻이다.

사용자가 자동 반영 대신 **수정안을 직접 고르겠다**고 하면 review_decision에서 지적을 AskUserQuestion 다중 선택(기본 선택 없음)으로 보여주고, 고른 것만 `fixing --approved --note '선택한 지적 ID'`로 진행한다. **지적 하나를 논의하자**고 하면 실제 코드와 대조해 설명하고 `## 리뷰와 반영`에 기록한다. 논의는 수정 승인이 아니다.

## 리뷰

reviewer는 확장이 전달한 요청으로 시작한다. 첫 구현이 끝났는데 요청이 없으면 `/harness`가 `review STORY` 요청을 만든다.

1. 요청·승인 범위·implementation.md·변경 파일을 읽고 위험에 필요한 호출부·타입·테스트만 확인한다. 바뀐 경로는 `changes STORY`(승인 이후)로 본다. 수정 재리뷰(요청의 `recheck_of`)면 `changes STORY --since review`로 직전 리뷰 이후 바뀐 부분과 `## 리뷰와 반영`만 본다. Git diff는 있을 때만 참고하고 없으면 한계로 기록한다.
2. 작고 대상이 명확한 비변경 unit/repro 확인만 허용한다. 실제 브라우저·브라우저 E2E는 QA, API/통합·전체 suite·빌드는 executor 몫이다. **시나리오 우선 테스트** 기준으로 중요한 실패 경로와 과도한 세부 테스트를 확인한다. 소스·생성물을 바꾸지 않는다.
3. `records/review-N.md`에 요청 ID, 검토/미검토 범위, 지적(R1…: 심각도, 파일:라인, 실패 조건, 최소 수정안, 근거가 된 계획 줄 또는 결함 근거), 불확실성을 쓴다. 실행자 증거 인용과 직접 확인을 구분하고 계획 밖 취향은 '제안'으로 분리한다. 지적이 없어도 한계와 함께 기록한다.
4. `checkpoint STORY review_ready --note '리뷰 초안 저장'` 후 **`c2h_review_next(requestId, review)`**로 전달한다. 별도 전송 승인은 없다. 새로 저장된 초안이 하나뿐이면 확장이 응답 종료 시 자동 전달한다.
5. review_request를 미리 ack하지 않는다. 전송된 보고서는 불변이다.

## 종합 검토

`quality STORY` 요청은 reviewer·designer·QA·refactor에 독립적으로 전달된다. 요청된 보고서가 모두 모이면 런타임이 executor에게 한 번 회신한다.

- 동결 중에는 정확히 상관된 `c2h_quality_request`만 읽기 전용으로 수행한다. 일반 보조 작업은 대기한다. 소스·생성물을 바꾸지 않는다.
- designer는 승인 디자인 대비 실제 화면(D ID), QA는 완료 조건·오류·경계·회귀(Q ID), reviewer는 코드(R ID)를 본다. 지적마다 근거가 된 계획 줄을 적는다. refactor는 구체적인 구조 개선 비용·대안(F ID)을 보고하며 **구조 개선 검토**를 따른다. 구조 자문은 자동 반영 대상 원본과 분리된다.
- 준비된 비운영 환경·테스트 데이터만 쓴다. 서버·권한이 없으면 미실행/blocked로 기록한다. 운영 결제·메일·삭제는 하지 않는다. QA는 승인된 시나리오 내 데이터 생성·수정·취소를 할 수 있지만 전체 초기화는 금지한다. 디자이너는 승인 디자인과 시각 일치를 보고, 기능 브라우저 검증은 QA가 맡는다. 브라우저 컨텍스트·포트·데이터를 분리하거나 차례로 실행한다.
- QA 계약이 있으면 `c2h_verify_workspace(requestId)`로 독립 제품 복사본을 만들고 `C2H_SUBJECT`를 그 경로로 지정해 고정된 acceptance 테스트를 실행한다. 브라우저 기준은 이 복사본에서 별도 서버·포트를 준비해 실제 브라우저로 실행한다. 다른 역할의 개발 서버를 검증본으로 대신 쓰거나 끄지 않는다. 허용된 설치·빌드·서버 실행과 새 산출물은 복사본 안에서만 하며 복사한 원본은 바꾸지 않는다. 도구·환경 부재는 blocked다. 기준마다 `c2h_qa_result(requestId, criterion, outcome, evidence)`로 기록한다. 증거는 `records/` 아래 Markdown이며 URL·동결 버전·화면 크기·행동·기대/실제·명령/출력·요청/스크린샷 위치를 남긴다. 실행형 테스트 통과·executor 로그를 실제 브라우저 PASS로 대체하지 않는다. 런타임은 기준·동결 복사본·결과·증거 파일의 상관관계와 불변성만 확인한다. Markdown이나 스크린샷 자체로 실제 브라우저 실행·내용의 진실성을 증명할 수는 없으며, 스크린샷을 별도 필수 인증 게이트로 만들지 않는다. 복사본은 sandbox가 아니고 `.env`가 포함될 수 있으니 비밀을 출력하지 않는다.
- 보고서를 `records/`에 저장하고 `c2h_quality_next(requestId, report)`로 제출한다. 요청은 미리 ack하지 않는다.
- 환경 부재로 blocked를 보고했다면 그 결과를 덮지 않는다. 사용자와 환경을 복구한 뒤 executor가 `checkpoint STORY blocked --note '환경 원인'` → `checkpoint STORY implementation_done --approved --note '복구 확인·재검증'` → `quality STORY`로 새로 요청한다.

## 구조 개선 검토

선택한 refactor가 살아 있으면 첫 `quality STORY`에 함께 요청한다. 같은 소스 동결·요청 상관관계·보고서 불변 규칙을 지킨다. 보고서 수신까지는 동결을 유지하지만 사용자의 읽기·대화·승인을 기다리느라 스토리 완료를 막지 않는다.

1. 사용자 소유 `.harness/refactor-prompt.md`가 있으면 각 요청·재개 때 다시 읽어 관점으로 사용한다. `--refactor-prompt FILE`로 시작 시 지정할 수 있고 설치 갱신은 덮어쓰지 않는다. 관점 프롬프트는 수정 승인이나 안전 규칙 변경이 아니다.
2. 변경 파일·직접 연결된 호출 경로를 읽고 이해·변경·테스트 비용이 큰 부분만 제안한다. 검토 범위·근거를 밝히고 제안마다 **문제 한 줄 → Before/After → 효과·위험·검증 방법** 순서로 쓴다. F ID·파일:줄·현재 비용·최소 대안·그대로 유지할 이유도 보존한다. Before는 현재 코드 핵심 발췌(생략은 `// …`), After는 **변경 방향 예시·미적용·미검증**으로 명시한다. 코드 이동·모듈 분리는 짧은 호출 구조 비교로 대신할 수 있다. 파일 전체 복제·별도 에이전트용 보고서는 만들지 않는다. 개수 채우기·원칙 이름만의 지적·불필요한 계층 추가는 하지 않는다. 개선할 것이 없으면 없다고 쓴다. 실제 결함 의심은 자문과 구분해 알린다.
3. `records/refactor-N.md`에 쓰고 `c2h_quality_next(requestId, report)`로 제출한다. 소스·생성물 수정·설치·빌드·서버 실행은 하지 않는다. executor 자동 수정에 제안을 섞지 않는다.
4. 런타임이 자문을 `.harness/refactor/advice/REQUEST_ID.md`에 복사한다. `refactor-status`로 볼 수 있고 완료 정리·새 스토리가 지우지 않는다. 적용할 때 현재 코드에서 다시 확인한다. 사용자가 폐기하면 `refactor-close ID --approved`로 독립 사본만 지운다.

## 독립 리팩터링

완료 후 사용자와 refactor가 작은 구조 수정을 논의하는 별도 경로다. 스토리 번호·planner 경유·스토리 목록·기존 result.md 변경·영구 작업 이력을 만들지 않는다. 진행 중 `.harness/refactor/`의 상태만 유지하고 완료·사용자 폐기 뒤 정리한다. 원본 CLI 대화·제품 코드·Git diff는 지우지 않는다. 새 기능·제품 동작·외부 계약 변경으로 커지면 정식 계획으로 돌린다.

1. **논의**: refactor는 현재 코드와 필요하면 독립 보관 자문을 읽는다. 완료 스토리에서 삭제된 story.md를 요구하지 않는다. `.harness/refactor/draft.md`에 핵심 Before/After(제안 예시)·바꿀 것·유지할 동작·제외 범위·검증 방법(수정 전후에 같이 돌릴 테스트·빌드 명령)을 적는다. 이전 스토리 구현·검토·완료 정리가 끝나지 않았으면 수정 인계는 기다린다. 다음 스토리가 아직 계획 중(미승인)이면 바로 논의·승인할 수 있다.
2. **정확한 수정안 승인**: `c2h_refactor_next(proposal=".harness/refactor/draft.md")`를 호출한다. 현재 코드·수정안·관점 기준을 고정한 실제 선택창에서 **executor에게 넘기기** / **계속 논의**를 고른다. 취소·대화는 승인이 아니다. 재개 시에는 `c2h_refactor_next(taskId=ID)`로 같은 수정안을 선택한다. 수정안·소스·관점이 바뀌면 새 수정안을 저장하고 다시 승인받는다. 리뷰가 필수이므로 넘기려면 executor와 reviewer가 모두 살아 있어야 한다. '계속 논의'로 남은 수정안도 스토리 인계를 막는다(계획은 계속 가능). 접으려면 `refactor-close ID --approved`.
3. **착수**: executor는 listener의 `refactor_request` 알림 또는 사용자 재개 요청 뒤 `resume executor`로 `task.id`를 확인한다. `.harness/refactor/ID/proposal.md`를 읽고 `refactor-start ID`를 호출한 뒤에만 소스를 수정한다. 승인 뒤 소스·관점 drift는 착수하지 않는다. 이 요청은 별도 inbox ack를 하지 않는다. 실행 중 재개는 같은 ID·합의 범위를 유지한다. resume에 `source_changed`가 있으면 이전 세션이 이미 수정한 것이다: 되돌리거나 처음부터 다시 하지 않고 남은 수정·수정 후 검증·`refactor-finish`만 한다. 수정 전 검증 기록이 없으면 작업 트리를 되돌려 만들지 말고 기록 없음과 이유를 적는다.
4. **반영·검증**: 소스 수정 전에 수정안의 검증 방법을 실행하고, executor만 합의한 구조 수정을 한 뒤 같은 검증을 다시 실행한다. `.harness/refactor/ID/implementation.md`에 바꾼 것과 `## 수정 전 검증`·`## 수정 후 검증`(명령·결과·미실행 사유)을 적는다. 수정 전부터 실패하던 것은 그렇다고 적고, 수정으로 생긴 실패·미해결을 완료로 처리하지 않는다. `refactor-finish ID --summary PATH`로 마치면 소스가 고정되고 reviewer에게 리뷰가 자동 요청된다(두 절이 없으면 거부).
5. **리뷰 (필수)**: reviewer는 `refactor_review`를 받아 proposal·implementation.md와 `refactor-changes ID`(승인 이후 바뀐 경로)로 실제 코드를 읽는다. 동작 변경·수정안 범위 이탈·실제 결함·검증 누락만 R ID·파일:줄·실패 조건·근거가 된 수정안 줄과 함께 지적하고, 추가 구조 개선·취향은 '제안'으로 분리한다(반영 대상 아님). `.harness/refactor/ID/review-N.md`에 새로 쓰고 `c2h_refactor_review(taskId, review)`로 보낸다(초안 하나만 바뀌었으면 턴 종료 시 자동 전달). 소스는 바꾸지 않는다.
6. **반영·재리뷰 (한 번)**: executor는 `refactor_decision`에서 리뷰를 짧게 브리핑하고 지적마다 수정안과 대조한다. 동작 변경·결함·범위 이탈·검증 누락만 반영 대상이다. 반영할 것이 없으면 `refactor-done ID`로 끝낸다. 있으면 소스 수정 전에 `refactor-fix ID --note '반영: R1 (근거)'` → 지적만 수정 → 같은 검증 → implementation.md의 `## 수정 후 검증`과 `## 리뷰와 반영`(지적 ID → 반영 여부 → 근거) 갱신 → `refactor-finish ID --summary PATH`. reviewer는 `refactor-changes ID --since review`로 바뀐 부분만 다시 본다. 재리뷰는 한 번뿐이다(`reviews_left: 0`).
7. **한도 도달**: 재리뷰 뒤에도 반영할 지적이 남으면 executor가 실제 선택 UI로 **그대로 종료** / **종료 후 새 수정안으로 논의**를 묻는다. 어느 쪽이든 `refactor-done ID`로 마치고, 후자면 남은 지적을 refactor pane에 새 수정안으로 가져가도록 안내한다. 무한 재리뷰·추가 개선 발굴을 하지 않는다.
8. **폐기·복구**: `refactor-status`, `resume executor/reviewer/refactor`, `diagnose`로 확인한다. 미승인·착수 전·리뷰 중인 요청은 사용자 선택 뒤 `refactor-close ID --approved`로 폐기할 수 있다. executor가 수정 중(`executing`·`fixing`)이면 먼저 수정·검증을 마친다. 리뷰 대기·리뷰 후 소스가 검증본과 다르면 리뷰·종료가 거부된다. 승인 파일·보고서 유실·drift면 추측 복원하지 않는다. 진행 중 요청을 지워 우회하거나 옛 스토리 checkpoint로 복구하지 않는다.

## 완료 정리

완료 결과에는 **이 스토리에서 무슨 작업을 했는지**만 남긴다. 역할별·단계별 진행, 리뷰 지적, 검증 로그는 남기지 않는다.

1. done 저장과 함께 planning_request가 planner에 간다. 확장이 idle pane에 새 작업 경계로 전달한다.
2. planner는 story.md·implementation.md를 읽고 `records/result-draft.md`를 쓴다(4000자 이하).

   ```markdown
   # S001 — 사용자가 얻은 결과 한 줄 (완료 화면 제목)

   ## 한 일
   - 사용자 관점 결과 몇 줄

   ## 바뀐 파일
   - (선택) 주요 경로
   ```

3. 저장하면 확장이 `result.md`를 확정하고(직접 호출은 `c2h_story_next(story, summary)`) 스토리 폴더의 나머지 파일·관련 메시지·검증 기준을 지운다. index.md 링크는 `SNNN/result.md`로 바뀐다. 그 스토리에 남은 미처리 일반 메시지(`send`로 보낸 알림)는 함께 닫히고 결과의 `closed`에 남는다. 처리할 요청(리뷰·구현·`c2h_*` 요청)이 남아 있으면 정리가 거부된다.
4. planner는 사용자에게 result.md 경로와 한 일을 알리고 **다음 스토리 요청을 기다린다**. 다음 스토리를 먼저 계획하지 않는다. 사용자가 요청하면 계획하고, 다음 스토리의 planning checkpoint를 저장한 **뒤** 완료 planning_request를 ack한다.
5. `resume`에 `compaction_pending`이 있으면 확정 후 정리가 중단된 것이다. `compact-story STORY --summary .harness/stories/STORY/records/result-draft.md --approved`로 정리만 재시도한다. 지워진 원본은 복구하지 않는다.

## 복구

- 확인: `status`, `resume ROLE`, `inbox ROLE`, `diagnose`(경로별 drift·복구 안내). 저장 성공은 상대 역할의 실행 성공이 아니다.
- envelope 누락·상관관계 불일치·소스 drift·문서 충돌은 fail closed다. 파일·승인을 추측해 만들지 않는다.
- 열린 리뷰 취소는 사용자 확인 후 `cancel-review REQUEST_ID --approved --note '이유'`. 늦은 회신은 거절된다.
- 종합 회신 저장 전에 중단됐으면 `quality-status REQUEST_ID`의 recovery 안내를 따른다. checkpoint 충돌은 우회하지 않고 원인을 먼저 조사한다.
- 쓰던 프로세스가 강제 종료돼 남은 protocol lock은 resume·diagnose가 stale로 알린다. 그때만 사용자 확인 후 `unlock --approved`로 지운다. 살아 있는 writer의 lock은 거절되며 `busy`는 기다린다.
- 승인된 story.md·design.md·preview·QA 계약/테스트가 바뀌어 모든 역할이 막히면 사용자 확인 후 `restore-approved STORY --approved`로 승인본을 되돌린다. 승인본 기록이 없는 이전 승인은 손으로 되돌리거나 새 스토리로 계획한다. 실제 범위 변경은 새 스토리다.
- `changes STORY [--since approval|review]`: 구현 승인 이후 또는 직전 리뷰 이후 추가·삭제·변경된 경로(읽기 전용, diff 아님).
- `board [--watch]`는 읽기 전용 상태판이다. 승인·재시작을 하지 않는다.
- 소스 동결 기준은 파일 경로·권한·내용·링크 대상의 해시다. 백업이나 diff가 아니다. 새 기준(files-v3)은 Git이 새 저장소에 추가할 파일만 본다: 프로젝트의 `.gitignore`는 따르고 전역·info/exclude 규칙은 쓰지 않으며 `.harness/`·`.claude/`·`.pi/`·`.git`·`node_modules`·AGENTS.md·CLAUDE.md는 제외한다. Git이 없으면 `.gitignore`를 해석하지 않는 files-v2를 쓴다. 이미 기록된 기준은 원래 형식으로 비교한다.
- **유지보수 갱신**: 역할 작업을 멈춘 뒤 설치기를 쓴다. 검증된 수정본이 외부 의존성으로 blocked이고 메시지·리뷰가 모두 처리됐을 때만 `--install-only --maintenance`로 갱신할 수 있다. 승인·checkpoint·검증 기준은 바꾸지 않고 `records/maintenance.json`에 기록한다. `.harness`·`.claude/`·`.pi/`·AGENTS.md·CLAUDE.md만 바뀌면 소스 검증 기준은 유지된다.
- 오프라인 테스트는 실제 CLI 권한·알림·모델 준수의 증명이 아니다.
