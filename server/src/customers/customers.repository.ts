import { customers } from '@db/schemas/customers.schema.ts';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { CreateCustomerDto } from './customers.schema.ts';

@Injectable()
export class CustomersRepository {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  findAll() {
    const data = this.db.select().from(customers);
    return data;
  }

  findById(id: string) {
    // TODO: 체크해봐야함
    const data = this.db
      .select()
      .from(customers)
      .where(sql`id = ${id}`);
    return data;
  }

  insert(customer: CreateCustomerDto) {
    return `insert ${customer.name}`;
  }
}
