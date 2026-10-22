import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import type { Treatment } from "./treatments.mock.ts";
import type { TreatmentInput } from "./treatments.schema.ts";

import { createTreatment, fetchTreatments } from "./treatments.mock.ts";

export const treatmentQueries = {
  all: () => ["treatments"] as const,
  list: () =>
    queryOptions({
      queryKey: [...treatmentQueries.all(), "list"],
      queryFn: ({ client, signal }) => fetchTreatments(client, signal),
    }),
};

export const treatmentMutationKeys = {
  all: () => [...treatmentQueries.all(), "mutation"] as const,
  create: () => [...treatmentMutationKeys.all(), "create"] as const,
};

export type RegisterTreatmentResult =
  | { kind: "created"; treatment: Treatment }
  | { kind: "failed" };

// 등록 후 목록 반영. 성공한 항목만 목록에 넣는다
export async function registerTreatment(
  queryClient: QueryClient,
  input: TreatmentInput,
): Promise<RegisterTreatmentResult> {
  let treatment: Treatment;
  try {
    treatment = await createTreatment(queryClient, input);
  } catch {
    return { kind: "failed" };
  }

  // 늦게 온 이전 조회가 덮지 않게 취소 후 반영하고 재조회
  const { queryKey } = treatmentQueries.list();
  await queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData(queryKey, (current) => [
    treatment,
    ...(current ?? []).filter((existing) => existing.id !== treatment.id),
  ]);
  await queryClient.invalidateQueries({ queryKey });
  return { kind: "created", treatment };
}
