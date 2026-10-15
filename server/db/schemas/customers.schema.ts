import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text } from 'drizzle-orm/pg-core';

// 전화번호는 하이픈과 공백을 지운 숫자 8~15자리로 저장한다(@o2o/shared/contracts의 customerInputSchema와 같은 규칙).
export const customers = pgTable(
  'customers',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    name: text().notNull(),
    phone: text().notNull().unique(),
  },
  (table) => [check('customers_phone_digits', sql`${table.phone} ~ '^[0-9]{8,15}$'`)],
);
