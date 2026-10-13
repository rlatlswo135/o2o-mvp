import { customers } from '@db/schemas/customers.schema.js';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { CreateCustomerDto } from './customers.schema.js';

@Injectable()
export class CustomersRepository {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async findAll() {
    const data = await this.db.select().from(customers);
    return data;
  }

  async findById(id: number) {
    const data = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id,id));
    return data;
  }

  async insert(customer: CreateCustomerDto) {
    const result = await this.db.insert(customers).values(customer).onConflictDoNothing({target:customers.phone}).returning({id:customers.id})
    return result
  }
}
