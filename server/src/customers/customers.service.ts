import type { Customer, CustomerInput, CustomerUpdate } from '@o2o/shared/contracts';

import { Injectable } from '@nestjs/common';

import { CustomersRepository } from './customers.repository.js';

// 서비스는 HTTP와 oRPC를 모른다. 결과만 돌려주고, 응답 코드로 바꾸는 일은 컨트롤러가 한다.
export type CreateCustomerResult = { kind: 'created'; customer: Customer } | { kind: 'duplicate' };
export type DeleteCustomerResult = { kind: 'deleted' } | { kind: 'not_found' };
export type UpdateCustomerResult =
  | { kind: 'updated'; customer: Customer }
  | { kind: 'not_found' }
  | { kind: 'duplicate' };

@Injectable()
export class CustomersService {
  constructor(private readonly customers: CustomersRepository) {}

  getCustomers() {
    return this.customers.findAll();
  }

  getCustomerById(id: number) {
    return this.customers.findById(id);
  }

  async createCustomer(input: CustomerInput): Promise<CreateCustomerResult> {
    const customer = await this.customers.insert(input);
    return customer ? { kind: 'created', customer } : { kind: 'duplicate' };
  }

  async deleteCustomer(id: number): Promise<DeleteCustomerResult> {
    const deleted = await this.customers.delete(id);
    return deleted ? { kind: 'deleted' } : { kind: 'not_found' };
  }

  async updateCustomer(input: CustomerUpdate): Promise<UpdateCustomerResult> {
    const result = await this.customers.update(input);
    if (result === 'duplicate') return { kind: 'duplicate' };
    return result ? { kind: 'updated', customer: result } : { kind: 'not_found' };
  }
}
