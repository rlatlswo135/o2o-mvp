# 작업 시작·재개

## 읽기 순서

1. 프로젝트 루트와 대상 경로의 AGENTS.md/CLAUDE.md 등 기존 지침을 읽고 사용자 변경을 보존한다.
2. `.harness/WORKFLOW.md`와 현재 역할 문서를 읽는다. 같은 세션에서 읽었고 변경이 없으면 반복하지 않는다.
   역할 로드가 필요하면 `node .harness/bin/c2h.mjs prompt ROLE`을 사용한다. 다른 역할로 조용히 전환하지 않는다.
3. `node .harness/bin/c2h.mjs resume ROLE`을 실행한다. 결과의 checkpoint·승인·요청이 정본이다.
   현재 story.md·필요한 관련 계약과 FLOW.md의 해당 action 절차만 읽는다. CURRENT.md는 포인터 확인용이다.
   inbox ROLE은 미처리 메시지를 확인할 때, status는 충돌 조사 때 사용한다. 같은 상태를 전체 JSON 세 번으로 반복 로딩하지 않는다.
4. 완료 스토리 상세·과거 대화·전체 index는 기본 읽기에서 제외한다. 다음 후보 선택 때 index, 직전 완료 수락 때 checkpoint와 implementation.md의 '다음 작업용 요약'을 읽는다. 요약이 없거나 증거가 불명확하면 관련 완료 게이트 기록만 추가 확인한다.
5. 대상 없음·파일 누락·역할/승인/phase 충돌이면 멈춘다. 레거시 Markdown fallback은 기존 기록만 읽는다.
   유실된 요청 envelope나 승인을 추측해 재생성하지 않는다. reverification_required이면 이전 검증 기준을 새 소스에 적용하지 않는다.

## resume action별 행동

| action | 다음 행동 |
| --- | --- |
| plan | planner가 계획·미정 사항 정리 후 c2h_plan_next에 story 전달 |
| select_story | executor가 준비된 미승인 범위를 이름으로 보여주고 명시적 단일 선택 받기 |
| implement | 승인된 인계/진행 중 범위만 재개. planner 승인 인계에 중복 선택 없음 |
| implementation_choices | 첫 구현 완료. 재구현하지 않고 AskUserQuestion의 review / refine / discuss |
| completion_choices | 리뷰 반영 이후. 사용자 완료 선택: 확인 완료 · 스토리 종료 / 문제 있음 · 논의/수정 / 추가 리뷰 요청 |
| review | reviewer가 현재 요청 재사용·변경 파일 검토. Git diff는 있을 때만 참고. executor는 소스 수정 금지 |
| review_choices | reviewer가 초안·review_ready 확인 후 c2h_review_next에 requestId·보고서 경로 전달 |
| brief | 검증·브리핑·ack 후 resume 재확인. 첫 리뷰는 결과 브리핑 후 선택, 재리뷰는 사용자 완료 선택 |
| review_decision | 첫 리뷰 결과 브리핑 후 선택: AskUserQuestion의 accept / feedback. 개별 수정안 승인 전 수정 금지 |
| plan_next | planner가 완료 인계·기록을 검증하고 다음 스토리 계획만 작성. 구현은 별도 승인 |
| wait | 현재 요청 대기. 다른 스토리 시작 금지 |
| blocked | 근거와 필요한 사용자 판단 안내 |
| done | 완료 기록·결과 안내. executor는 대기. 다음 계획은 검증된 planner 인계로만 시작 |

## 세션 복구

- Claude는 **resume 확인 후** 네이티브 Bash `run_in_background: true`로
  `node .harness/bin/c2h.mjs listen executor --timeout 0` 하나를 연다.
  살아 있는 waiter는 중복 생성하지 않는다. 새 세션에서는 옛 job 생존을 가정하지 않고 새로 연다.
- 알림 수신 시 실제 출력 읽기 → resume 재검증 → 수락 또는 브리핑 기록 → 해당 메시지 ack → waiter 재무장.
  결과 수신은 수정 승인이 아니다. 권한·알림 실패는 기록하고 수동 `/executor`로 재개한다.
- Pi planner는 검증된 planning_request를 감지한다. 이전 작업 대화가 있으면 `/harness-new`로 새 세션에서 인계를 재개한다. 빈 새 세션은 자동 수신, 같은 작업의 수동 복구는 `/planner`다.
  다음 planning checkpoint·수락 기록 후 ack한다. 다음 대상이 없으면 사용자에게 묻고 구현을 시작하지 않는다.
- Pi `/reviewer`는 `.harness/commands/reviewer.md`를 읽어 요청된 리뷰를 시작·재개한다.
  pending 요청·초안을 재사용한다. 구현이 없으면 멈춘다. send 선택 전에는 회신하지 않는다.
- `node .harness/bin/c2h.mjs wait REQUEST_ID --timeout 1`로 기존 회신을 검증할 수 있다.
  응답 없음은 승인/실패 판정이 아니다. 누락·불일치·소스 drift는 적용하지 않는다.
- 선택 UI가 없으면 Pi 설치·신뢰·`/reload` 또는 Claude 스킬 로드를 확인한다. 임의 선택으로 우회하지 않는다.

## 기록·정지

하네스 작업 문서는 `.harness/` 아래에 둔다. 영향 분석은 현재 planning.md 또는 impact.md이며 외부 스킬의 specs/* 출력을 따르지 않는다.
단계 전이마다 런타임 checkpoint·CURRENT.md와 현재 implementation.md를 맞춘다. index.md에 세부 phase·이력을 복제하지 않는다.
완료 시 '다음 작업용 요약'과 한 줄 완료 인덱스만 갱신하고 원본은 보존한다. Claude는 기록 저장 후 `/clear` → `/executor`, Pi는 `/harness-new`로 다음 작업을 재개한다.
checkpoint.md는 런타임 생성물이며 직접 고치지 않는다. 승인 후 story.md는 상태·체크표시를 포함해 변경하지 않는다.
충돌 시 다음 작업을 중단한다.
완료된 계획·구현·수정·리뷰 초안은 FLOW.md의 선택 루프로 돌아간다.
현재 승인 범위는 매번 다시 승인받지 않되 새 범위·커밋·푸시·권한은 별개다.
수동 테스트·선택/상속된 학습 게이트는 유지한다. 자동 DONE은 없다.
setup 또는 일반 “작업 진행”만으로 미승인 구현을 시작하지 않는다.
