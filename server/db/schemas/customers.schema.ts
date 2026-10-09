import { integer, pgTable, text } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod';

export const customers = pgTable('customers', {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  name: text().notNull(),
  phone: text().notNull().unique(),
});

export const customersSchema = createSelectSchema(customers);

export const customersInsertSchema = createInsertSchema(customers).pick({
  name: true,
  phone: true,
});

export const customersUpdateSchema = createUpdateSchema(customers);
