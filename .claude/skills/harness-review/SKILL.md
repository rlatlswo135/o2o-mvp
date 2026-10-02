---
description: Hand off a frozen implementation to the Pi reviewer and wait for a briefing
argument-hint: "[story-id]"
disable-model-invocation: true
---
이 명령은 Claude의 내장 `/review`가 아니라 독립 Pi reviewer에게 보내는 인계다.
직접 명령 호출 또는 실행 완료 선택의 명시적 '리뷰어에게 넘기기' 선택으로만 진행한다.
프로젝트 지침과 `.harness/FLOW.md`, CURRENT.md, 활성 스토리·implementation.md를 실제로 읽는다.
요청 대상: $ARGUMENTS

1. 현재 세션이 executor인지, 승인된 구현 또는 승인된 FIX가 끝났는지 확인한다.
   인수가 활성 스토리와 다르면 멈춘다. REVIEW_DECISION에서 미승인 항목을 건너뛰어 재요청하지 않는다.
2. 변경 파일·기준/대상 커밋 또는 staged/unstaged diff·스토리의 untracked 파일 목록,
   완료 조건별 검증 명령/결과·미검증 항목을 implementation.md에 기록한다. 비밀 파일 내용은 포함하지 않는다.
   reviewer는 코드만 검토한다. 필요한 브라우저·빌드·테스트를 대신 실행할 것으로 기대하지 않는다.
3. 스토리를 REVIEW/담당 reviewer로 기록하고 CURRENT.md를 맞춘다. 이후 소스 수정·커밋을 멈춘다.
4. 프로젝트 루트에서 `c2h review <ID>`를 Bash로 실행한다. 성공 출력인 REQUEST_ID를 implementation.md에 기록한다.
   실패하면 전송했다고 주장하지 않는다. pending 요청이 있으면 기존 요청을 확인하고 재전송하지 않는다.
   요청 파일이 생기지 않은 전송 실패면 이전 상태·담당으로 복원하고 원인을 기록한다.
   출력 유실 등 성공 여부가 불명확하면 inbox의 요청 ID·스토리·기준부터 확인한다.
5. 같은 프로젝트 루트에서 `c2h wait <REQUEST_ID> --timeout 1800`을 **Bash의 run_in_background: true**로 실행한다.
   셸의 `&`, 새 CLI, 모델 API, tmux send-keys는 사용하지 않는다.
   작업 ID·출력 파일을 기록하고 요청 ID·결과 경로·수신 대기 상태를 보고한다.
   리뷰가 시작되지 않으면 reviewer pane에서 `/reviewer`를 입력하도록 안내한다.
   확장이 없으면 reviewer에게 `/harness-reviewer` 후 `inbox 확인하고 리뷰 진행`을 입력한다.
   수동 리뷰도 같은 요청에 `c2h reply`로 회신해야 wait가 완료된다. 반복 모델 호출로 inbox를 폴링하지 않는다.
6. 백그라운드 완료 알림을 받으면 TaskOutput 또는 Read로 실제 결과를 읽고 `.harness/FLOW.md`의 리뷰 브리핑 절차를 수행한다.
   요청 ID·스토리·기준이 다르거나 소스가 바뀌었으면 적용하지 않는다. **코드 수정 없이** REVIEW_DECISION에서 사용자 판단을 기다린다.
7. 타임아웃·중단·권한 거부·백그라운드 기능 비활성화는 숨기지 않는다.
   새 요청을 만들지 말고 같은 REQUEST_ID의 `c2h wait`를 다시 실행할지 사용자에게 확인한다.

리뷰 결과 도착이나 `/accept` 호출만으로는 수정 승인이 아니다. 선택 UI에서 사용자가 명시적으로 고른 수정안만 적용한다.
