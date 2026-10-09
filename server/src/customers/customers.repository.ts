import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { desc, eq } from 'drizzle-orm';

import type { CreateCustomerDto } from './customers.schema.js';

import { customers } from '../../db/schemas/customers.schema.js';

type Customer = typeof customers.$inferSelect;

@Injectable()
export class CustomersRepository {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  findAll() {
    return this.db.select().from(customers).orderBy(desc(customers.id));
  }

  async findById(id: number): Promise<Customer | undefined> {
    const [customer] = await this.db.select().from(customers).where(eq(customers.id, id)).limit(1);
    return customer;
  }

  async insert(customer: CreateCustomerDto): Promise<Customer | undefined> {
    const [created] = await this.db
      .insert(customers)
      .values(customer)
      .onConflictDoNothing({ target: customers.phone })
      .returning();
    return created;
  }
}
