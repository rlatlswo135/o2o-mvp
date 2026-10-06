# Node 협업 흐름

planner=Pi, reviewer=Pi, executor=Claude Code. 프로젝트 루트에서 실행한다.
런타임은 `node .harness/bin/c2h.mjs`만 사용한다. 모델·thinking·effort는 사용자가 관리한다.
setup은 역할이 로드된 CLI를 열지만 제품 작업을 승인하지 않는다. 한 번에 활성 스토리 하나만 처리한다.
Git·package.json·pnpm-lock.yaml은 하네스 필수 조건이 아니다. 없다는 이유로 Git 초기화·패키지 설치를 하지 않는다.
새 리뷰는 파일 경로·권한·내용·링크 대상을 해시로 고정하며 링크는 따라가지 않는다.
루트 `.harness/`, 각 경로의 `.git`, `node_modules` 디렉터리·링크는 제외한다. `.gitignore`는 해석하지 않아 나머지 생성물도 검사한다.
리뷰 중 생성물도 변경하지 않는다. 해시는 이전 코드의 백업이나 diff가 아니다. 구버전 Git 리뷰만 원래 Git 기준으로 검증한다.

## 명령과 승인

| 입력창 | 명령 | 행동 |
| --- | --- | --- |
| Pi planner | `/plan [요구사항]` | 계획 후 handoff / refine / discuss |
| Claude executor | `/executor` | 상태부터 복원. 승인된 인계는 중복 선택 없이 구현 |
| Claude executor | `/harness-review [ID]` | 완료된 구현의 리뷰 인계 |
| Pi reviewer | `/reviewer` | 요청된 리뷰 시작·재개. 수정 후 재리뷰는 executor에서 명시적으로 선택 |
| Pi planner | `/planner` | 같은 작업 세션의 완료 인계 재개. 다음 스토리 계획만 시작 |
| Pi planner/reviewer | `/harness-new [역할]` | 기록을 보존하고 새 세션에서 계획/리뷰 재개 |
| Claude executor | `/clear` → `/executor` | 저장·대기 후 새 컨텍스트에서 승인된 작업 재개 |
| Claude executor | `/accept` | 수정안 다중 선택 후 선택한 항목만 수정 |
| Claude executor | `/feedback` | 항목 선택·논의. 수정 승인 아님 |

`/plan`은 Pi 프롬프트다. `/reviewer`는 `.harness/commands/reviewer.md`를 읽는 Pi 확장 명령이다.
Claude 내장 `/review`는 별개다. 일반 재개 요청은 새 구현·수정·커밋·푸시 승인이 아니다.
취소·빈 응답·타임아웃·자동 계속은 승인 아님. 선택 UI가 없으면 멈추고 설치·신뢰·reload를 확인한다.

## 계획 완료 선택

1. planner는 스토리 범위·제외 범위·완료 조건·선행 조건·남은 결정을 저장한다.
   `node .harness/bin/c2h.mjs checkpoint STORY planning --note '계획 준비'`로 기록하고 Markdown을 맞춘다.
2. 준비된 스토리 ID를 `story` 인수로 **`c2h_plan_next`**에 전달한다.
   UI는 **실행자에게 넘기기 (`handoff`) / 스토리 검토·보강하기 (`refine`) / 이 내용 논의하기 (`discuss`)**를 묻는다.
3. **handoff 선택 자체가 표시된 스토리 revision의 구현 승인**이다. 확장이 준비 상태를 재확인하고
   `node .harness/bin/c2h.mjs handoff STORY --approved`를 실행한다.
   이 명령은 스토리 hash와 승인 기록을 묶은 `implementation_request`를 만든다. planner가 send/handoff를 다시 실행하지 않는다.
   같은 pending 승인은 재사용하며 승인 후 범위 변경은 기존 인계를 해결하기 전 진행하지 않는다.
4. refine은 문서 보강 후 다시 UI, discuss는 대화만 한다. 둘 다 인계하지 않는다.
   승인된 스토리 파일을 임의 수정하지 않는다. 승인 기록과 정확한 revision이 어긋나면 중단한다.

## executor 시작·재개

