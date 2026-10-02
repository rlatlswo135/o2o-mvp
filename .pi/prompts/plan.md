---
description: Plan one story and prepare an executor handoff
---
프로젝트의 기존 지침, `.harness/WORKFLOW.md`, `.harness/FLOW.md`, `.harness/CURRENT.md`를 실제로 읽는다.
`c2h prompt planner`를 실행하고 지정된 역할 파일을 읽어 현재 세션에 적용한다. 실패하면 중단한다.

사용자 요청: $ARGUMENTS

- 현재 프로젝트에서 할 일을 논의하고 사용자 가치 기준으로 계획한다. 기존 계획이 있으면 이어간다.
- `.harness/stories/index.md`에 스토리를 완료 체크리스트로 표시한다. 각 행은 기능명·스토리 문서 링크·상태·착수 가능 여부/대기 이유를 포함한다.
  예: `- [ ] [고객 등록](S001/story.md) — AWAITING_APPROVAL · 착수 가능`
  실제 스토리의 완료 게이트를 모두 충족한 DONE만 `[x]`로 표시한다. 구현 완료·리뷰 대기는 `[ ]`와 상세 상태로 구분한다.
- 범위·제외 범위·완료 조건·남은 결정을 `.harness/stories/<ID>/story.md`에 기록한다.
  한 번에 실행할 스토리는 하나이며 executor의 선택 UI에서 정한다. 상세 API나 불필요한 구성 작업을 추측해 추가하지 않는다.
- 계획이 준비되면 AWAITING_APPROVAL, 담당 planner로 기록한다. CURRENT.md를 같은 스토리에 맞춘다.
- 실행자에게 넘길 준비가 됐다는 인계 근거와 다음 담당 executor를 스토리의 구현 인계 구역에 남긴다.
  CURRENT.md의 현재 담당은 승인 전까지 planner다. 계획 완성이 구현 승인은 아니다.
- 사용자에게 확정된 스토리·범위와 미결정 사항을 짧게 보고한 뒤 반드시 `c2h_plan_next` 도구로 완료 선택 UI를 연다.
  `.harness/FLOW.md`의 **계획 완료 선택** 절차를 따른다. 도구/UI가 없으면 `/reload`와 확장 신뢰·설치를 안내하고 중단한다.
  취소·빈 응답·타임아웃은 승인 아님. 스토리 문서가 상태의 정본이며 index 체크리스트는 요약이다.
- `handoff` 선택 시 준비 상태를 다시 확인하고 문서를 저장한 뒤
  `c2h send --from planner --to executor --story <ID> --message '스토리 문서 경로·범위·인계 준비 근거. /executor에서 선택 후 구현'`을 실행한다.
  메시지 ID를 스토리에 기록하고 **executor pane → `/executor` → 스토리 선택**을 안내한다.
  같은 미처리 인계가 있으면 재전송하지 않는다. 저장 성공은 상대 CLI 시작이 아니다. 전달 자체는 구현 승인이 아니다.
- `refine`은 스토리 검토·보강 후 다시 완료 선택 UI를 연다. `discuss`는 논의할 내용을 묻고 답변을 기다린다.
  보강·논의·취소 시 인계하지 않는다. 대화만으로 범위를 확정하거나 구현하지 않는다.
- 소스 구현·의존성 설치·에이전트 실행·커밋·푸시를 하지 않는다.
