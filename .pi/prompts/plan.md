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
- 사용자에게 확정된 스토리·범위와 미결정 사항을 짧게 보고한다.
  미결정 사항이 없으면 Claude 실행자 pane에서 `/executor`를 열어 준비된 스토리를 선택하면 구현이 승인·시작된다고 안내한다.
  명령 호출만으로 승인하지 않는다. 스토리 문서가 상태의 정본이며 index 체크리스트는 요약이다.
- 소스 구현·의존성 설치·에이전트 실행·커밋·푸시를 하지 않는다.