먼저 `node .harness/bin/c2h.mjs resume executor`와 실제 문서를 대조한다.
`.harness/active.json`과 생성된 checkpoint.md는 현재 phase·승인, story.md는 승인 시 동결한 범위, CURRENT.md는 포인터다.
승인 후 story.md는 수정하지 않는다. 상태·증거·게이트 결과는 implementation.md·review-brief.md에 기록한다. 충돌하면 멈춘다.

- `implement`: 승인된 인계 또는 진행 중 범위만 구현한다. planner 승인 인계에 두 번째 선택을 요구하지 않는다.
- `select_story`: 준비된 미승인 스토리의 이름·범위·완료 조건을 AskUserQuestion 단일 선택으로 제시한다.
  선택이 구현 승인임을 밝히고, 선택 후 상태·revision을 재검증한다. 승인 근거를 저장한 뒤
  `node .harness/bin/c2h.mjs checkpoint STORY implementing --approved --note '선택한 범위 승인'`을 실행한다.
- `implementation_choices`: 첫 구현 완료. 재구현하지 않고 아래 실행 완료 선택으로 간다.
- `completion_choices`: 리뷰 반영 이후다. 아래 **사용자 완료 선택** 3개를 연다.
- `wait`, `review`, `review_choices`: 소스 수정 없이 대기·해당 역할 안내만 한다.
- `brief`: 결과 검증·브리핑·ack 후 resume을 다시 확인한다. 첫 리뷰는 `review_decision`, 재리뷰는 `completion_choices`로 분기한다.
- `review_decision`: 첫 리뷰다. 아래 **결과 브리핑 후 선택** UI를 연다. 개별 수정안 승인 전 소스 수정 금지.
- `plan_next`: planner만 완료 인계를 검증하고 아래 **완료 → 다음 계획**을 수행한다. 구현 승인은 아님.
- `blocked`, `done`: 원인·기록만 안내한다. executor가 다음 스토리를 임의 구현하지 않는다.

Claude는 **시작 시 resume 확인 후**, 살아 있는 작업이 없으면
`node .harness/bin/c2h.mjs listen executor --timeout 0`을 **네이티브 Bash `run_in_background: true`로 하나만** 연다.
셸 `&`, tmux send-keys, 추가 에이전트·모델 API, 반복 모델 폴링은 쓰지 않는다.
완료 알림은 TaskOutput/Read로 읽고 resume으로 재검증한다. `implementation_request`는 승인·revision을 확인해
수락 기록 후 해당 메시지만 ack한다. 이전 스토리 대화가 남아 있으면 ack·구현 전에 사용자에게 `/clear` → `/executor`를 안내하고 기다린다. `review_result`는 같은 스토리에서 브리핑 저장 후 ack한다.
`node .harness/bin/c2h.mjs ack executor MESSAGE_ID` 후 기존 waiter 종료를 확인하고 하나를 다시 연다.
세션 재시작 시 이전 background job 생존을 가정하지 말고 resume 후 새 waiter를 만든다.
권한 거부·잘못된 메시지는 숨기거나 무한 재시도하지 않는다.

## 실행 완료 선택

executor는 필요한 테스트·빌드·브라우저 검증을 수행하고 implementation.md에 변경 파일·고정 기준·
완료 조건별 명령/실제 결과·미실행 항목을 기록한다. `implementation_done` checkpoint와 Markdown을 맞춘다.
첫 구현의 `implementation_choices`일 때만 Claude **AskUserQuestion**, `multiSelect: false`로 다음을 묻는다.
리뷰 반영 후 `completion_choices`는 아래 **사용자 완료 선택**으로 간다. `/accept` 수정 후 이 메뉴를 반복하지 않는다.

- **리뷰어에게 넘기기 (`review`)**: `.claude/skills/harness-review/SKILL.md`를 읽고 같은 세션에서 인계한다.
  명령 재입력 요구 없음. `node .harness/bin/c2h.mjs review STORY`의 JSON에서 요청 ID를 보존한다.
  기존 pending 요청은 재사용하고, 성공 여부 불명이면 status/resume으로 확인한다. 소스를 동결한다.
