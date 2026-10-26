import type { Reservation, ReservationInput, ReservationRejection } from "@o2o/shared/contracts";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";

import { api, isRejection } from "@/shared/api/api.ts";

import type { CancelInput } from "./reservations.schema.ts";

import { customerQueries } from "../customers/customers.api.ts";
import { treatmentQueries } from "../treatments/treatments.api.ts";
import { dayRange } from "./reservations.time.ts";

export type ReservationListParams = { date: string; includeCancelled: boolean };

export const reservationQueries = {
  all: () => ["reservations"] as const,
  lists: () => [...reservationQueries.all(), "list"] as const,
  list: ({ date, includeCancelled }: ReservationListParams) =>
    queryOptions({
      queryKey: [...reservationQueries.lists(), date, includeCancelled],
      // 쿼리 문자열이라 계약은 "true"/"false"를 받는다
      queryFn: ({ signal }) =>
        api.reservations.list({ date, includeCancelled: String(includeCancelled) }, { signal }),
    }),
};

export const reservationMutationKeys = {
  all: () => [...reservationQueries.all(), "mutation"] as const,
  create: () => [...reservationMutationKeys.all(), "create"] as const,
  update: () => [...reservationMutationKeys.all(), "update"] as const,
  cancel: () => [...reservationMutationKeys.all(), "cancel"] as const,
};

function listParams(queryKey: QueryKey): ReservationListParams | null {
  const [, , date, includeCancelled] = queryKey;
  return typeof date === "string" && typeof includeCancelled === "boolean"
    ? { date, includeCancelled }
    : null;
}

// 서버 목록과 같은 규칙: 그 날짜에 시작한 예약, 시작 시각순, 같으면 ID순
function selectReservations(
  rows: ReadonlyArray<Reservation>,
  { date, includeCancelled }: ReservationListParams,
): Reservation[] {
  const range = dayRange(date);
  if (!range) return [];
  return rows
    .filter(
      (row) =>
        row.startAt >= range.from &&
        row.startAt < range.to &&
        (includeCancelled || row.cancelledAt === null),
    )
    .toSorted((a, b) => a.startAt - b.startAt || a.id - b.id);
}

type ListChange = { upsert: Reservation } | { remove: number } | null;

// 늦게 온 이전 조회가 덮지 않게 취소한 뒤, 불러온 모든 날짜·취소 포함 목록에 결과를 반영하고 재조회한다.
// 재조회에 실패한 목록이 있으면 false. 확인한 결과는 캐시에 이미 반영돼 있어 재조회가 실패해도 되돌리지 않는다
async function refreshLists(queryClient: QueryClient, change: ListChange): Promise<boolean> {
  const filters = { queryKey: reservationQueries.lists() };
  await queryClient.cancelQueries(filters);
  if (change) {
    const id = "upsert" in change ? change.upsert.id : change.remove;
    for (const query of queryClient.getQueryCache().findAll(filters)) {
      const params = listParams(query.queryKey);
      if (!params) continue;
      queryClient.setQueryData<Reservation[]>(query.queryKey, (current) => {
        if (!current) return current;
        const others = current.filter((row) => row.id !== id);
        return selectReservations("upsert" in change ? [...others, change.upsert] : others, params);
      });
    }
  }
  await queryClient.invalidateQueries(filters);
  return queryClient
    .getQueryCache()
    .findAll(filters)
    .every((query) => query.state.status !== "error");
}

// 서버가 확정한 거부의 사유. invalid_treatments·invalid는 형식 확인(400)에서 온다
export type RejectionReason = ReservationRejection["reason"] | "invalid_treatments" | "invalid";

