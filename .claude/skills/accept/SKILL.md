---
description: Select review proposals in a checklist and approve only those changes
disable-model-invocation: true
---
직접 `/accept` 호출 또는 FLOW.md의 **결과 브리핑 후 선택**에서 accept를 고르면 이 절차를 같은 세션에서 수행한다.
수정안 다중 선택 UI를 연다. accept 선택·명령 호출·인수만으로 수정안을 승인하지 않는다.
프로젝트 지침, `.harness/FLOW.md`, CURRENT.md, 활성 스토리와 최신 review-brief.md를 실제로 읽는다.
추가 인수는 검색 힌트일 뿐이다: $ARGUMENTS

1. `node .harness/bin/c2h.mjs resume executor`로 현재 review_decision과 문서 일치를 확인한다.
   리뷰 반영 후 completion_choices이면 FLOW.md의 사용자 완료 선택으로 이동하고 아래 첫 리뷰 체크리스트를 실행하지 않는다.
   브리핑의 요청 ID로 `node .harness/bin/c2h.mjs wait REQUEST_ID --timeout 1`을 실행해 리뷰·소스 기준이 아직 유효한지 확인한다.
   실패·요청 불일치·다른 스토리이면 적용하지 않는다.
2. 지적·확인·권고·수정안을 먼저 한 번에 브리핑한다. 확정된 수정안이 있는 미결정 항목을 선택 후보로 삼는다.
   수정안이 없으면 불필요한 변경을 만들지 말고 남은 판단·완료 게이트를 안내한다.
3. Claude Code의 `AskUserQuestion`을 사용한다. 질문의 `multiSelect: true`로 여러 수정안을 선택하게 한다.
   짧은 문제 제목과 수정 범위·영향을 표시하고 내부 지적 ID 및 브리핑의 수정안에 대응시킨다.
   "선택한 수정안만 적용합니다"를 명시한다. 기본 선택·자동 전체 수락은 하지 않는다.
4. 목록이 길면 도구의 옵션 한도에 맞춰 분할한다. 모든 선택을 모으기 전에는 수정하지 않는다.
   여러 페이지를 썼다면 마지막에 선택한 수정안 전체를 요약해 적용/다시 선택/취소를 확인한다.
5. 명시적인 사용자 선택만 승인이다. 취소·빈 선택·타임아웃·자동 계속 응답이면 소스 수정 없이 종료한다.
   모호한 답변은 선택 UI에서 확인한다. UI가 없으면 중단하며 ID 수동 입력으로 우회하지 않는다.
6. 선택 후 CURRENT.md·스토리·브리핑을 다시 읽고 같은 요청 ID로 wait 검증을 다시 실행한다.
   브리핑의 수정안이나 기준이 선택 전과 달라졌으면 새 내용을 보여주고 다시 선택받는다.
7. 선택한 지적 ID와 수정안만 승인으로 기록한다. 선택하지 않은 항목은 보류한다.
   `node .harness/bin/c2h.mjs checkpoint STORY fixing --approved --note '실제로 선택한 지적 ID·수정 범위·승인 근거 경로'`을 실행한다.
   fixing/담당 executor와 CURRENT.md·index.md를 맞추고 승인한 수정만 구현·재검증한다.
8. 결과·검증·수동 확인 방법·남은 결정을 implementation.md에 기록하고 implementation_done checkpoint로 수정본 기준을 고정한다.
   `.harness/FLOW.md`의 **사용자 완료 선택**을 AskUserQuestion으로 제시한다:
   **확인 완료 · 스토리 종료 / 문제 있음 · 논의/수정 / 추가 리뷰 요청**.
   재리뷰 없이도 사용자 확인으로 완료할 수 있다. 추가 리뷰 요청을 고른 경우에만 harness-review 절차를 수행한다.
   논의·취소는 수정·인계 승인이 아니다. 미선택 수정안을 자동 적용하지 않는다.

커밋·푸시·새 의존성·범위 확대·자동 DONE은 승인하지 않는다. 수정 후 이전 기준의 미선택 항목을 자동 적용하지 않는다.
