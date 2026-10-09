import { Body, Injectable } from '@nestjs/common';

import type { CreateCustomerDto } from './customers.schema.ts';

import { CustomersRepository } from './customers.repository.ts';
import { createCustomerSchema } from './customers.schema.ts';

@Injectable()
export class CustomersService {
  constructor(private readonly customers: CustomersRepository) {}

  getCustomers(): string {
    return this.customers.findAll();
  }

  getCustomerById(id: string): string {
    return this.customers.findById(id);
  }

  createCustomer(@Body({ schema: createCustomerSchema }) createCustomerDto: CreateCustomerDto) {
    return this.customers.insert(createCustomerDto);
  }
}
