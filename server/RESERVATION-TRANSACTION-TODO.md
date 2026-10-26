# 예약 트랜잭션 실습 TODO

예약 트랜잭션과 `tx`를 받는 저장소 쓰기 메서드 구현을 학습용 TODO로 비웠습니다. `test/reservations.e2e-spec.ts`의 검증 테스트는 그대로 두었습니다. 새 테스트를 추가하지 않고, 기존 테스트를 TDD의 검증 기준으로 사용하세요.

## TDD 순서

- [ ] `src/reservations/reservations.repository.ts` — `transaction`: `db.transaction`이 받은 `tx`를 작업 함수에 전달하고 작업 결과를 반환하도록 구현한다.
- [ ] `src/reservations/reservations.repository.ts` — `findStartingBetween`: 예약 본문과 시술 스냅샷을 같은 스냅샷으로 읽도록 `repeatable read` + `read only` 트랜잭션을 구현한다. 목록 중 동시 수정 테스트를 통과시킨다.
- [ ] `src/reservations/reservations.repository.ts` — `lock`: 예약 행을 `FOR UPDATE`로 잠그고 시술 스냅샷까지 읽는다.
- [ ] `src/reservations/reservations.repository.ts` — `insert`와 `insertTreatments`: 예약 본문과 요청 순서의 시술 스냅샷을 같은 `tx`로 저장한다.
- [ ] `src/reservations/reservations.repository.ts` — `replace`: 취소되지 않은 예약 본문을 바꾸고 기존 시술 스냅샷을 삭제한 뒤 새 스냅샷을 같은 `tx`로 저장한다.
- [ ] `src/reservations/reservations.repository.ts` — `markCancelled`: 취소되지 않은 예약만 취소 처리하고 기존 취소 시각·사유를 덮어쓰지 않는다.
- [ ] `src/reservations/reservations.service.ts` — `createReservation`: 고객·시술 검증과 본문·시술 스냅샷 저장을 하나의 트랜잭션으로 묶는다.
- [ ] `src/reservations/reservations.service.ts` — `updateReservation`: 트랜잭션 안에서 행 잠금 → 없음/취소 상태 확인 → draft 계산 → 원자적 교체 순으로 처리한다.
- [ ] `src/reservations/reservations.service.ts` — `cancelReservation`: 트랜잭션 안에서 행 잠금 후 최초 취소 기록만 남긴다.
- [ ] 기존 테스트에서 등록·수정·취소, 롤백, 동시 취소, 수정/취소 경합, 목록 스냅샷 일관성 사례가 통과하는지 확인한다.

## 실행

서버 전용 테스트 DB 설정 후 저장소 루트에서 `pnpm --dir server test:e2e`를 실행한다. 빨간 테스트를 한 번에 전부 고치기보다 위 순서대로 작은 단위로 진행한다.
