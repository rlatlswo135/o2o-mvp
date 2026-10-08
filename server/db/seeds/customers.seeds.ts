   import { seed } from 'drizzle-seed';
   import { db } from '../index.js';
   import { customers } from '../schemas/customers.schema.js';

   export async function main(){
   await seed(db, { customers }).refine((f) => ({
     customers: {
       count: 15,
       columns: {
         name: f.fullName(),
         phone: f.phoneNumber(),
       },
     },
   }));
   }

   // oxlint-disable-next-line typescript/no-floating-promises
   main()
