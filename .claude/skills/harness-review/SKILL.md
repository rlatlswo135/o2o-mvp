---
description: Hand off completed implementation to Pi reviewer without automatic reply or fixes
argument-hint: "[story-id]"
disable-model-invocation: true
---
Claude 내장 `/review`와 별개다. 직접 호출 또는 실행 완료의 명시적 review 선택으로만 진행한다.
프로젝트 지침, `.harness/FLOW.md`, CURRENT.md, 활성 story.md·implementation.md를 읽는다.
요청 대상: $ARGUMENTS

1. `node .harness/bin/c2h.mjs resume executor`로 승인된 구현/FIX가 끝났는지 확인한다.
   첫 구현의 review 선택 또는 사용자 완료 선택의 추가 리뷰 요청으로 진행한다. 재리뷰 회신 후 소스 변경 없이 추가 검토를 요청할 수도 있다.
   인수가 활성 스토리와 다르거나 미승인 수정이 남았으면 멈춘다. pending 리뷰는 재사용한다.
2. 변경·추가·삭제 파일과 변경 설명·완료 조건별 명령/실제 결과·미검증 항목을 저장한다.
   Git이 있으면 diff·관련 untracked 파일 목록도 참고한다. Git이 없어도 인계하며 초기화를 요구하지 않는다.
   비밀을 기록하지 않는다. 필요한 테스트·브라우저·빌드는 executor 책임이다.
3. 인계에 필요한 증거·index.md를 먼저 저장한다. 재리뷰는 implementation.md에 이전 요청 ID·추가 보강·검증 결과·검토 질문을 명시한다.
   implementation_done이면 `node .harness/bin/c2h.mjs review STORY`를 실행한다.
   재리뷰 회신 후 review_decision에서 추가 리뷰를 선택했으면 `node .harness/bin/c2h.mjs review STORY --again`을 실행한다.
   런타임이 reviewing 상태와 CURRENT.md의 담당·초점·다음 행동을 같은 쓰기 잠금 안에서 갱신한다.
   JSON의 요청 ID를 기록한다. CURRENT.md의 표준 진행 요약을 별도로 덮어쓰지 않는다.
   이후 소스 수정·커밋 금지. 실패를 성공이라고 말하지 않는다. 출력 유실은 status/resume으로 확인하며 재전송하지 않는다.
4. 기존 executor listener를 유지한다. 없으면 resume 확인 후 네이티브 Bash `run_in_background: true`로
   `node .harness/bin/c2h.mjs listen executor --timeout 0` 하나만 연다. 별도 background wait를 겹치지 않는다.
   reviewer가 진행하지 않으면 해당 Pi의 `/reviewer`로 현재 요청을 재개한다.
5. reviewer는 초안 → review_ready → send/discuss 선택을 거친다. 자동 회신을 기대하거나 재촉해 우회하지 않는다.
6. 결과 알림의 실제 출력과 resume을 확인하고 `node .harness/bin/c2h.mjs wait REQUEST_ID --timeout 1`로 검증한다.
   요청·스토리·보고서·소스 기준이 어긋나면 중단한다. FLOW.md에 따라 **코드 수정 없이** 브리핑한다.
7. review-brief.md 저장·수락 기록 후 해당 결과만 `node .harness/bin/c2h.mjs ack executor MESSAGE_ID`로 보관한다.
   waiter를 다시 열고 resume을 재확인한다. 첫 리뷰의 review_decision이면 FLOW.md의 **결과 브리핑 후 선택**(accept / feedback)을 연다.
   재리뷰의 completion_choices이면 **사용자 완료 선택** 3개를 연다. 새 지적을 자동 수정하지 않는다.
   선택한 절차는 같은 세션에서 수행한다. 명령 재입력 요구 없음. accept 선택만으로 승인하지 않는다.

권한 거부·알림 실패·세션 종료는 숨기지 않는다. 재시작 시 새 listener를 만들며 옛 job을 믿지 않는다.
수동 복구는 같은 요청의 resume/inbox/wait다. 요청 envelope 누락을 새 요청으로 덮지 않는다.
리뷰 도착은 수정 승인 아님. 첫 리뷰는 `/accept`에서 고른 수정안, 이후 논의는 사용자가 구체적으로 요청·승인한 수정만 적용한다.
