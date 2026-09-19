---
description: Choose a review finding and discuss feedback without editing source
disable-model-invocation: true
---
프로젝트 지침, `.harness/FLOW.md`, CURRENT.md, 활성 스토리와 최신 review-brief.md를 실제로 읽는다.
추가 의견: $ARGUMENTS

1. `node .harness/bin/c2h.mjs resume executor`로 현재 review_decision과 문서 일치를 확인한다.
   completion_choices이면 FLOW.md의 사용자 완료 선택 중 문제 있음 · 논의/수정 절차로 이동하고 아래 첫 리뷰 절차를 실행하지 않는다.
   `node .harness/bin/c2h.mjs wait REQUEST_ID --timeout 1`로 최신 요청·보고서·소스 기준을 검증한다. 불일치면 중단한다.
2. Claude Code의 `AskUserQuestion`을 사용한다. 질문의 `multiSelect: false`로 논의할 항목 하나를 선택하게 한다.
   사람이 읽는 문제 제목·현재 권고를 표시하고 내부 지적 ID에 대응시킨다. ID 입력을 요구하지 않는다.
   긴 목록은 도구 옵션 한도 안에서 나눈다. 취소·빈 응답·타임아웃·자동 계속 응답이면 멈춘다.
   선택 UI가 없으면 이유를 알리고 중단한다.
3. 항목 선택 후 사용자의 의견을 받는다. 추가 인수로 의견을 이미 줬다면 다시 묻지 않는다.
   `AskUserQuestion`의 방향 선택(근거 추가 확인/다른 수정안/반영 보류)과 기타 직접 입력을 활용할 수 있다.
4. 선택된 지적과 실제 코드를 대조하고 판단·수정안·영향을 다시 설명한다.
   최신 review-brief.md에 피드백과 바뀐 제안을 기록한다. 기존 리뷰와 무관한 범위를 확대하지 않는다.
5. 피드백 선택은 수정 승인이 아니다. 소스 수정·자동 재요청을 하지 않는다.
   첫 리뷰 논의가 끝나면 FLOW.md의 **결과 브리핑 후 선택** UI로 돌아간다. accept를 고르면 같은 세션에서 수정안 다중 선택을 연다.
   리뷰 반영 이후의 논의는 **사용자 완료 선택**으로 돌아간다. 이 경우 구체적인 사용자 수정 요청만 별도로 승인·수행한다.
   취소·빈 응답·타임아웃·UI 없음이면 선택창을 다시 열지 않고 멈춘다. reviewer의 추가 확인이 필요하면 그 이유부터 알린다.
