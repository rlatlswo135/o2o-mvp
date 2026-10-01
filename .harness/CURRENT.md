# 현재 작업 포인터

- 현재 스토리: S001 — 고객 등록 후 목록 확인
- 스토리 문서: `.harness/stories/S001/story.md`
- 현재 담당 역할: executor — REVIEW_DECISION (2026-10-01T17:11:34+09:00 reviewer가 1회 결과 저장 후 인계).
- 이번 작업 초점: `shared/ui/` 1단계 리뷰 결과의 실제 코드 대조·브리핑·사용자 결정. 요청 ID `20261001T074651133068Z-a9bbc3656ffd`. [review-1.md](stories/S001/review-1.md) PASS(변경 소스 한정), [qa-1.md](stories/S001/qa-1.md) BLOCKED. 이전 `features/customers/ui/` 선개발 인계는 폐기됨.
- 전달 상태: planner의 c2h send는 `Error: Run init first.`로 실패했으나 executor가 인계 문서를 직접 읽고 수락했다.
- 진행: 1단계 구현·검증 완료(2026-10-01T15:18:59+09:00). 결과는 `.harness/stories/S001/implementation.md`.
- 다음 행동: `c2h reply` 회신 완료(결과 메시지 `20261001T081223402909Z-6a75268ed0a5`, executor inbox 확인). 요청은 reply 저장 후 보관되었다. executor는 같은 요청의 wait 결과를 확인하고 실제 코드 대조·review-brief.md 브리핑 후 사용자 `/accept`·`/feedback`을 기다린다.
- 멈춤 조건: 사용자 선택 전 소스 수정·커밋 금지. R1 dev StyleX CSS 연결·R2 기존 전체-client 검사 정리는 별도 승인 필요. coverage·사용자 검증·S001 통합 완료는 미완료이며 자동 FIX·DONE·후속 범위 구현 금지.

상태·담당·명시적 승인은 스토리 문서가 정본이다. 이 포인터와 어긋나면 추측하지 말고 멈춘다.

## 먼저 읽을 자료

1. 루트 `AGENTS.md`, `client/AGENTS.md`.
2. `.harness/WORKFLOW.md`, `.harness/roles/planner.md`, 해당 스토리 문서와 `.harness/stories/S001/fe-structure.md`.
3. `client/package.json`, `client/vite.config.ts`, `client/tsconfig.json`, `client/src/`의 현재 코드.
4. `.harness/stories/v1-scope.md`, `.harness/stories/index.md`, `.harness/design/README.md`.
5. 아래 이미지는 실제로 열어 확인한다.
   - `.harness/design/images/02-ink-blue.png`
   - `.harness/design/images/ui-01-inputs.png`
   - `.harness/design/images/ui-02-feedback.png`

## 이번 재개에서 지킬 경계

- FE 스캐폴딩은 사용자가 완료했다. 실제 Vite+·TanStack Start·StyleX 구성을 먼저 확인하며, 이전 SPA 계획으로 임의 교체하지 않는다.
- 서버 최소 구성·BE 구현은 사용자 담당이다. `server/`는 수정하지 않고 BE 준비를 FE 구조 검토의 선행 조건으로 요구하지 않는다.
- 라우트는 `client/src/routes/`에서 페이지 조립·라우팅에 집중한다. 기능 코드는 `client/src/features/<feature>/`에 둔다.
- 도메인 독립 공통 UI는 처음부터 `client/src/shared/ui/`에서 개발한다. 두 번째 feature의 실제 소비자를 선행 조건으로 요구하지 않는다. 기능 전용 hooks·업무 UI는 features에 두고 별도 디자인 시스템 패키지는 만들지 않는다.
- 이번 확정 실행 범위는 공통 UI 첫 묶음(Button·Input·Field·최소 테마)이다. 고객 전용 문구·검증·폼·목록·API는 제외한다. 상세 범위·검증은 최신 스토리의 구현 인계를 따른다.
- `flame-ui`는 사용자 개인 라이브러리이며 함께 개선할 계획이다. 설치 여부·현재 버전은 package.json에서 확인한다.
  저장소: https://github.com/rlatlswo135/flame . 의존성 추가나 라이브러리 저장소 수정은 별도 확인한다.
- Zustand·TanStack Table·TanStack Form은 필요 시 사용자가 직접 설치한다. 이번 승인에 의존성 설치·설정 변경은 포함되지 않는다.
- 상세 API 초안·대규모 설계 문서·새 실행기를 만들지 않는다. 새 에이전트·하네스를 실행하지 않는다.
- shared/ui 공통 컴포넌트 실행·인계 승인은 기록되었다. executor 수락 전 실행을 주장하지 않고 planner가 소스 구현을 시작하지 않는다.

## 기록과 다음 단계

- 확정 구조·실행 순서는 `.harness/stories/S001/fe-structure.md`, 이번 승인 범위·인계 근거는 스토리의 구현 인계가 정본이다.
- 사용자는 공통 UI 선개발·인계를 승인하고 이번 정정에서 shared/ui 계층을 명확히 했다. FLOW.md의 `/executor` 선택·인계 수락 전에는 AWAITING_APPROVAL/담당 planner를 유지한다.
- 인계 시 현재 담당자가 스토리를 먼저 갱신하고 이 포인터의 담당·다음 행동·멈춤 조건을 맞춘다.
- 이후 FE 목업 검토와 실제 BE 연결·통합 완료를 구분한다. 화면만 만들어진 상태를 DONE으로 처리하지 않는다.
