import { Injectable } from '@nestjs/common';

import type { CreateCustomerDto } from './customers.schema.ts';

@Injectable()
export class CustomersRepository {
  findAll() {
    return 'customer findAll';
  }

  findById(id: string) {
    return `customer - ${id}`;
  }

  insert(customer: CreateCustomerDto) {
    return `insert ${customer.name}`;
  }
}
