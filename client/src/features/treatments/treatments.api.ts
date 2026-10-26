import type { Treatment, TreatmentInput } from "@o2o/shared/contracts";
import type { QueryClient } from "@tanstack/react-query";

import { safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";

import { api, fieldIssuesOf, isRejection } from "@/shared/api/api.ts";

export const treatmentQueries = {
  all: () => ["treatments"] as const,
  list: () =>
    queryOptions({
      queryKey: [...treatmentQueries.all(), "list"],
      queryFn: ({ signal }) => api.treatments.list(undefined, { signal }),
    }),
};

export const treatmentMutationKeys = {
  all: () => [...treatmentQueries.all(), "mutation"] as const,
  create: () => [...treatmentMutationKeys.all(), "create"] as const,
};

export const treatmentFieldNames = ["name", "duration", "price"] as const;

export type TreatmentFieldErrors = Partial<Record<(typeof treatmentFieldNames)[number], string>>;

export type RegisterTreatmentResult =
  | { kind: "created"; treatment: Treatment }
  // 서버가 거부했다. 칸을 알면 errors에 담는다
  | { kind: "rejected"; errors: TreatmentFieldErrors }
  // 저장됐을 수도 있다. 다시 보내지 않고 목록만 다시 불러온다
  | { kind: "unknown" };

// 등록 후 목록 반영. 성공한 항목만 목록에 넣는다
export async function registerTreatment(
  queryClient: QueryClient,
  input: TreatmentInput,
): Promise<RegisterTreatmentResult> {
  const { queryKey } = treatmentQueries.list();
  const { error, data: treatment } = await safe(api.treatments.create(input));
  if (error) {
    if (isRejection(error)) {
      return { kind: "rejected", errors: fieldIssuesOf(error, treatmentFieldNames) };
    }
    void queryClient.invalidateQueries({ queryKey });
    return { kind: "unknown" };
  }

  // 늦게 온 이전 조회가 덮지 않게 취소 후 반영하고 재조회
  await queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData(queryKey, (current) => [
    treatment,
    ...(current ?? []).filter((existing) => existing.id !== treatment.id),
  ]);
  await queryClient.invalidateQueries({ queryKey });
  return { kind: "created", treatment };
}
