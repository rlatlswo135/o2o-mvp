# 협업 규칙

## 원칙

- Pi planner·Pi reviewer·Claude executor, 독립 세션 세 개. 소스 수정자는 executor 한 명이다.
- 프로젝트 지침·사용자 승인·CLI 권한을 우선한다. 숨은 에이전트·모델 API·tmux 키 주입은 없다.
- Node.js >=22.18, 프로젝트 로컬 `node .harness/bin/c2h.mjs`를 사용한다.
- 모델·thinking·effort는 사용자 관리. 하네스가 옵션을 강제하지 않으며 기존 models.json은 보존하되 무시한다.
- 한 번에 활성 스토리 하나. setup은 역할 준비만 하며 승인된 인계나 명시적 명령 없이 제품 작업을 시작하지 않는다.
- planner는 계획·선택된 학습, reviewer는 리뷰 문서, executor는 구현·검증·수동 테스트 안내를 맡는다.
  각 역할은 인계 전에 증거를 저장한다. CURRENT.md의 표준 진행 요약은 런타임이 갱신한다. 승인된 story.md는 수정하지 않는다.

## 상태와 기록

새 세션은 RESUME.md, 명령·선택·인계는 FLOW.md를 따른다.
`node .harness/bin/c2h.mjs resume ROLE`은 읽기 전용이다.
`.harness/active.json`과 런타임이 생성하는 `stories/STORY/checkpoint.md`는 같은 현재 단계·승인 기록이다.
둘을 직접 편집하지 않는다. 승인 후 story.md 전체는 동결한다. 진행·게이트 결과는 implementation.md와 review-brief.md에 기록한다.
CURRENT.md는 현재 작업 포인터다. planning의 미승인 story.md만 자유롭게 보강할 수 있다.
어느 하나라도 충돌하면 멈춘다. index.md는 요약이며 명시적으로 완료 확인된 DONE만 체크한다.

| checkpoint phase | 허용 행동 |
| --- | --- |
| planning | 계획·미정 결정·승인 선택 |
| implementing | 승인된 범위 구현·executor 검증 |
| implementation_done | 첫 구현: review / refine / discuss. 리뷰 반영 후: 사용자 완료 선택. 재구현 금지 |
| reviewing | 코드 리뷰. 소스 동결 |
| review_ready | 저장된 리뷰 초안 send / discuss. 자동 회신 금지 |
| review_decision | 브리핑 후 첫 리뷰는 accept / feedback, 재리뷰는 사용자 완료 선택. 자동 수정 금지 |
| fixing | 명시적으로 선택한 수정안만 구현·검증 |
| blocked | 원인·필요한 결정 안내 |
| done | 완료 기록·planner 인계. planner는 다음 계획만 작성, 다음 구현은 별도 승인 |

상태 변경은 `node .harness/bin/c2h.mjs checkpoint STORY PHASE --note '근거'`로 기록한다.
런타임은 같은 쓰기 잠금 안에서 CURRENT.md의 표준 스토리 ID·문서 경로와 상단 요약의 다음 담당 역할·이번 작업 초점(스토리/phase)·다음 행동을 맞춘다.
이 세 요약 필드는 자동 관리한다. 별도 사용자 지침은 `## 사용자 지침` 등 하위 섹션에 적으며 그대로 보존한다. 증거는 implementation.md·review-brief.md에 기록한다.
다른 작업으로 넘어가기 전에 현재 작업을 완료한다. 쓰기 중 `resume`의 busy/wait는 잠깐 대기하라는 뜻이다.
소스 변경 전이에 필요한 `--approved`는 실제 승인 기록이 있을 때만 쓴다. 열린 리뷰를 강제로 덮지 않는다.
최종 완료도 `checkpoint STORY done --approved --note '사용자 최종 확인과 게이트 증거'`로 명시적으로 기록한다.
기존 DRAFT/AWAITING_APPROVAL, IMPLEMENTING/QA, REVIEW, REVIEW_DECISION, FIX 등의 Markdown은 보존하며
실제 의미를 대조한다. MANUAL_TEST·LEARNING은 스토리 게이트로 유지하고 새 phase로 추측하지 않는다.

## 기록 보존과 읽기 범위

