import type { Customer, CustomerInput } from '@o2o/shared/contracts';

import { Injectable } from '@nestjs/common';

import { CustomersRepository } from './customers.repository.js';

// 서비스는 HTTP와 oRPC를 모른다. 결과만 돌려주고, 응답 코드로 바꾸는 일은 컨트롤러가 한다.
export type CreateCustomerResult = { kind: 'created'; customer: Customer } | { kind: 'duplicate' };

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
}
