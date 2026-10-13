import { queryOptions } from "@tanstack/react-query";

import { api } from "@/shared/api/api.ts";

import type { CustomerInput } from "./customer.ts";

import { customerSchema } from "./customer.ts";

export const customersQueryOptions = queryOptions({
  queryKey: ["customers"],
  queryFn: ({ signal }) => api.get("customers", { signal }).json(customerSchema.array()),
  staleTime: 30_000,
  retry: false,
});

export function postCustomer(input: CustomerInput) {
  return api.post("customers", { json: input }).json(customerSchema);
}
