# 현재 작업 포인터

- 현재 스토리: S001 — 고객 등록 후 목록 확인
- 스토리 문서: `.harness/stories/S001/story.md`
- 다음 담당 역할: planner
- 이번 작업 초점: 사용자 스캐폴딩 위에서 FE 구조와 첫 공통 UI 구현 범위를 합의한다.
- 다음 행동: 아래 지침·실제 코드·선택 시안을 읽고, 공통 UI 위치·파일 구분·테마 적용 방식의 최소 구조안을 짧게 제안한다.
- 멈춤 조건: 구조안 제시 후 사용자 승인 대기. 아직 UI 구현·새 의존성 설치·커밋·푸시를 시작하지 않는다.

상태·담당·명시적 승인은 스토리 문서가 정본이다. 이 포인터와 어긋나면 추측하지 말고 멈춘다.

## 먼저 읽을 자료

1. 루트 `AGENTS.md`, `client/AGENTS.md`.
2. `.harness/WORKFLOW.md`, `.harness/roles/planner.md`, 해당 스토리 문서.
3. `client/package.json`, `client/vite.config.ts`, `client/tsconfig.json`, `client/src/`의 현재 코드.
4. `.harness/stories/v1-scope.md`, `.harness/stories/index.md`, `.harness/design/README.md`.
5. 아래 이미지는 실제로 열어 확인한다.
   - `.harness/design/images/02-ink-blue.png`
   - `.harness/design/images/ui-01-inputs.png`
   - `.harness/design/images/ui-02-feedback.png`

## 이번 재개에서 지킬 경계

- FE 스캐폴딩은 사용자가 완료했다. 실제 Vite+·TanStack Start·StyleX 구성을 먼저 확인하며, 이전 SPA 계획으로 임의 교체하지 않는다.
- 서버 최소 구성·BE 구현은 사용자 담당이다. `server/`는 수정하지 않고 BE 준비를 FE 구조 검토의 선행 조건으로 요구하지 않는다.
- 별도 디자인 시스템 패키지 없이 FE 내부 `ui/`에 필요한 것만 공통화한다. 위치·파일 경계는 이번 구조 제안에서 사용자와 확인한다.
- 첫 구현 후보는 S001에 필요한 Button·Input·Field·최소 테마 값이다. 후보를 확정 범위로 간주하거나 시안 전체·업무 화면을 선구현하지 않는다.
- `flame-ui`는 사용자 개인 라이브러리이며 함께 개선할 계획이다. 설치 여부·현재 버전은 package.json에서 확인한다.
  저장소: https://github.com/rlatlswo135/flame . 의존성 추가나 라이브러리 저장소 수정은 별도 확인한다.
- Zustand·TanStack Table·TanStack Form은 필요 시 사용자가 직접 설치한다. 구조 검토 단계에서는 설치·수정 없이 읽고 제안한다.
- 상세 API 초안·대규모 설계 문서·새 실행기를 만들지 않는다. 구조안과 필요한 결정만 짧게 제시한다.
- 구현 승인 후에는 executor에게 명시적으로 인계한다. planner가 소스 구현을 시작하지 않는다.

## 기록과 다음 단계

- 구조 제안·합의 근거는 필요 시 `.harness/stories/S001/fe-structure.md`에 작성한다(아직 없는 결과 문서).
- 사용자 승인 전에는 스토리의 승인·상태를 구현 단계로 바꾸지 않는다.
- 인계 시 현재 담당자가 스토리를 먼저 갱신하고 이 포인터의 담당·다음 행동·멈춤 조건을 맞춘다.
- 이후 FE 목업 검토와 실제 BE 연결·통합 완료를 구분한다. 화면만 만들어진 상태를 DONE으로 처리하지 않는다.
