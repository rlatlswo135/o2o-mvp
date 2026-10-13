// oxlint-disable typescript/no-floating-promises
import { reset, seed } from 'drizzle-seed';

import { db } from '../index.js';
import { customers } from '../schemas/customers.schema.js';

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
