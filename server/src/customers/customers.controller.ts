import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import type { CreateCustomerDto } from './customers.schema.js';

import { createCustomerSchema, customerIdSchema } from './customers.schema.js';
import { CustomersService } from './customers.service.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customerService: CustomersService) {}

  @Get()
  findAll() {
    return this.customerService.getCustomers();
  }

  @Get(':id')
  findOne(@Param('id', { schema: customerIdSchema }) id: number) {
    return this.customerService.getCustomerById(id);
  }

  @Post()
  create(@Body({ schema: createCustomerSchema }) input: CreateCustomerDto) {
    return this.customerService.createCustomer(input);
  }
}
