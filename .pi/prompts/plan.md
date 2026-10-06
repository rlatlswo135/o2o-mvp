---
description: Plan a story in Pi and choose approved handoff, refinement, or discussion
---
Pi planner 프롬프트다. 프로젝트 지침과 `.harness/RESUME.md`의 최소 읽기 규칙을 따른다. 하네스 산출물은 `.harness/` 아래에만 저장한다.
`node .harness/bin/c2h.mjs prompt planner`의 역할 문서와
`node .harness/bin/c2h.mjs resume planner` 결과를 확인한다. 실패·문서 충돌이면 멈춘다.

검증된 planning_request가 있고 이전 작업 대화가 남아 있으면 `/harness-new`를 안내하고 멈춘다. 새 세션에서는 이 절차를 수행하며 /plan 재입력 요구 없음.
직전 완료 checkpoint·implementation.md의 '다음 작업용 요약'과 index의 다음 후보를 읽는다. 불명확한 근거만 추가 확인하며 완료 이력 전체를 읽지 않는다. 후보가 없거나 불명확하면 사용자에게 묻는다.
다음 스토리의 planning checkpoint·수락 기록을 저장한 뒤 이전 완료 요청을 ack한다. 다음 구현은 별도 승인이다.

사용자 요청: $ARGUMENTS

1. 기존 계획을 이어 작은 수직 스토리로 정리한다. 한 번에 활성 작업 하나, 소스 구현은 하지 않는다.
2. story.md에 범위·제외 범위·완료 조건·의존성·남은 결정을 저장한다. index.md는 한 줄 이름·링크·의존성 목록이며 최종 확인된 DONE만 체크한다. 활성 phase·승인·인계 이력은 복제하지 않는다. 영향 분석은 해당 planning.md 또는 impact.md에 둔다.
3. planning checkpoint와 CURRENT.md를 맞춘다. 사용자가 승인할 정확한 범위를 짧게 보여준다.
4. **c2h_plan_next 도구에 `story` 인수로 스토리 ID를 전달**해 handoff / refine / discuss UI를 연다.
   - handoff: **선택이 해당 revision의 구현 승인**이다. 확장이 준비 상태를 확인하고
     `node .harness/bin/c2h.mjs handoff STORY --approved`를 실행한다. planner가 별도 send/handoff를 반복하지 않는다.
     승인된 인계는 executor listener로 전달된다. 수동 복구는 `/executor`, 중복 스토리 선택은 요구하지 않는다.
   - refine: 문서 보강 후 다시 UI.
   - discuss: 논의 후 사용자 답변 대기. 자동 인계 없음.
5. 취소·빈 응답·타임아웃은 승인 아님. UI가 없으면 확장 설치·신뢰·`/reload`를 안내하고 멈춘다.
   승인 인계 후 story.md를 임의 변경하지 않는다. 메시지 저장을 상대 CLI 실행 성공이라고 주장하지 않는다.

계획 작성만으로 승인하지 않는다. 소스·의존성 설치·커밋·푸시·새 에이전트 실행은 하지 않는다.
