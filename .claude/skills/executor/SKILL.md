---
description: Choose a prepared story and approve its implementation through the selection UI
disable-model-invocation: true
---
`/executor`는 스토리 선택 UI를 연다. 명령 호출이나 인수만으로 구현을 승인하지 않는다.
프로젝트 지침, `.harness/WORKFLOW.md`, `.harness/FLOW.md`, `.harness/CURRENT.md`,
`.harness/stories/index.md`와 해당 스토리 문서를 실제로 읽는다.
`c2h prompt executor`와 지정된 역할 파일을 읽어 현재 세션에 적용한다. 실패하면 중단한다.
추가 인수는 검색 힌트일 뿐이다: $ARGUMENTS

## 선택 목록

1. 스토리 문서를 정본으로 삼아 index.md의 완료 체크와 상태를 대조한다. 체크는 DONE에만 표시한다.
2. 구현 중인 스토리가 있으면 다른 스토리를 시작하지 않는다.
   IMPLEMENTING 또는 사용자 승인된 FIX는 현재 작업 재개/취소만 선택하게 한다.
   REVIEW/QA는 기다리고, REVIEW_DECISION은 브리핑 후 `/accept`·`/feedback`을 안내한다.
   BLOCKED·수동 확인·학습 등 다른 단계는 해당 게이트부터 처리한다.
3. 실행 중인 스토리가 없으면 준비된 AWAITING_APPROVAL 스토리만 구현 후보로 삼는다.
   상세 범위·완료 조건·planner의 인계 준비 기록·선행 조건을 확인한다.
   미결정·상세 미작성·선행 미충족 항목은 대기 사유만 보여주고 구현 선택지에서는 제외한다.
   후보가 없으면 planner에게 필요한 결정을 안내하고 멈춘다.
4. Claude Code의 `AskUserQuestion`을 사용한다. 질문의 `multiSelect: false`로 한 스토리만 선택하게 한다.
   제목과 설명은 사람이 읽는 기능명·범위·상태로 표시하며 내부 스토리 ID·문서 경로에 정확히 대응시킨다.
   질문에 "선택하면 표시된 범위의 구현을 승인하고 시작합니다"를 명시하고 취소 경로를 제공한다.
   목록이 길면 도구가 허용하는 옵션 수 이내로 나눠 '다음 목록'을 제공한다. 페이지 이동은 승인이 아니다.

## 선택 후 실행

- 명시적인 사용자 선택이 있어야 진행한다. 취소·빈 응답·타임아웃·자동 계속 응답은 승인 없음이다.
  기본값으로 임의 선택하거나 ID를 직접 입력하라고 대체하지 않는다. 선택 UI가 없으면 이유를 알리고 중단한다.
- 사용자가 선택하는 동안 상태가 바뀔 수 있으므로 선택된 스토리와 CURRENT.md를 다시 읽는다.
  범위·준비 상태·다른 활성 작업이 달라졌으면 이전 선택을 적용하지 않고 갱신된 내용을 보여준다.
- 사용자의 선택을 승인 근거로 기록하고 준비된 planner 인계를 수락한다.
  IMPLEMENTING/담당 executor와 CURRENT.md를 맞춘 뒤 선택한 스토리 하나만 구현·검증한다.
- implementation.md에 실제 결과와 미실행 항목을 구분한다. index.md의 상태도 갱신하되 구현만 끝났다고 체크하지 않는다.
- 완료 시 `/harness-review`로 리뷰에 넘길 준비가 됐다고 보고하고 멈춘다. 자동 리뷰 요청은 하지 않는다.

프로젝트 담당 영역과 권한은 유지한다. 커밋·푸시·계획 밖 의존성 추가·파괴적 행동은 이 선택의 승인 범위가 아니다.
