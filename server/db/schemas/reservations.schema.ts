import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

// 고객·시술은 예약 당시 값(스냅샷)으로 저장한다. 마스터를 바꾸거나 지워도 과거 예약은 그대로다.
// 그래서 customer_id·treatment_id에는 외래 키를 걸지 않는다. 걸면 고객 삭제가 막히거나(restrict) 예약까지 지워진다(cascade).
// id는 identity라 다시 쓰이지 않으므로 '같은 고객·시술을 유지'하는 수정을 id로 판단할 수 있다.
export const reservations = pgTable(
  'reservations',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    customerId: integer().notNull(),
    customerName: text().notNull(),
    customerPhone: text().notNull(),
    startAt: timestamp({ withTimezone: true }).notNull(),
    endAt: timestamp({ withTimezone: true }).notNull(),
    // 처음 취소한 시각·사유. 한 번 채우면 덮어쓰지 않는다
    cancelledAt: timestamp({ withTimezone: true }),
    cancelReason: text(),
  },
  (table) => [
    check('reservations_end_after_start', sql`${table.endAt} > ${table.startAt}`),
    check(
      'reservations_reason_only_when_cancelled',
      sql`${table.cancelReason} is null or ${table.cancelledAt} is not null`,
    ),
    // 날짜별 조회: 한국 시간 그날 0시 이상 다음 날 0시 미만에 시작한 예약을 시작 시각·id 순으로
    index('reservations_start_at_id_idx').on(table.startAt, table.id),
  ],
);

// 예약에 담긴 시술의 예약 당시 이름·소요시간. position은 요청에 담긴 순서다
export const reservationTreatments = pgTable(
  'reservation_treatments',
  {
    reservationId: integer()
      .notNull()
      .references(() => reservations.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    treatmentId: integer().notNull(),
    name: text().notNull(),
    duration: bigint({ mode: 'number' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.reservationId, table.position] }),
    unique('reservation_treatments_reservation_treatment_unique').on(
      table.reservationId,
      table.treatmentId,
    ),
    check(
      'reservation_treatments_duration_range',
      sql`${table.duration} between 1 and 9007199254740991`,
    ),
  ],
);
