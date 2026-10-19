# UI003 — 중요한 행동을 확인하거나 취소한다

## 한 일
- flame-ui Dialog를 감싼 공통 Dialog·DialogTrigger·DialogClose·DialogContent 추가(제목·설명 연결, 열린 동안 스크롤 잠금, 초기 포커스).
- 배경을 눌렀다 떼는 경우에만 닫히게 해서, 입력 중 drag로 잘못 닫히는 문제를 막았다.
- 테마 overlay 토큰 추가. 검토 화면 `/`에 06(행동 확인 Dialog) 섹션 추가.

## 바뀐 파일
- client/src/shared/ui/: dialog/, theme.stylex.ts
- client/src/routes/: index.tsx, -dialog-review.tsx
