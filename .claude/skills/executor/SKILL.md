---
description: Resume active executor state; select a scope only when implementation is unapproved
disable-model-invocation: true
---
`/executor`는 **상태 우선 재개**다. 호출·인수만으로 새 범위를 승인하지 않는다.
프로젝트 지침과 `.harness/RESUME.md`의 최소 읽기 규칙을 따른다. 완료 스토리 상세는 관련 조사 때만 읽는다.
`node .harness/bin/c2h.mjs prompt executor`의 역할 파일을 읽고
**`node .harness/bin/c2h.mjs resume executor`부터** 실행한다. 실패·충돌이면 멈춘다.
추가 인수는 검색 힌트다: $ARGUMENTS

## 상태별 진행

- `implement`: 승인된 planner implementation_request의 정확한 revision 또는 진행 중 승인 범위만 재개한다.
  이전 스토리 대화가 남아 있으면 ack·구현 전에 `/clear` → `/executor`를 안내하고 대기한다.
  **두 번째 스토리 선택 없음.** 새 세션에서 수락 기록 후 해당 메시지만 `node .harness/bin/c2h.mjs ack executor MESSAGE_ID`로 보관한다.
- `select_story`: index.md와 실제 story.md를 대조해 미정 사항·선행 조건이 해결된 스토리만 후보로 삼는다.
  AskUserQuestion `multiSelect: false`로 기능명·범위·완료 조건을 보여주고
  “선택하면 표시된 범위의 구현을 승인합니다”를 명시한다. 긴 목록의 페이지 이동은 승인 아님.
  취소·빈 응답·타임아웃·자동 계속·UI 없음이면 구현하지 않는다.
  선택 후 현재 활성 작업·범위·revision을 재검증하고 승인 근거를 저장한다.
  `node .harness/bin/c2h.mjs checkpoint STORY implementing --approved --note '선택한 범위 승인'`으로 기록하고 문서를 맞춘다.
- `implementation_choices`: 첫 구현 완료. 다시 구현하지 말고 review / refine / discuss 선택으로 간다.
- `completion_choices`: 리뷰 반영 이후다. FLOW.md의 **사용자 완료 선택** 3개를 연다.
  확인 완료 · 스토리 종료 / 문제 있음 · 논의/수정 / 추가 리뷰 요청. 재리뷰·완료·수정을 자동 선택하지 않는다.
- `wait`, `review`, `review_choices`: 소스 수정 없이 대기·reviewer 재개를 안내한다.
- `brief`: FLOW.md에 따라 검증·브리핑·ack 후 resume을 다시 실행한다. 첫 리뷰는 review_decision, 재리뷰는 completion_choices로 분기한다.
- `review_decision`: 첫 리뷰의 **결과 브리핑 후 선택**(accept / feedback)을 AskUserQuestion으로 연다.
  선택에 따라 해당 스킬을 읽고 같은 세션에서 실행한다. 명령 재입력 요구 없음. 개별 수정안 승인 전 소스 수정 금지.
- `blocked`, `done`: 기록과 필요한 판단만 안내한다. 다른 작업 자동 시작 없음.

## 대기·완료

resume 확인 후 살아 있는 waiter가 없으면 **네이티브 Bash `run_in_background: true`**로
`node .harness/bin/c2h.mjs listen executor --timeout 0` 하나를 연다.
새 세션에서는 옛 job 생존을 가정하지 않고 새로 만든다. 수신 시 resume 재검증 → 수락/브리핑 → ack → 재무장한다.
기존 대기에 별도 background wait를 겹치지 않는다. 실패는 기록하고 수동 resume/inbox로 확인한다.

구현·필요한 QA를 수행하고 implementation.md에 변경·기준·실제 결과·미실행 항목을 기록한다.
`implementation_done` checkpoint와 문서를 맞춘 뒤 resume의 action을 확인한다.
첫 구현은 **AskUserQuestion**으로 **리뷰어에게 넘기기(review) / 보강하기(refine) / 이 내용 논의하기(discuss)**를 제시한다.
리뷰 반영 후에는 위의 **사용자 완료 선택**으로 간다. 완료 전에 implementation.md 상단에 '다음 작업용 요약'(결과·경로·계약·남은 제약·근거 링크)을 저장하고 원본 이력은 보존한다.
사용자 완료 승인 시 done 명령이 planner에 다음 계획 요청을 저장한다. 이후 사용자에게 `/clear` → `/executor`를 안내한다.
review는 `.claude/skills/harness-review/SKILL.md`를 읽어 같은 세션에서 인계한다. 명령 재입력 요구 없음.
refine은 기존 승인 범위만 보강 후 다시 선택, discuss는 대화만 한다. 취소면 인계하지 않는다.
커밋·푸시·새 의존성·범위 확대·자동 DONE은 승인하지 않는다.