- **보강하기 (`refine`)**: 내용을 확인하고 기존 승인 범위만 보강·검증 후 다시 선택한다.
  원래 구현이면 `checkpoint STORY implementing --note '승인 범위 보강'`, 승인된 수정안의 보강이면
  `checkpoint STORY fixing --note '기존 승인된 지적 ID와 보강 범위'`부터 기록한다. 새 승인을 임의 추가하지 않는다.
  미선택 리뷰 수정안·범위 확대·새 의존성을 자동 승인하지 않는다.
- **이 내용 논의하기 (`discuss`)**: 대화만 한다. 소스 수정·리뷰 요청 없음.

직접 `/harness-review`도 명시적 리뷰 인계다. 별도 wait를 중복 띄우지 않고 기존 executor listener를 유지한다.

## 리뷰 초안 → 선택 → 회신

Pi 확장은 세션 유휴·대기 입력 없음·작성 중 입력 없음일 때 durable 요청을 전달한다.
명시적 `/reviewer`는 알림 없이도 현재 작업을 시작·재개한다. resume reviewer를 확인하고 pending 요청을 재사용한다.
첫 구현이 완료됐고 resume이 `review`이면 `node .harness/bin/c2h.mjs review STORY`로 요청을 만든다.
리뷰 반영 후에는 executor의 사용자 완료 선택에서 **추가 리뷰 요청**을 고를 때만 재리뷰한다. reviewer가 먼저 요청을 만들지 않는다.
구현이 없거나 envelope가 유실된 복구 상태면 멈춘다. 유실을 신규 요청으로 덮지 않는다.

1. reviewer는 요청·승인 범위·implementation.md·변경 파일을 읽고 위험에 필요한 직접 호출부·타입·테스트만 확인한다.
   Git diff는 있을 때만 참고한다. Git이 없으면 변경 설명·실제 코드를 대조하고 비교 근거가 없으면 검토 한계를 기록한다.
2. 필요하면 **작고 대상이 명확한 비변경 unit/repro 확인**만 허용한다. 소스·기준·생성물을 바꾸지 않는다.
   E2E·브라우저·개발 서버·전체 suite·종합 QA는 금지한다. 넓은 검증은 executor에게 요청한다.
3. `review-N.md` 초안에 요청 ID·기준·검토 범위·지적 ID·심각도·파일:라인·실패 조건·최소 수정안·불확실성을 쓴다.
   실행자 증거 인용과 직접 확인을 구분한다. 새 QA 보고서는 요구하지 않는다.
4. 초안 저장 후 `node .harness/bin/c2h.mjs checkpoint STORY review_ready --note '리뷰 초안 저장'`을 실행하고 문서를 맞춘다.
5. **`c2h_review_next`에 `requestId`와 보고서 경로를 전달**한다.
   UI는 **실행자에게 보내기 (`send`) / 이 내용 논의하기 (`discuss`)**를 묻는다.
   **send 선택 때만** 확장이 `node .harness/bin/c2h.mjs reply REQUEST_ID --review PATH`를 실행한다.
   discuss는 미전송 초안 수정·논의 후 다시 선택한다. 취소하면 초안·review_ready를 유지한다.
6. 지적이 없어도 자동 reply 금지. sent 보고서는 불변이며 후속 판단은 별도 기록한다.
   review_request를 미리 ack하지 않는다. reply가 회신 저장 후 요청을 보관한다.

## 결과 브리핑 후 선택

executor는 `node .harness/bin/c2h.mjs wait REQUEST_ID --timeout 1`로 상관관계·보고서·소스 기준을 검증한다.
실제 코드와 대조한 **지적 / 확인 / 권고 / 수정안·영향·검증**을 review-brief.md에 저장하고 한 번에 브리핑한다.
수락 기록 후 해당 결과만 ack하고 waiter 하나를 재무장한다. 이미 수락한 결과는 재검증하되 중복 처리하지 않는다.

브리핑·ack 후 resume이 `review_decision`인 첫 리뷰에서만 Claude **AskUserQuestion**, `multiSelect: false`로 다음을 묻는다.
`completion_choices`인 재리뷰는 바로 **사용자 완료 선택**으로 간다. 수동 `/executor` 재개도 같은 분기를 따른다. **리뷰 수신은 수정 승인이 아니다.**

