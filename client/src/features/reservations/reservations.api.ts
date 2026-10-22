import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import type { Reservation, ReservationListParams } from "./reservations.mock.ts";
import type { CancelInput, ReservationInput } from "./reservations.schema.ts";

import {
  cancelReservationRecord,
  changeReservation,
  createReservation,
  fetchReservations,
  selectReservations,
} from "./reservations.mock.ts";

export const reservationQueries = {
  all: () => ["reservations"] as const,
  lists: () => [...reservationQueries.all(), "list"] as const,
  list: (params: ReservationListParams) =>
    queryOptions({
      queryKey: [...reservationQueries.lists(), params.date, params.includeCancelled],
      queryFn: ({ client, signal }) => fetchReservations(client, params, signal),
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

type ListChange = { upsert: Reservation } | { remove: number };

// 늦게 온 이전 조회가 덮지 않게 취소한 뒤, 불러온 모든 날짜·취소 포함 목록에 결과를 반영하고 재조회한다.
// 재조회에 실패한 목록이 있으면 false. 확인한 결과는 캐시에 이미 반영돼 있다
async function refreshLists(queryClient: QueryClient, change: ListChange): Promise<boolean> {
  const filters = { queryKey: reservationQueries.lists() };
  await queryClient.cancelQueries(filters);
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
  await queryClient.invalidateQueries(filters);
  return queryClient
    .getQueryCache()
    .findAll(filters)
    .every((query) => query.state.status !== "error");
}

export type RegisterReservationResult =
  | { kind: "created"; reservation: Reservation }
  | { kind: "failed" };

// 등록 후 목록 반영. 성공한 예약만 목록에 넣는다
export async function registerReservation(
  queryClient: QueryClient,
  input: ReservationInput,
): Promise<RegisterReservationResult> {
  let reservation: Reservation;
  try {
    reservation = await createReservation(queryClient, input);
  } catch {
    return { kind: "failed" };
  }
  await refreshLists(queryClient, { upsert: reservation });
  return { kind: "created", reservation };
}

export type UpdateReservationResult =
  | { kind: "updated"; reservation: Reservation }
  | { kind: "not_found"; refreshed: boolean }
  | { kind: "cancelled"; refreshed: boolean }
  | { kind: "failed" };

// 수정 후 목록 반영. 이미 없거나 취소된 예약은 덮어쓰지 않고 확인한 실제 상태를 목록에 반영한다
export async function updateReservation(
  queryClient: QueryClient,
  id: number,
  input: ReservationInput,
): Promise<UpdateReservationResult> {
  let outcome: Awaited<ReturnType<typeof changeReservation>>;
  try {
    outcome = await changeReservation(queryClient, id, input);
  } catch {
    return { kind: "failed" };
  }
  switch (outcome.kind) {
    case "ok":
      await refreshLists(queryClient, { upsert: outcome.reservation });
      return { kind: "updated", reservation: outcome.reservation };
    case "not_found":
      return { kind: "not_found", refreshed: await refreshLists(queryClient, { remove: id }) };
    case "cancelled":
      return {
        kind: "cancelled",
        refreshed: await refreshLists(queryClient, { upsert: outcome.reservation }),
      };
  }
}

export type CancelReservationResult =
  | { kind: "cancelled"; reservation: Reservation }
  | { kind: "already_cancelled"; refreshed: boolean }
  | { kind: "not_found"; refreshed: boolean }
  | { kind: "failed" };

// 취소 후 목록 반영. 이미 취소된 예약의 최초 취소 기록은 그대로 둔다
export async function cancelReservation(
  queryClient: QueryClient,
  id: number,
  { reason }: CancelInput,
): Promise<CancelReservationResult> {
  let outcome: Awaited<ReturnType<typeof cancelReservationRecord>>;
  try {
    outcome = await cancelReservationRecord(queryClient, id, reason);
  } catch {
    return { kind: "failed" };
  }
  switch (outcome.kind) {
    case "ok":
      await refreshLists(queryClient, { upsert: outcome.reservation });
      return { kind: "cancelled", reservation: outcome.reservation };
    case "not_found":
      return { kind: "not_found", refreshed: await refreshLists(queryClient, { remove: id }) };
    case "cancelled":
      return {
        kind: "already_cancelled",
        refreshed: await refreshLists(queryClient, { upsert: outcome.reservation }),
      };
  }
}
