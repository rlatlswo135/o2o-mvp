import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';

import { CustomersService } from './customers.service.js';
import { createCustomerSchema, type CreateCustomerDto } from './customers.schema.ts';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customerService: CustomersService) {}

  @Get()
  findAll() {
    return this.customerService.getCustomers();
  }

  @Get(':id')
  findOne(@Param('id',ParseIntPipe) id:number) {
    return this.customerService.getCustomerById(id);
  }

  @Post()
  create(@Body({ schema: createCustomerSchema }) createCustomerDto: CreateCustomerDto){
    return this.customerService.createCustomer(createCustomerDto)
  }
}
