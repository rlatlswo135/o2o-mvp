import type { QueryClient } from "@tanstack/react-query";

import { mutationOptions } from "@tanstack/react-query";
import { isHTTPError } from "ky";

import type {
  Customer,
  CustomerFieldErrors,
  CustomerInput,
  CustomerListQuery,
} from "./customer.ts";

import { customersQueryOptions, postCustomer } from "./customer-api.ts";
import { validateCustomerInput } from "./customer.ts";

type CustomersQueryState = {
  data: ReadonlyArray<Customer> | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
};

/** 목록 query 상태를 화면 상태로 옮긴다. 첫 응답 전·재시도 중에는 비어 있다고 단정하지 않는다. */
export function toListQuery({
  data,
  isPending,
  isFetching,
  isError,
}: CustomersQueryState): CustomerListQuery {
  if (isPending || (isFetching && data === undefined)) return { kind: "loading" };
  if (isError) return { kind: "failed" };
  return data === undefined ? { kind: "loading" } : { kind: "loaded", customers: data };
}

export type RegisterResult =
  | { kind: "created"; customer: Customer }
  | { kind: "invalid"; errors: CustomerFieldErrors }
  | { kind: "duplicate" }
  | { kind: "failed" };

/**
 * 고객 등록 한 건. 입력 확인 → 저장 → 목록 반영까지 하고 결과만 돌려준다.
 * 확인에 걸리면 서버로 보내지 않고, 실패하면 목록 캐시를 그대로 둔다.
 */
export async function registerCustomer(
  queryClient: QueryClient,
  input: CustomerInput,
): Promise<RegisterResult> {
  const validation = validateCustomerInput(input);
  if (!validation.ok) return { kind: "invalid", errors: validation.errors };

  let customer: Customer;
  try {
    customer = await postCustomer(validation.value);
  } catch (error) {
    return isHTTPError(error) && error.response.status === 409
      ? { kind: "duplicate" }
      : { kind: "failed" };
  }

  // 진행 중이던 이전 조회가 새 고객을 덮지 못하게 취소한 뒤 반영하고 서버 순서로 다시 맞춘다.
  await queryClient.cancelQueries({ queryKey: customersQueryOptions.queryKey });
  queryClient.setQueryData(customersQueryOptions.queryKey, (current) => [
    customer,
    ...(current ?? []).filter((existing) => existing.id !== customer.id),
  ]);
  await queryClient.invalidateQueries({ queryKey: customersQueryOptions.queryKey });
  return { kind: "created", customer };
}

export function registerCustomerMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (input: CustomerInput) => registerCustomer(queryClient, input),
  });
}
