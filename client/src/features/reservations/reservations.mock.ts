import type { QueryClient } from "@tanstack/react-query";

import type { ReservationInput } from "./reservations.schema.ts";

import { dayRange } from "./reservations.time.ts";

// 서버 연결 전 가상 데이터. 이 모양을 서버 계약으로 보지 않는다.
export type Reservation = ReservationInput & {
  id: number;
  // 취소하면 원래 내용은 그대로 두고 취소 시각·사유만 채운다
  cancelledAt: number | null;
  cancelReason: string | null;
};

export type ReservationListParams = { date: string; includeCancelled: boolean };

type Operation = "list" | "create" | "update" | "cancel";

export type ReservationMock = {
  rows: Reservation[];
  nextId: number;
  delayMs: number;
  // 테스트·개발 확인용 호출 횟수. 중복 제출이 실제로 몇 번 저장소에 닿았는지 센다
  calls: Record<Operation, number>;
  // 테스트·개발 확인용 실패 주입. 남은 횟수만큼 다음 호출이 실패한다
  failNext: Record<Operation, number>;
};

// 앱의 QueryClient마다 따로 둔다. 메뉴를 옮겨도 남고 새로고침하면 빈 목록으로 돌아간다
const mocks = new WeakMap<QueryClient, ReservationMock>();

export function reservationMock(client: QueryClient): ReservationMock {
  let mock = mocks.get(client);
  if (!mock) {
    mock = {
      rows: [],
      nextId: 1,
      delayMs: 600,
      calls: { list: 0, create: 0, update: 0, cancel: 0 },
      failNext: { list: 0, create: 0, update: 0, cancel: 0 },
    };
    mocks.set(client, mock);
    // 브라우저 확인 때 콘솔에서 실패·지연을 주입한다. 배포 빌드에는 없다
    if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
      Object.assign(globalThis, { __reservationMock: mock });
    }
  }
  return mock;
}

// 그 날짜에 시작하는 예약을 시작 시각순으로. 시작이 같으면 먼저 등록한 예약이 앞이다
export function selectReservations(
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

export async function fetchReservations(
  client: QueryClient,
  params: ReservationListParams,
  signal?: AbortSignal,
): Promise<Reservation[]> {
  const mock = reservationMock(client);
  mock.calls.list += 1;
  // 요청 시점의 목록을 늦게 돌려주는 서버처럼 동작한다
  const snapshot = selectReservations(mock.rows, params).map(copy);
  await wait(mock.delayMs, signal);
  if (takeFailure(mock, "list")) throw new Error("가상 예약 목록 조회 실패");
  return snapshot;
}

export async function createReservation(
  client: QueryClient,
  input: ReservationInput,
): Promise<Reservation> {
  const mock = reservationMock(client);
  mock.calls.create += 1;
  await wait(mock.delayMs);
  if (takeFailure(mock, "create")) throw new Error("가상 예약 등록 실패");
  const reservation: Reservation = {
    ...copyInput(input),
    id: mock.nextId++,
    cancelledAt: null,
    cancelReason: null,
  };
  mock.rows.push(reservation);
  return copy(reservation);
}

export type ChangeOutcome =
  | { kind: "ok"; reservation: Reservation }
  | { kind: "not_found" }
  // 이미 취소돼 있음. 목록에 확인한 실제 상태를 반영하도록 현재 기록을 함께 준다
  | { kind: "cancelled"; reservation: Reservation };

export async function changeReservation(
  client: QueryClient,
  id: number,
  input: ReservationInput,
): Promise<ChangeOutcome> {
  const mock = reservationMock(client);
  mock.calls.update += 1;
  await wait(mock.delayMs);
  if (takeFailure(mock, "update")) throw new Error("가상 예약 수정 실패");
  // 요청을 받은 시점의 저장 상태로 판단한다
  const index = mock.rows.findIndex((row) => row.id === id);
  const current = mock.rows[index];
  if (!current) return { kind: "not_found" };
  if (current.cancelledAt !== null) return { kind: "cancelled", reservation: copy(current) };
  const next: Reservation = { ...current, ...copyInput(input) };
  mock.rows[index] = next;
  return { kind: "ok", reservation: copy(next) };
}

export async function cancelReservationRecord(
  client: QueryClient,
  id: number,
  reason: string | null,
): Promise<ChangeOutcome> {
  const mock = reservationMock(client);
  mock.calls.cancel += 1;
  await wait(mock.delayMs);
  if (takeFailure(mock, "cancel")) throw new Error("가상 예약 취소 실패");
  const index = mock.rows.findIndex((row) => row.id === id);
  const current = mock.rows[index];
  if (!current) return { kind: "not_found" };
  // 이미 취소된 예약은 처음 취소한 시각·사유를 덮어쓰지 않는다
  if (current.cancelledAt !== null) return { kind: "cancelled", reservation: copy(current) };
  const next: Reservation = { ...current, cancelledAt: Date.now(), cancelReason: reason };
  mock.rows[index] = next;
  return { kind: "ok", reservation: copy(next) };
}

function copyInput(input: ReservationInput): ReservationInput {
  return {
    customer: { ...input.customer },
    treatment: { ...input.treatment },
    startAt: input.startAt,
    endAt: input.endAt,
  };
}

function copy(reservation: Reservation): Reservation {
  return { ...reservation, ...copyInput(reservation) };
}

function takeFailure(mock: ReservationMock, operation: Operation) {
  if (mock.failNext[operation] <= 0) return false;
  mock.failNext[operation] -= 1;
  return true;
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
