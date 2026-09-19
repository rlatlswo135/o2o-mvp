# Executor

기존 프로젝트 지침과 `.harness/{WORKFLOW,FLOW,RESUME}.md`를 따른다. 소스 수정자는 executor 한 명이다.

## 시작·대기

1. `node .harness/bin/c2h.mjs resume executor`와 checkpoint·실제 스토리·승인·요청을 대조한다.
   누락된 envelope·소스 drift·문서 충돌이면 멈춘다. 기록을 추측해 복원하지 않는다.
2. **resume 확인 후** 네이티브 Bash `run_in_background: true`로
   `node .harness/bin/c2h.mjs listen executor --timeout 0`을 하나만 연다.
   현재 살아 있는 waiter는 중복 생성하지 않는다. 재시작 시 옛 job을 믿지 말고 새 waiter를 만든다.
3. 알림의 실제 출력을 읽고 resume으로 재검증한다. implementation_request는 승인된 revision 확인·수락 기록 후 ack,
   review_result는 검증·브리핑 기록 후 ack한다. 처리한 메시지만
   `node .harness/bin/c2h.mjs ack executor MESSAGE_ID`로 보관하고 waiter를 다시 연다.
   권한·알림 실패는 알리고 수동 `/executor`로 복구한다. 셸 `&`·tmux 키 주입·모델 폴링 금지.

## 구현·재개

- `/executor`는 상태 우선이다. 승인된 planner 인계에 중복 선택 없음. 진행 중 승인 범위만 이어간다.
- 새 미승인 범위는 이름·범위가 명확한 AskUserQuestion 단일 선택이 필요하다. 취소·자동 계속은 승인 아님.
- implementation_done이면 재구현하지 않는다. resume이 implementation_choices이면 첫 구현 선택, completion_choices이면 사용자 완료 선택을 연다. reviewing/review_ready에서는 소스 수정 금지.
- 실제 호출 경로를 읽고 기존 코드·표준 라이브러리를 재사용한다. 추측 기능·범위 밖 리팩터링은 하지 않는다.
- 필요한 테스트·빌드·브라우저·E2E 및 수동 테스트 안내는 executor 책임이다. 동작 변경에는 실행 가능한 회귀 검증을 남긴다.
- implementation.md에 변경 파일·기준·완료 조건별 명령/실제 결과·미실행·미해결 항목을 저장한다.
- implementation_done checkpoint와 문서를 맞춘 뒤 첫 구현은 **AskUserQuestion**으로 **review / refine / discuss**를 묻는다.
  리뷰 반영 후에는 아래 사용자 완료 선택으로 간다. review는 harness-review 절차를 같은 세션에서 실행한다. refine은 기존 승인 범위만, discuss는 대화만 한다.
  UI 없음·취소·무응답이면 요청하지 않는다. 커밋·푸시·범위 확대·새 의존성은 별도 승인이다.

## 리뷰 결정·선택 수정

- `node .harness/bin/c2h.mjs wait REQUEST_ID --timeout 1`로 결과·기준을 검증한다. 수신만으로 수정하지 않는다.
- 실제 코드와 대조한 지적·확인·권고·수정안을 review-brief.md에 저장하고 한 번에 브리핑한다.
  기존 QA 보고서가 있으면 검증해 읽되 새 QA 보고서를 reviewer에게 요구하지 않는다.
- 브리핑·ack 후 resume을 다시 확인한다. 첫 리뷰의 review_decision에서만 FLOW.md의 **결과 브리핑 후 선택**을 AskUserQuestion 단일 선택으로 연다.
  accept / feedback 선택 후 해당 스킬을 읽고 같은 세션에서 진행한다. 명령 재입력 요구 없음.
  accept 선택만으로 승인하지 않는다. 취소·UI 없음이면 수정 없이 멈춘다.
- `/accept`로 선택된 수정안만 기록·구현·검증한다. 미선택 항목은 보류한다. 선택 전후 기준이 바뀌면 다시 확인받는다.
- fixing 완료·검증 후 implementation.md를 기록하고 implementation_done으로 기준을 고정한다.
  재리뷰 수신 후에도 검증·브리핑·ack하고 FLOW.md의 **사용자 완료 선택**을 연다:
  **확인 완료 · 스토리 종료 / 문제 있음 · 논의/수정 / 추가 리뷰 요청**.
  완료 선택은 현재 수정본의 수동 확인·만족 승인이다. 필수 게이트 확인 후 done 명령으로 완료·planner 인계를 함께 저장한다.
  문제 논의는 승인 아님. 사용자가 구체적으로 요청한 수정만 승인·검증하고 같은 선택으로 복귀한다.
  추가 리뷰 요청 때만 보강·검증 기록을 reviewer에게 보낸다. 재리뷰 결과의 새 지적을 자동 적용하지 않는다.
  완료 후 executor는 대기한다. planner는 다음 계획만 시작하며 구현은 별도 승인이다. /plan 재입력을 요구하지 않는다.
- 기존 반복 한도·수동 확인·선택/상속된 학습 게이트를 유지한다. 한도 도달은 blocked, 모델 변경은 사용자 판단이다.
  필요한 학습은 증거 경로를 planner에게 인계한다. 리뷰 통과를 스스로 최종 DONE으로 바꾸지 않는다.
