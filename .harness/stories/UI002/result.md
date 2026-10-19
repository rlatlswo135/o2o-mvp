# UI002 — 목록에서 행과 상태를 구분한다

## 한 일
- 공통 Table(caption으로 이름 붙는 가로 스크롤 영역, 선택 행은 강조 배경만)과 상태 Badge(info/success/neutral/warning/danger, 보조 기호는 보조기기에서 숨김) 추가. 행 선택·상태값은 소비자가 소유한다.
- 테마 토큰 추가(neutralText, selectedSurface, infoSurface, success·warning 계열). 기존 토큰은 바꾸지 않았다.
- 검토 화면 `/`에 05(Table · Badge) 섹션 추가.

## 바뀐 파일
- client/src/shared/ui/: table/, badge/, theme.stylex.ts
- client/src/routes/: index.tsx, -table-review.tsx
