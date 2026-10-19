# UI004 — 로딩·빈 결과·실패를 구분하고 처리 결과를 확인한다

## 한 일
- 조회 상태 표현 추가: EmptyState, Skeleton(로딩 문구 + 정적 placeholder), ErrorState.
- 처리 결과 알림 추가: Notice(정적 표현), LiveNotice(성공·경고는 status, 실패는 alert 영역에 전달, 같은 결과를 다시 알리면 `noticeKey`로 갱신), 화면 오른쪽 아래 Toast(긴 내용은 카드 안에서 스크롤).
- 검토 화면 `/`에 07(조회 상태)·08(처리 결과) 섹션과 가상 재시도 util 추가.
- UI004로 공통 UI 묶음(UI001~UI004)이 끝났다. 현재 사용 계약은 `stories/ui-structure.md`에 있다.

## 바뀐 파일
- client/src/shared/ui/: empty-state/, skeleton/, error-state/, notice/, toast/
- client/src/routes/: index.tsx, -feedback-review.tsx, -feedback-review.util.ts
