import { integer, pgTable, text } from 'drizzle-orm/pg-core';

export const customers = pgTable('customers', {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  name: text().notNull(),
  phone: text().notNull().unique(),
});
