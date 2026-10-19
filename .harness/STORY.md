# S001 — 제목

## 계획과 범위

승인 전에는 이 문서를 보강할 수 있다. **승인 후에는 전체 파일을 동결한다.**
상태·완료 체크·승인 근거를 나중에 이 파일에 덧붙이지 않는다. 범위 변경은 기존 승인의 재사용이 아니다.

### 사용자 요구와 가치

### 범위 / 제외 범위

### 의존 스토리 / 남은 결정

### 완료 조건
- Given … When … Then …

### Design (when story has visual UI)
- 2–3 story-specific directions + direction the user chose:
- Concrete tokens, states, implementation guidance (design.md):
- Story-folder HTML preview (preview.html, one file updated in place):

### 검증 계획
- executor 검증 명령·기대 결과:
- 수동 확인: executor가 브라우저로 대신 확인할 항목 / 사람 확인 필수 항목과 이유(자동화로 대신할 수 없을 때만, 없으면 '없음'):
- 학습: 선택 / 기존 필수 / 불필요 (근거와 필요한 산출물)

## 완료 게이트 정의
- 정확한 스토리 revision의 사용자 구현 승인 (c2h_plan_next의 실행자·디자이너 인계 선택)
- 고정 기준 종합 검토와 계획 대비 지적 반영 기록
- 완료 조건별 executor 검증 증거 (코드 리뷰로 대체 불가)
- QA 계약이 있으면 수정본 기준 QA 필수 기준 PASS
- 수동 확인 항목의 executor 브라우저 확인 증거, 사람 확인 필수 항목이 있으면 사용자 확인
- 선택/상속된 학습 게이트 충족 또는 불필요 사유

## 진행 기록 위치
- `implementation.md`: 변경·검증·완료 게이트 결과·수동 확인과 `## 구현 판단`, `## 리뷰와 반영`(지적 ID → 반영/반영하지 않음 → 근거).
- `planning.md` / `impact.md`: 필요할 때만 쓰는 스토리별 영향 분석. 외부 스킬의 specs/*·공용 LATEST 경로를 사용하지 않는다.
- `records/`: 런타임·역할 기록(`checkpoint.md`는 직접 편집 금지, 보고서는 전송 후 불변).
- 완료되면 planner가 이 스토리에서 한 일만 `result.md`에 남기고 나머지 파일은 지워진다.

리뷰 요청(종합 검토·수정 재리뷰)은 스토리당 3회까지, 같은 수정이 연속 2회 실패하면 멈추고 사용자에게 묻는다.
필요한 모델 변경은 사용자가 결정한다. 후속 기록은 이 스토리 범위를 임의 확대하지 않는다.
