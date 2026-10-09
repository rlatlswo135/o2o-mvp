import { Controller, Get, Param, Req } from '@nestjs/common';

import { CustomersService } from './customers.service.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customerService: CustomersService) {}

  @Get()
  findAll(): string {
    return this.customerService.getCustomers();
  }

  @Get(':id')
  findOne(@Param() params: { id: string }): string {
    console.log(params);
    return this.customerService.getCustomerById(params.id);
  }
}