// 저장 요청의 실패를 확정된 거부와 결과 불명으로 나눈다. 결과 불명은 반영됐을 수도 있어 목록만 다시 불러온다
function rejectionOf(
  queryClient: QueryClient,
  error: unknown,
): { kind: "rejected"; reason: RejectionReason } | { kind: "unknown" } {
  if (!isRejection(error)) {
    void refreshLists(queryClient, null);
    return { kind: "unknown" };
  }
  if (error.code === "UNPROCESSABLE_CONTENT") {
    const { reason } = error.data as ReservationRejection;
    // 고를 수 없는 선택지가 남지 않게 그 목록을 다시 불러온다
    if (reason === "customer_not_found") {
      void queryClient.invalidateQueries({ queryKey: customerQueries.list().queryKey });
    }
    if (reason === "treatment_not_found") {
      void queryClient.invalidateQueries({ queryKey: treatmentQueries.list().queryKey });
    }
    return { kind: "rejected", reason };
  }
  const issues = (error.data as { issues?: Array<{ path?: unknown[] }> } | undefined)?.issues;
  const aboutTreatments = issues?.some((issue) => issue.path?.[0] === "treatmentIds");
  return { kind: "rejected", reason: aboutTreatments ? "invalid_treatments" : "invalid" };
}

export type RegisterReservationResult =
  | { kind: "created"; reservation: Reservation }
  | { kind: "rejected"; reason: RejectionReason }
  | { kind: "unknown" };

// 등록 후 목록 반영. 생성 요청은 자동으로 다시 보내지 않는다(중복 저장 방지)
export async function registerReservation(
  queryClient: QueryClient,
  input: ReservationInput,
): Promise<RegisterReservationResult> {
  const { error, data: reservation } = await safe(api.reservations.create(input));
  if (error) return rejectionOf(queryClient, error);
  await refreshLists(queryClient, { upsert: reservation });
  return { kind: "created", reservation };
}

export type UpdateReservationResult =
  | { kind: "updated"; reservation: Reservation }
  | { kind: "not_found"; refreshed: boolean }
  // 이미 취소됨. 서버가 확인한 예약(처음 취소한 시각·사유)을 함께 준다
  | { kind: "cancelled"; reservation: Reservation; refreshed: boolean }
  | { kind: "rejected"; reason: RejectionReason }
  | { kind: "unknown" };

// 수정 후 목록 반영. 이미 없거나 취소된 예약은 덮어쓰지 않고 확인한 실제 상태를 목록에 반영한다
export async function updateReservation(
  queryClient: QueryClient,
  id: number,
  input: ReservationInput,
): Promise<UpdateReservationResult> {
  const { error, data: reservation } = await safe(api.reservations.update({ id, ...input }));
  if (!error) {
    await refreshLists(queryClient, { upsert: reservation });
    return { kind: "updated", reservation };
  }
  if (isDefinedError(error) && error.code === "NOT_FOUND") {
    return { kind: "not_found", refreshed: await refreshLists(queryClient, { remove: id }) };
  }
  if (isDefinedError(error) && error.code === "CONFLICT") {
    const cancelled = error.data.reservation;
    return {
      kind: "cancelled",
      reservation: cancelled,
      refreshed: await refreshLists(queryClient, { upsert: cancelled }),
    };
  }
  return rejectionOf(queryClient, error);
}

export type CancelReservationResult =
  | { kind: "cancelled"; reservation: Reservation }
  | { kind: "already_cancelled"; reservation: Reservation; refreshed: boolean }
  | { kind: "not_found"; refreshed: boolean }
  | { kind: "rejected" }
  | { kind: "unknown" };

// 취소 후 목록 반영. 이미 취소된 예약의 처음 취소 기록은 그대로 둔다
export async function cancelReservation(
  queryClient: QueryClient,
  id: number,
  { reason }: CancelInput,
): Promise<CancelReservationResult> {
  const { error, data: reservation } = await safe(api.reservations.cancel({ id, reason }));
  if (!error) {
    await refreshLists(queryClient, { upsert: reservation });
    return { kind: "cancelled", reservation };
  }
  if (isDefinedError(error) && error.code === "NOT_FOUND") {
    return { kind: "not_found", refreshed: await refreshLists(queryClient, { remove: id }) };
  }
  if (isDefinedError(error) && error.code === "CONFLICT") {
    const cancelled = error.data.reservation;
    return {
      kind: "already_cancelled",
      reservation: cancelled,
      refreshed: await refreshLists(queryClient, { upsert: cancelled }),
    };
  }
  if (isRejection(error)) return { kind: "rejected" };
  void refreshLists(queryClient, null);
  return { kind: "unknown" };
}
