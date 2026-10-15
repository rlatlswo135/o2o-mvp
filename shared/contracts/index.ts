import { customersContract } from "./customers.contract.ts";

/** client와 server가 함께 쓰는 HTTP 계약. 도메인 계약을 여기서 모은다. */
export const contract = {
  customers: customersContract,
};

export { customerInputSchema } from "./customers.schema.ts";
export type { Customer, CustomerInput } from "./customers.schema.ts";
