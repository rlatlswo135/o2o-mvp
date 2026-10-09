import { Injectable } from '@nestjs/common';

@Injectable()
export class CustomersRepository {
  findAll() {
    return 'customer findAll';
  }

  findById(id: string) {
    return `customer - ${id}`;
  }
}
