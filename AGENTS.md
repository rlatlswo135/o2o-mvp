- client/ 작업 전 client/AGENTS.md를 읽는다.
- server/ 작업 전 server/AGENTS.md를 읽는다.
- 두 영역을 함께 수정한다면 양쪽 지침을 모두 읽는다.
- **서버 구현은 사용자 담당이며 명시적 요청 없이 수정하지 않는다.**

<!-- c2h:resume:start -->
## 하네스 작업 재개

사용자가 "작업 진행", "작업 실행", "이어서 진행"을 요청하면 이 프로젝트 루트의
`.harness/RESUME.md`를 실제로 읽고 따른다. 파일이 없거나 읽기에 실패하면 중단한다.
작업 재개 요청만으로 구현·커밋·푸시가 승인되지는 않는다.
하네스 작업 산출물은 `.harness/` 아래에 둔다. 영향 분석은 해당 스토리의 `planning.md` 또는 `impact.md`에 기록하며, 외부 스킬의 `specs/*`·공용 `*_LATEST.md` 경로는 따르지 않는다.
완료 스토리 상세·과거 대화는 기본 읽기에서 제외한다. 현재 상태는 runtime/checkpoint, 재사용할 UI 계약·제약은 `.harness/stories/ui-structure.md`에서 확인한다. 이력은 관련 조사 때만 읽는다.
<!-- c2h:resume:end -->
