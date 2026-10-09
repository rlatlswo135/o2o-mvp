import { Injectable } from '@nestjs/common';

import { CustomersRepository } from './customers.repository.js';

@Injectable()
export class CustomersService {
  constructor(private readonly customers: CustomersRepository) {}

  getCustomers(): string {
    return this.customers.findAll();
  }

  getCustomerById(id: string): string {
    return this.customers.findById(id);
  }
}
