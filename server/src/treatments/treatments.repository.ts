import type { Treatment, TreatmentInput } from '@o2o/shared/contracts';

import { treatments } from '@db/schemas/treatments.schema.js';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class TreatmentsRepository {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  findAll(): Promise<Treatment[]> {
    return this.db.select().from(treatments).orderBy(desc(treatments.id));
  }

  async insert(input: TreatmentInput): Promise<Treatment> {
    const [treatment] = await this.db.insert(treatments).values(input).returning();
    if (!treatment) throw new Error('시술을 저장했지만 저장한 행을 돌려받지 못했어요.');
    return treatment;
  }
}
