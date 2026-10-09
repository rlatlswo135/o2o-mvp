// oxlint-disable typescript/no-floating-promises
import { reset, seed } from 'drizzle-seed';

import { db } from '../index.ts';
import { customers } from '../schemas/customers.schema.ts';

export async function main() {
  await reset(db, { customers });
  await seed(db, { customers }).refine((f) => ({
    customers: {
      count: 15,
      columns: {
        name: f.fullName(),
        phone: f.phoneNumber({ template: '###########' }),
      },
    },
  }));
}

main();
