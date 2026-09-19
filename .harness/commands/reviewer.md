# /reviewer — 현재 리뷰 시작·재개

이 파일은 Pi 확장 `/reviewer` 명령이 읽는다. 수신기를 켜는 데서 끝내지 않는다.
프로젝트 지침, `.harness/{WORKFLOW,FLOW,CURRENT}.md`, `.harness/roles/reviewer.md`를 읽는다.

1. `node .harness/bin/c2h.mjs resume reviewer`와 실제 스토리·승인·implementation.md를 확인한다.
   현재 구현이 없으면 이유를 알리고 멈춘다. 문서 충돌·envelope 누락·소스 drift도 중단한다.
2. pending 요청이 있으면 같은 ID를 재사용한다. 완료된 구현은 있으나 요청이 아직 없으면
   `node .harness/bin/c2h.mjs review STORY`로 시작한다. 유실된 요청을 새 요청으로 위장 복원하지 않는다.
3. 이미 전송된 결과는 수정·재리뷰하지 않는다. review_ready이면 기존 초안·요청·기준을 확인하고 선택으로 간다.
   미완료 리뷰면 변경 파일·관련 코드 중심으로 이어간다. 재리뷰는 implementation.md의 이전 요청 ID·추가 보강·검증 결과·검토 질문을 먼저 대조한다. Git diff는 있을 때만 참고한다.
   Git이 없으면 변경 설명·실제 코드를 대조하고 비교 근거가 없으면 한계를 기록한다. 필요시 작은 비변경 unit/repro만 허용한다.
   E2E·브라우저·개발 서버·전체 suite·종합 QA·소스 수정은 금지한다.
4. 요청 ID·고정 기준·지적/근거·검토 한계를 review-N.md 초안에 저장한다.
   `node .harness/bin/c2h.mjs checkpoint STORY review_ready --note '리뷰 초안 저장'` 후 Markdown을 맞춘다.
5. **c2h_review_next에 requestId와 보고서 경로를 전달**한다. send / discuss 선택을 받는다.
   send일 때만 확장이 `node .harness/bin/c2h.mjs reply REQUEST_ID --review PATH`를 실행한다.
   discuss는 미전송 초안 논의·수정 후 다시 UI. 취소·무응답이면 초안을 보존한다.
   도구/UI가 없으면 설치·신뢰·`/reload`를 확인하며 전송하지 않는다.

자동 회신 금지. review_request 선행 ack 금지. 전송된 보고서는 불변이다.
수신 executor는 검증·브리핑 후 첫 리뷰는 accept/feedback, 재리뷰는 사용자 완료 선택을 연다. 별도 사용자 수정 승인 전에는 소스를 바꾸지 않는다.
