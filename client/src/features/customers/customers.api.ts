import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";
import { isHTTPError } from "ky";

import { api } from "@/shared/api/api.ts";

import type { Customer, CustomerInput } from "./customers.schema.ts";

import { customerSchema } from "./customers.schema.ts";

export const customerQueries = {
  /** 고객 관련 쿼리 전체를 가리키는 부분 키. 일괄 무효화용. */
  all: () => ["customers"] as const,
  list: () =>
    queryOptions({
      queryKey: [...customerQueries.all(), "list"],
      queryFn: ({ signal }) => api.get("customers", { signal }).json(customerSchema.array()),
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
  let customer: Customer;
  try {
    customer = await api.post("customers", { json: input }).json(customerSchema);
  } catch (error) {
    return isHTTPError(error) && error.response.status === 409
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