- **수정안 고르기 (`accept`)**: `.claude/skills/accept/SKILL.md`를 읽고 수정안 다중 선택 UI를 연다.
  accept 선택 자체는 수정 승인이 아니다. 이후 사용자가 명시적으로 고른 개별 수정안만 승인한다.
- **지적 사항 논의하기 (`feedback`)**: `.claude/skills/feedback/SKILL.md`를 읽고 논의할 항목 선택·대화를 진행한다.
  논의는 수정 승인이 아니며 소스를 바꾸지 않는다.

선택한 절차를 같은 세션에서 실행한다. 명령 재입력 요구 없음. 직접 `/accept`·`/feedback` 호출도 유지한다.
취소·빈 응답·타임아웃·자동 계속은 선택이 아니다. UI가 없으면 이유를 알리고 중단한다.
이 경우 review_decision을 유지하고 소스 수정·재리뷰·DONE 없이 멈춘다. 선택창을 즉시 반복해서 열지 않는다.

`/accept`는 AskUserQuestion 다중 선택으로 명시적으로 고른 수정안만 승인한다. 긴 목록은 나눠 받고 최종 요약을 확인한다.
선택 직전·직후 요청·revision·수정안을 재검증한다. 바뀌었으면 다시 선택받는다.
승인 근거 저장 후 `node .harness/bin/c2h.mjs checkpoint STORY fixing --approved --note '실제로 선택한 지적 ID·수정 범위·승인 근거 경로'`으로 진행한다.
선택하지 않은 항목은 보류한다. 수정·검증·implementation_done 기록 후 **사용자 완료 선택**으로 간다. `/feedback`은 논의만 한다.

기존 코드리뷰/Fix·실행자 QA/Fix 한도(각 3회, 같은 실패 연속 2회면 blocked), 수동 확인·학습 게이트는 유지한다.
학습은 선택 또는 기존 스토리의 필수 게이트일 때만 수행하며 새 범위로 강제하지 않는다.
모든 게이트와 사용자 완료 확인 전에는 DONE/index 체크를 자동 기록하지 않는다.

## 사용자 완료 선택

리뷰 반영·검증이 끝나면 implementation.md에 수정 내용·검증 결과·미해결 사항·필요한 수동 확인 방법을 기록한다.
`checkpoint STORY implementation_done --note '수정·검증 완료'`는 현재 수정본의 기준을 고정한다. 사용자 선택 전에 기록하며 선택 후 기준을 몰래 갱신하지 않는다.
재리뷰 결과는 검증·브리핑·ack 후 바로 이 메뉴로 온다. 새 지적을 자동 적용하거나 accept / feedback 메뉴를 반복하지 않는다.

Claude **AskUserQuestion**, `multiSelect: false`로 아래 3개를 제시하고 기다린다.

1. **확인 완료 · 스토리 종료**: 현재 수정본을 사용자가 직접 확인했고 만족한다는 최종 승인이다.
   필수 완료 게이트가 미해결이면 이유를 알리고 완료하지 않는다. 확인 내용·남은 항목의 판단을 implementation.md에 먼저 기록한다.
   `node .harness/bin/c2h.mjs checkpoint STORY done --approved --note '사용자 완료 선택·수동 확인·게이트 근거'`를 실행한다.
   재리뷰는 필수가 아니다. 마지막 구현 검증 후 소스가 바뀌었으면 중단하고 재검증·재확인을 받는다. 완료 명령이 planner 인계를 함께 저장한다.
2. **문제 있음 · 논의/수정**: 무엇이 미반영됐거나 새로 발견됐는지 대화한다. 이 선택 자체는 수정 승인이 아니다.
   사용자가 구체적으로 요청한 수정 범위·근거를 기록한 뒤 `checkpoint STORY fixing --approved --note '사용자가 요청한 구체적 수정·근거'`로 승인한다.
   모호하면 먼저 확인한다. 승인된 수정만 수행·검증하고 implementation.md와 implementation_done을 갱신한 뒤 같은 3개 선택으로 돌아온다.
