import { customersContract } from "./customer/customers.contract.ts";

/** client와 server가 함께 쓰는 HTTP 계약. 도메인 계약을 여기서 모은다. */
export const contract = {
  customers: customersContract,
};

export * from "./customer/customers.schema.ts";
