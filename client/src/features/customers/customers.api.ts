import type { Customer, CustomerInput, CustomerUpdate } from "@o2o/shared/contracts";
import type { QueryClient } from "@tanstack/react-query";

import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";

import { api } from "@/shared/api/api.ts";

export const customerQueries = {
  all: () => ["customers"] as const,
  list: () =>
    queryOptions({
      queryKey: [...customerQueries.all(), "list"],
      queryFn: ({ signal }) => api.customers.list(undefined, { signal }),
    }),
  // 없으면 NOT_FOUND로 실패
  detail: (id: number) =>
    queryOptions({
      queryKey: [...customerQueries.all(), "detail", id],
      queryFn: ({ signal }) => api.customers.get({ id }, { signal }),
    }),
};

export const customerMutationKeys = {
  all: () => [...customerQueries.all(), "mutation"] as const,
  create: () => [...customerMutationKeys.all(), "create"] as const,
  update: () => [...customerMutationKeys.all(), "update"] as const,
};

export type RegisterResult =
  | { kind: "created"; customer: Customer }
  | { kind: "duplicate" }
  | { kind: "failed" };

// 등록 후 목록 반영
export async function registerCustomer(
  queryClient: QueryClient,
  input: CustomerInput,
): Promise<RegisterResult> {
  const { error, data: customer } = await safe(api.customers.create(input));
  if (error) {
    return isDefinedError(error) && error.code === "CONFLICT"
      ? { kind: "duplicate" }
      : { kind: "failed" };
  }

  // 늦게 온 이전 조회가 덮지 않게 취소 후 반영하고 재조회
  const { queryKey } = customerQueries.list();
  await queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData(queryKey, (current) => [
    customer,
    ...(current ?? []).filter((existing) => existing.id !== customer.id),
  ]);
  await queryClient.invalidateQueries({ queryKey });
  return { kind: "created", customer };
}

export type UpdateResult =
  | { kind: "updated"; customer: Customer }
  | { kind: "duplicate" }
  | { kind: "not_found" }
  | { kind: "failed" };

// 수정 후 목록 반영, 이미 없는 고객이면 목록에서 내림
export async function updateCustomer(
  queryClient: QueryClient,
  input: CustomerUpdate,
): Promise<UpdateResult> {
  const { error, data: customer } = await safe(api.customers.update(input));
  if (error) {
    if (!isDefinedError(error)) return { kind: "failed" };
    if (error.code === "CONFLICT") return { kind: "duplicate" };
    if (error.code !== "NOT_FOUND") return { kind: "failed" };
  }

  // 늦게 온 이전 조회가 덮지 않게 취소 후 반영하고 재조회
  const { queryKey } = customerQueries.list();
  await queryClient.cancelQueries({ queryKey });
  if (customer) {
    queryClient.setQueryData(queryKey, (current) =>
      current?.map((existing) => (existing.id === customer.id ? customer : existing)),
    );
    queryClient.setQueryData(customerQueries.detail(customer.id).queryKey, customer);
  } else {
    queryClient.setQueryData(queryKey, (current) =>
      current?.filter((existing) => existing.id !== input.id),
    );
    queryClient.removeQueries({ queryKey: customerQueries.detail(input.id).queryKey });
  }
  await queryClient.invalidateQueries({ queryKey });
  return customer ? { kind: "updated", customer } : { kind: "not_found" };
}

export type DeleteResult = { kind: "deleted" } | { kind: "not_found" } | { kind: "failed" };

// 삭제 후 목록 반영, 이미 없는 고객도 목록에서 내림
export async function deleteCustomer(queryClient: QueryClient, id: number): Promise<DeleteResult> {
  const { error } = await safe(api.customers.delete({ id }));
  const notFound = isDefinedError(error) && error.code === "NOT_FOUND";
  if (error && !notFound) return { kind: "failed" };

  // 늦게 온 이전 조회가 되살리지 않게 취소 후 반영하고 재조회
  const { queryKey } = customerQueries.list();
  await queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData(queryKey, (current) =>
    current?.filter((customer) => customer.id !== id),
  );
  queryClient.removeQueries({ queryKey: customerQueries.detail(id).queryKey });
  await queryClient.invalidateQueries({ queryKey });
  return notFound ? { kind: "not_found" } : { kind: "deleted" };
}
