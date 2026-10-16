import type { Customer, CustomerInput, CustomerUpdate } from '@o2o/shared/contracts';

import { customers } from '@db/schemas/customers.schema.js';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { isUniqueViolation } from '@/shared/errors/postgres-error.js';

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

  /** 지운 행이 있으면 true. 없는 id는 오류가 아니라 rowCount 0으로 끝난다. */
  async delete(id: number): Promise<boolean> {
    const result = await this.db.delete(customers).where(eq(customers.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /** 없는 id면 undefined, 다른 고객이 이미 쓰는 전화번호면 'duplicate'를 돌려준다. */
  async update({ id, ...values }: CustomerUpdate): Promise<Customer | 'duplicate' | undefined> {
    try {
      const [customer] = await this.db
        .update(customers)
        .set(values)
        .where(eq(customers.id, id))
        .returning();
      return customer;
    } catch (error) {
      if (isUniqueViolation(error)) return 'duplicate';
      throw error;
    }
  }
}
