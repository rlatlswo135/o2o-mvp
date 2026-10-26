import { sql } from 'drizzle-orm';
import { bigint, check, integer, pgTable, text } from 'drizzle-orm/pg-core';

// 분·원은 @o2o/shared/contracts의 treatmentInputSchema처럼 JS 안전 정수까지 받는다.
// integer(32bit)로는 유효한 값이 넘치므로 bigint로 저장하고, number로 읽어도 정확하도록 상한을 제약으로 건다.
export const treatments = pgTable(
  'treatments',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    name: text().notNull(),
    duration: bigint({ mode: 'number' }).notNull(),
    price: bigint({ mode: 'number' }).notNull(),
  },
  (table) => [
    check('treatments_name_not_blank', sql`btrim(${table.name}) <> ''`),
    check('treatments_duration_range', sql`${table.duration} between 1 and 9007199254740991`),
    check('treatments_price_range', sql`${table.price} between 0 and 9007199254740991`),
  ],
);
