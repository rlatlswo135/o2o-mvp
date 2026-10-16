import type { Customer, CustomerInput } from "@o2o/shared/contracts";
import type { QueryClient } from "@tanstack/react-query";

import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";

import { api } from "@/shared/api/api.ts";

export const customerQueries = {
  /** 고객 관련 쿼리 전체를 가리키는 부분 키. 일괄 무효화용. */
  all: () => ["customers"] as const,
  list: () =>
    queryOptions({
      queryKey: [...customerQueries.all(), "list"],
      queryFn: ({ signal }) => api.customers.list(undefined, { signal }),
    }),
  /** 고객 한 명. 없는 고객이면 NOT_FOUND로 실패한다(`error instanceof ORPCError && error.code === "NOT_FOUND"`). */
  detail: (id: number) =>
    queryOptions({
      queryKey: [...customerQueries.all(), "detail", id],
      queryFn: ({ signal }) => api.customers.get({ id }, { signal }),
    }),
};

export type RegisterResult =
  | { kind: "created"; customer: Customer }
  | { kind: "duplicate" }
  | { kind: "failed" };

/**
 * 고객 등록 한 건. 저장 → 목록 반영까지 하고 결과만 돌려준다.
 * 입력은 customerInputSchema를 통과한 값이어야 하며, 실패하면 목록 캐시를 그대로 둔다.
 */
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

  // 진행 중이던 이전 조회가 새 고객을 덮지 못하게 취소한 뒤 반영하고 서버 순서로 다시 맞춘다.
  const { queryKey } = customerQueries.list();
  await queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData(queryKey, (current) => [
    customer,
    ...(current ?? []).filter((existing) => existing.id !== customer.id),
  ]);
  await queryClient.invalidateQueries({ queryKey });
  return { kind: "created", customer };
}

export type DeleteResult = { kind: "deleted" } | { kind: "not_found" } | { kind: "failed" };

/**
 * 고객 삭제 한 건. 삭제 → 목록 반영까지 하고 결과만 돌려준다.
 * 이미 없는 고객(NOT_FOUND)도 서버에 없기는 마찬가지라 목록에서 내린다. 그 밖의 실패는 캐시를 그대로 둔다.
 */
export async function deleteCustomer(queryClient: QueryClient, id: number): Promise<DeleteResult> {
  const { error } = await safe(api.customers.delete({ id }));
  const notFound = isDefinedError(error) && error.code === "NOT_FOUND";
  if (error && !notFound) return { kind: "failed" };

  // 진행 중이던 이전 조회가 지운 고객을 되살리지 못하게 취소한 뒤 반영하고 서버 순서로 다시 맞춘다.
  const { queryKey } = customerQueries.list();
  await queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData(queryKey, (current) =>
    current?.filter((customer) => customer.id !== id),
  );
  queryClient.removeQueries({ queryKey: customerQueries.detail(id).queryKey });
  await queryClient.invalidateQueries({ queryKey });
  return notFound ? { kind: "not_found" } : { kind: "deleted" };
}
