import { Injectable } from '@nestjs/common';

import type { CreateCustomerDto } from './customers.schema.js';

import { CustomersRepository } from './customers.repository.js';

@Injectable()
export class CustomersService {
  constructor(private readonly customers: CustomersRepository) {}

  getCustomers() {
    return this.customers.findAll();
  }

  getCustomerById(id: number) {
    return this.customers.findById(id);
  }

  createCustomer(createCustomerDto: CreateCustomerDto) {
    return this.customers.insert(createCustomerDto);
  }
}
