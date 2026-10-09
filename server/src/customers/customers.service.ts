import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { CreateCustomerDto } from './customers.schema.js';

import { CustomersRepository } from './customers.repository.js';

@Injectable()
export class CustomersService {
  constructor(private readonly customers: CustomersRepository) {}

  getCustomers() {
    return this.customers.findAll();
  }

  async getCustomerById(id: number) {
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundException('고객을 찾을 수 없어요.');
    return customer;
  }

  async createCustomer(createCustomerDto: CreateCustomerDto) {
    const customer = await this.customers.insert(createCustomerDto);
    if (!customer) throw new ConflictException('이미 등록된 전화번호예요.');
    return customer;
  }
}
