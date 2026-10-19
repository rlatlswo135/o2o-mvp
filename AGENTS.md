- client/ 작업 전 client/AGENTS.md를 읽는다.
- server/ 작업 전 server/AGENTS.md를 읽는다.
- 두 영역을 함께 수정한다면 양쪽 지침을 모두 읽는다.
- **서버 구현은 사용자 담당이며 명시적 요청 없이 수정하지 않는다.**
- 재사용할 공통 UI 계약·제약은 `.harness/stories/ui-structure.md`에서 확인한다. 완료 스토리 상세·과거 대화는 기본 읽기에서 제외하고 관련 조사 때만 읽는다.

<!-- c2h:resume:start -->
사용자가 작업 진행·이어서 진행을 요청하면 `.harness/FLOW.md`의 **재개**를 따라 현재 단계를 복원한다. 재개만으로 범위 확대·커밋·푸시를 승인하지 않는다. 하네스 산출물은 `.harness/` 아래에 저장하며 외부 스킬의 `specs/*`·공용 LATEST 경로는 따르지 않는다. 완료 스토리는 result.md만 남는다.
<!-- c2h:resume:end -->
