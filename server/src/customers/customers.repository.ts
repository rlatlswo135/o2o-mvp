import type { Customer, CustomerInput } from '@o2o/shared/contracts';

import { customers } from '@db/schemas/customers.schema.js';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class CustomersRepository {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  /** 최근 등록순. 순서는 시각이 아니라 id로 정한다. */
  findAll(): Promise<Customer[]> {
    return this.db.select().from(customers).orderBy(desc(customers.id));
  }

  async findById(id: number): Promise<Customer | undefined> {
    const [customer] = await this.db.select().from(customers).where(eq(customers.id, id)).limit(1);
    return customer;
  }

  /** 같은 전화번호가 이미 있으면 저장하지 않고 undefined를 돌려준다. */
  async insert(input: CustomerInput): Promise<Customer | undefined> {
    const [customer] = await this.db
      .insert(customers)
      .values(input)
      .onConflictDoNothing({ target: customers.phone })
      .returning();
    return customer;
  }
}