- 상태 정본은 active.json/checkpoint.md. CURRENT.md는 런타임 포인터, index.md는 스토리당 한 줄의 이름·링크·완료 여부·의존성 목록이다. 활성 스토리의 세부 phase·승인을 index에 복제하지 않는다.
- 완료 story.md·checkpoint·리뷰·QA 원본은 보존한다. 기본 읽기에서 제외하며 관련 결함·계약 변경·승인 근거 조사 때만 필요한 기록을 연다. 요약을 이유로 원본을 덮어쓰거나 옮기지 않는다.
- executor는 완료 인계 전에 implementation.md 상단에 **다음 작업용 요약**을 약 10~20줄로 갱신한다: 제공 결과·사용 경로·유지할 계약·미해결/미검증 제약·완료 근거 링크. 테스트 로그·인계 ID·수정 과정을 반복하지 않는다. 요약은 승인이나 QA 증거를 대체하지 않는다.
- 공통 UI 같은 작업 묶음은 기존 구조/계약 문서에 현재 사용 가능한 결과만 통합한다. 각 완료 스토리에 같은 요약을 중복 생성하지 않는다. 미해결 제약은 링크만 남겨 숨기지 말고 요약에도 명시한다.
- 하네스 작업 산출물은 `.harness/` 아래에 둔다. 짧은 영향 분석은 `stories/STORY/planning.md`, 긴 분석은 같은 폴더의 `impact.md`. 외부 스킬의 분석 방법만 활용하고 `specs/*`, 공용 `*_LATEST.md` 출력 경로·별도 lifecycle은 가져오지 않는다. 사용자가 별도 프로젝트 문서를 요청한 경우는 예외다.
- 새 세션은 지침·현재 역할·resume·현재 승인 범위·관련 계약부터 읽는다. 전체 stories 재귀 읽기·과거 세션 대화 재로딩은 하지 않는다. FLOW는 현재 action의 절차를, index는 다음 후보를 고를 때만 읽는다.

## 스토리 경계 세션 전환

- 저장된 완료 인계 다음에는 새 세션을 사용한다. 같은 스토리의 리뷰·수정 중에는 유지할 수 있다. `/compact`는 요약 유지이므로 새 세션을 대체하지 않는다.
- Pi: 기존 작업 대화가 있으면 확장이 인계를 보존하고 `/harness-new`를 안내한다. 역할 pane에서 이 명령이 새 세션 생성·런타임 재검증·계획/리뷰 재개를 묶는다. 역할 환경이 없으면 `/harness-new planner` 또는 `/harness-new reviewer`. 취소 시 기존 세션·요청 유지.
- Pi 세션 교체 API는 사용자 명령에서만 안전하다. listener에서 강제 교체하거나 tmux 키를 주입하지 않는다. 빈 `/new` 세션은 유효한 요청을 자동 수신할 수 있다.
- Claude: 완료 기록·인계 저장 후 사용자에게 `/clear` → `/executor`를 안내한다. 다른 스토리 인계를 기존 대화에서 받으면 ack·구현 전에 전환한다. 새 세션에서 정확한 승인 인계만 재개하며 승인을 다시 요구하지 않는다. 이전 waiter 종료 여부를 확인하고 하나만 재무장한다.
- 실행 중·미저장 입력·queued 메시지를 버리지 않는다. 전환 자체는 새 구현·승인·DONE이 아니다. blocked는 새 스토리 경계가 아니며 원인을 먼저 해결한다.

## 승인과 검증

1. planner 완료의 `c2h_plan_next(story)` handoff 선택이 정확한 revision의 구현 승인이다.
   확장이 Node handoff를 실행한다. executor는 재선택 없이 그 범위만 시작한다.
   미승인 새 작업은 `/executor`에서 이름·범위를 명시한 선택이 필요하다.
2. executor는 implementation.md에 변경·기준·완료 조건별 명령/결과·미실행 항목을 기록한다.
   필요한 테스트·빌드·브라우저·E2E는 executor 책임이다. 미실행을 PASS로 쓰지 않는다.
3. 첫 구현 완료는 AskUserQuestion의 review / refine / discuss. 리뷰 반영 후는 사용자 완료 선택(종료 / 논의·수정 / 추가 리뷰 요청).
   추가 리뷰를 선택한 경우에만 요청하고 소스를 동결한다. 재리뷰 없는 사용자 완료 승인을 허용한다.
4. reviewer는 변경 파일·관련 코드 중심으로 검토한다. Git diff는 있을 때만 참고한다.
   Git이 없으면 변경 설명·실제 코드를 대조하고 비교 근거가 없으면 한계를 기록한다. 필요시 작은 비변경 unit/repro만 허용한다.
   브라우저·E2E·개발 서버·전체 suite·종합 QA 금지. 초안 저장 → review_ready → send / discuss.
