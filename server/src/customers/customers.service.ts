import { Injectable } from "@nestjs/common";

@Injectable()
export class CustomersService {
  getCustomers(): string {
    return 'Hello, customers!';
  }

  getCustomerById(id: string): string {
    return `Hello, customer ${id}!`;
  }
}