3. **추가 리뷰 요청**: implementation.md에 이전 요청 ID·추가 보강 내용·검증 결과·다시 검토할 질문을 기록한다.
   `.claude/skills/harness-review/SKILL.md`를 같은 세션에서 수행한다. implementation_done이면 `review STORY`,
   재리뷰 회신 후 review_decision이면 `review STORY --again`으로 새 요청을 만든다. 열린 요청은 재사용하고 소스를 동결한다.
   reviewer는 이 보강 기록을 기반으로 검토·회신한다. executor가 검증·브리핑한 뒤 다시 이 3개 선택으로 돌아온다.

취소·빈 응답·타임아웃·자동 계속·UI 없음이면 상태를 유지하고 멈춘다. 완료·수정·재리뷰를 자동 선택하지 않는다.
논의만 하고 수정 요청이 없으면 대화를 이어가거나 사용자가 준비됐을 때 같은 선택으로 돌아온다. 반복 선택창으로 답변을 강요하지 않는다.

## 완료 → 다음 계획

완료 명령은 현재 스토리의 done checkpoint·확인한 소스 기준·planning_request를 같은 쓰기 잠금 안에서 저장한다. 재시도는 같은 인계를 재사용한다.
executor는 완료 전 implementation.md 상단에 '다음 작업용 요약'(결과·경로·계약·남은 제약·완료 근거 링크)을 저장한다. 완료·인계 저장 결과와 `/clear` → `/executor`를 안내하고 대기한다. 다음 구현을 시작하지 않는다.

planner Pi 확장은 유효한 완료 요청을 감지한다. 이전 작업 대화가 있으면 요청을 ack하지 않고 `/harness-new`를 안내한다. 사용자 명령이 새 세션 생성·재검증·재개를 수행하며 `/plan` 재입력은 필요 없다. 빈 새 세션은 자동 수신한다.
planner는 resume의 `plan_next`와 직전 완료 checkpoint·implementation.md의 '다음 작업용 요약'을 검증하고 index.md의 한 줄 완료 표시를 맞춘다. 불명확한 근거만 추가로 읽는다. 승인된 story.md·리뷰·QA 원본은 동결·보존한다.
`.pi/prompts/plan.md`를 읽어 기존 요구·우선순위·의존성에 따라 다음 스토리 계획을 작성한다. 다음 대상이 없거나 불명확하면 사용자에게 묻고 임의 기능을 만들지 않는다.
다음 계획의 planning checkpoint와 인계 수락 기록을 저장한 뒤 해당 planning_request만 ack한다. 착수 전에 ack하지 않는다.
계획이 준비되면 기존 c2h_plan_next의 handoff / refine / discuss 선택을 연다. 다음 구현은 별도 사용자 승인 필요.
같은 작업의 자동 수신이 실패하면 같은 인계의 `/planner`로 재개한다. 이전 작업 컨텍스트가 남아 있으면 `/harness-new`를 사용한다. 새 요청을 만들거나 사용자 pane에 키를 주입하지 않는다.

## 복구·보장 경계

- `node .harness/bin/c2h.mjs status`, `node .harness/bin/c2h.mjs resume ROLE`, `node .harness/bin/c2h.mjs inbox ROLE`로 확인한다.
- 요청/회신 envelope 누락·상관관계 불일치·소스 drift·문서 충돌은 fail closed. 파일·승인을 추측해 재생성하지 않는다.
- 열린 리뷰를 취소할 필요가 있으면 사용자 확인 후 `node .harness/bin/c2h.mjs cancel-review REQUEST_ID --approved --note '취소 이유'`를 실행한다.
  요청·취소 기록은 보관하며 늦은 reply는 거절한다. 소스 drift는 재검증 후 새 리뷰를 받아야 한다.
- reviewer는 `/reviewer`, executor는 `/executor`, planner 완료 인계는 `/planner`로 재개한다. 새 요청 남발·동의 없는 사용자 세션 재시작·relayout 금지. `/harness-new`는 명시적 사용자 전환이다.
- listener 권한/알림이 실패하면 같은 세션에서 수동 resume/inbox, 기존 요청의 wait로 복구한다.
  확장 선택 UI가 없으면 승인 선택을 위조하지 말고 설치·신뢰·reload를 먼저 해결한다.
- CLI 출력은 JSON, 진단은 stderr다. 저장 성공은 상대 모델 실행 성공이 아니다.
  오프라인 테스트는 실제 CLI 권한·알림·모델 준수의 100% 성공 증명이 아니다.
