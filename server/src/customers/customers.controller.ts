import { Controller } from '@nestjs/common';
import { contract } from '@o2o/shared/contracts';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';

import { CustomersService } from './customers.service.js';

// 경로, 입력 검증, 응답 모양, 오류 종류는 @o2o/shared/contracts의 contract가 정한다.
// 컨트롤러는 서비스 결과를 계약의 오류로 바꾸는 일만 한다.
@Controller()
export class CustomersController {
  constructor(private readonly customerService: CustomersService) {}

  @Implement(contract.customers)
  customers() {
    return {
      list: implement(contract.customers.list).handler(() => this.customerService.getCustomers()),
      get: implement(contract.customers.get).handler(async ({ input, errors }) => {
        const customer = await this.customerService.getCustomerById(input.id);
        if (!customer) throw errors.NOT_FOUND();
        return customer;
      }),
      create: implement(contract.customers.create).handler(async ({ input, errors }) => {
        const result = await this.customerService.createCustomer(input);
        if (result.kind === 'duplicate') throw errors.CONFLICT();
        return result.customer;
      }),
      delete: implement(contract.customers.delete).handler(async ({ input, errors }) => {
        const result = await this.customerService.deleteCustomer(input.id);
        if (result.kind === 'not_found') throw errors.NOT_FOUND();
      }),
      update: implement(contract.customers.update).handler(async ({ input, errors }) => {
        const result = await this.customerService.updateCustomer(input);
        if (result.kind === 'not_found') throw errors.NOT_FOUND();
        if (result.kind === 'duplicate') throw errors.CONFLICT();
        return result.customer;
      }),
    };
  }
}
