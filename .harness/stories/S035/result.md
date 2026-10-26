# S035 — 날짜를 확정해 조회하고 여러 시술 예약을 서버에 저장

## 한 일
- 예약 조회 날짜를 편집 중인 값과 분리했다. 월·연도 변경만으로 조회하지 않고 ‘조회’ 버튼이나 Enter로 확정하며, 이전 날·다음 날·오늘 이동과 뒤로·앞으로 이동도 입력값과 맞춘다.
- 예약 등록·수정에서 여러 시술을 선택하고 해제할 수 있게 했다. 선택한 시술들의 총 소요시간과 자정을 넘는 종료 일시를 계산해 폼·목록·취소 화면에 표시한다.
- 시술 등록·조회와 예약 등록·날짜별 조회·수정·취소를 공유 Zod/oRPC 계약, NestJS 서버, PostgreSQL에 연결했다. 가상 저장을 제거해 새로고침·서버 재시작 후에도 기록이 남는다.
- 서버가 시술 정보와 종료 일시를 계산하며, 기존 예약의 고객·시술 정보와 소요시간은 마스터 변경·삭제 후에도 보존한다. 수정 시 기존 시술은 당시 값을 유지하고 추가한 시술만 현재 값을 사용한다.
- 취소는 예약을 삭제하지 않고 최초 취소 시각·사유를 남긴다. 반복 취소·수정과의 경쟁에서도 취소 기록을 보존하며, 저장 결과를 알 수 없는 오류에는 재조회 확인을 안내한다.
- 인증·담당자·근무시간·예약 시간 충돌 검사는 추가하지 않았다. 겹치는 예약이 가능하다는 안내는 유지한다.

## 바뀐 파일
- `client/src/features/reservations/`, `client/src/features/treatments/`, `client/src/shared/api/api.ts`
- `shared/contracts/reservation/`, `shared/contracts/treatment/`, `shared/contracts/index.ts`
- `server/src/reservations/`, `server/src/treatments/`, `server/src/app.module.ts`
- `server/db/schemas/`, `server/db/migrations/20261026055322_workable_wrecker/`, `server/test/`

<!-- c2h:stats {"rounds":3,"max":3,"qa":false} -->

<!-- c2h:sealed 20261026T071304451000Z-3959db3eaf0f -->