5. 첫 리뷰 결과는 검증·브리핑 후 FLOW.md의 **결과 브리핑 후 선택**(accept / feedback)을 연다.
   accept는 개별 수정안 선택창을 열 뿐 수정 승인이 아니다. 고른 항목만 fixing으로 진행한다.
   수정 완료·재리뷰 수신 후는 **사용자 완료 선택** 3개를 연다. 논의 중 사용자가 구체적으로 요청한 수정만 새 승인으로 기록한다.
   feedback·취소·무응답·자동 계속·명령 호출만으로 수정하지 않는다.
6. 기존 반복 한도는 코드리뷰/Fix·executor QA/Fix 각각 최대 3회, 동일 실패 연속 2회면 blocked.
   사용자에게 판단·모델 변경 필요성을 알리되 직접 모델을 바꾸지 않는다.
7. 필요한 수동 테스트는 executor가 안내하고 사용자 결과를 기록한다. 불필요하면 이유를 쓴다.
   학습은 사용자가 선택했거나 기존 스토리에 필수일 때만 planner에게 인계한다.
   deep-guide.md·eli5.md·quiz.md 등 기존 필수 게이트를 지우거나 모든 새 스토리에 강제하지 않는다.
8. 자동 DONE 금지. 사용자 완료 선택의 최종 확인·필수 게이트를 기록한 뒤 done으로 전이한다.
   마지막 구현 검증 이후 소스 변경은 완료를 막는다. 과거 리뷰를 새 수정본의 재리뷰 증거로 위장하지 않는다.
   done과 함께 planning_request를 저장한다. planner는 완료 기록·index 요약 확인 후 다음 계획만 시작하며 구현은 별도 승인이다.

커밋·푸시·범위 확대·계획 밖 의존성·파괴적 작업은 별도 승인이다. 사용자 담당 영역을 대신하지 않는다.

## 유지보수 갱신

역할 작업을 멈춘 뒤 설치기를 사용한다. 검증된 수정본이 사용자 BE 등 외부 의존성으로 blocked이고 모든 메시지·리뷰가 처리됐을 때만 `--install-only --maintenance`로 명시적 갱신할 수 있다.
설치기는 잠금·승인·보고서 무결성·빈 inbox·마지막 검증 기준 일치를 확인한다. 활성 승인·checkpoint·verified_baseline은 바꾸지 않고 스토리의 maintenance.json에 갱신을 기록한다.
갱신은 blocked 복구나 범위 확대 승인이 아니다. 재검증 여부는 receipt가 아니라 현재 소스와 verified_baseline 비교로 판단한다. 제외 대상인 .harness 문서만 바뀌면 기존 소스 검증 기준은 유지된다. `resume`의 `reverification_required: true`이면 새 기준으로 검증·사용자 확인하기 전 완료할 수 없다. 과거 리뷰를 새 소스의 검증으로 재사용하지 않는다.

## 메시지와 복구

- typed implementation_request에는 승인·스토리 revision, review_result에는 요청 상관관계가 필요하다.
  일반 메시지나 옛 기록으로 승인/envelope를 만들어내지 않는다.
- 수신 시 resume과 실제 문서로 재검증한다. 수락/브리핑 기록 후 해당 메시지만 ack한다.
  review_request는 미리 ack하지 않고 명시적 send 선택의 reply가 보관한다.
- Claude 시작 시 resume 확인 후 네이티브 background Bash로 `node .harness/bin/c2h.mjs listen executor --timeout 0` 하나만 연다.
  처리·ack 후 재무장, 재시작 후 새 waiter를 만든다. 이전 job 생존을 가정하지 않는다.
- Pi reviewer와 planner는 유휴이며 입력이 없을 때 각각 검증된 리뷰 요청·완료 인계를 감지한다. 새 세션 경계는 위 규칙을 따른다.
  `/reviewer`는 요청된 리뷰, `/planner`는 완료 인계를 재개한다. 일반 메시지나 setup만으로 다음 계획을 시작하지 않는다.
- 누락된 envelope·소스 drift·문서 불일치는 blocked. 수동 status/resume/inbox로 확인하고 임의 복원하지 않는다.
- 같은 OS 계정의 신뢰된 세션용이며 역할 이름은 인증·보안 경계가 아니다. 메시지에 비밀을 넣지 않는다.
