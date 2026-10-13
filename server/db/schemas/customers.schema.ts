import { integer, pgTable, text } from 'drizzle-orm/pg-core';

// TODO: CHECK로 phone 정규식
export const customers = pgTable('customers', {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  name: text().notNull(),
  phone: text().notNull().unique(),
});
