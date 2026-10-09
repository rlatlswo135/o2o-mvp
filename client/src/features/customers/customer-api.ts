import type { QueryClient } from "@tanstack/react-query";

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { api } from "@/shared/api/api.ts";

import type { CustomerInput } from "./customer.ts";

import { customerSchema } from "./customer.ts";

export const customersQueryOptions = queryOptions({
  queryKey: ["customers"],
  queryFn: ({ signal }) => api.get("customers", { signal }).json(customerSchema.array()),
  staleTime: 30_000,
  retry: false,
});

export function createCustomerMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (input: CustomerInput) =>
      api.post("customers", { json: input }).json(customerSchema),
    onSuccess: async (customer) => {
      await queryClient.cancelQueries({ queryKey: customersQueryOptions.queryKey });
      queryClient.setQueryData(customersQueryOptions.queryKey, (current) => [
        customer,
        ...(current ?? []).filter((existing) => existing.id !== customer.id),
      ]);
      await queryClient.invalidateQueries({ queryKey: customersQueryOptions.queryKey });
    },
  });
}
