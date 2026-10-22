import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveListState } from "@/shared/ui/data-table/data-table.state.ts";

import type { Reservation, ReservationListParams } from "./reservations.mock.ts";
import type { ReservationChoices, ReservationFormValues } from "./reservations.schema.ts";

import {
  cancelReservation,
  registerReservation,
  reservationMutationKeys,
  reservationQueries,
  updateReservation,
} from "./reservations.api.ts";
import { reservationMock } from "./reservations.mock.ts";
import { cancelInputSchema, reservationInputSchema } from "./reservations.schema.ts";
import {
  addDays,
  dayRange,
  endAtOf,
  formatBarDate,
  formatDay,
  formatMoment,
  isSupportedDate,
  parseDate,
  startAtOf,
  timeOf,
  todayKst,
} from "./reservations.time.ts";

// 경계는 가상 저장소, 그 안쪽(조회·캐시·목록 상태)은 실물로 돌린다
let client: QueryClient;
const unsubscribers: Array<() => void> = [];

const seo = { id: 1, name: "김서연", phone: "01012345678" };
const seoSameName = { id: 2, name: "김서연", phone: "01090123456" };
const gel = { id: 1, name: "젤 원컬러", duration: 60 };
const art = { id: 2, name: "젤 아트 (10손가락)", duration: 90 };

const choices: ReservationChoices = {
  customers: { status: "ready", items: [seo, seoSameName] },
  treatments: { status: "ready", items: [gel, art] },
  keptTreatment: null,
};

const values: ReservationFormValues = {
  customerId: "1",
  treatmentId: "1",
  date: "2026-10-22",
  startTime: "10:00",
};

function newClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity },
    },
  });
}

function mockOf(queryClient: QueryClient, rows: ReadonlyArray<Reservation> = []) {
  const mock = reservationMock(queryClient);
  mock.rows = rows.map((row) => structuredClone(row));
  mock.nextId = 100;
  mock.delayMs = 0;
  return mock;
}

// 폼처럼 스키마로 확인해 저장할 값을 만든다
function input(overrides: Partial<ReservationFormValues> = {}, withChoices = choices) {
  return reservationInputSchema(withChoices).parse({ ...values, ...overrides });
}

function fieldErrors(
  overrides: Partial<ReservationFormValues> = {},
  withChoices: ReservationChoices = choices,
) {
  const result = reservationInputSchema(withChoices).safeParse({ ...values, ...overrides });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
}

function register(overrides: Partial<ReservationFormValues> = {}) {
  return registerReservation(client, input(overrides));
}

function openList(params: ReservationListParams, queryClient = client) {
  const observer = new QueryObserver(queryClient, {
    ...reservationQueries.list(params),
    gcTime: 0,
  });
  const unsubscribe = observer.subscribe(() => {});
  unsubscribers.push(unsubscribe);
  return {
    screen: () => resolveListState(observer.getCurrentResult()),
    reload: () => observer.refetch(),
    settled: () => vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false)),
    rows: () => {
      const screen = resolveListState(observer.getCurrentResult());
      return screen.kind === "loaded" ? screen.rows : null;
    },
    leave: unsubscribe,
  };
}

const day = (date: string, includeCancelled = false): ReservationListParams => ({
  date,
  includeCancelled,
});

const times = (rows: ReadonlyArray<Reservation> | null) =>
  rows?.map((row) => `${timeOf(row.startAt)} ${row.customer.name}`);

beforeEach(() => {
  client = newClient();
});

afterEach(() => {
  unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  client.clear();
  vi.useRealTimers();
});

describe("한국 시간 날짜 계산", () => {
  it("브라우저 시간대와 관계없이 한국 0시에 오늘이 바뀐다", () => {
    expect(todayKst(Date.parse("2026-10-21T14:59:59Z"))).toBe("2026-10-21");
    expect(todayKst(Date.parse("2026-10-21T15:00:00Z"))).toBe("2026-10-22");
    expect(todayKst(Date.parse("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });

  it("날짜·시각은 한국 시간의 epoch로 바뀌고 되돌려 표시해도 같다", () => {
    const startAt = startAtOf("2026-10-22", "00:30");
    expect(startAt).toBe(Date.UTC(2026, 9, 21, 15, 30));
    expect(timeOf(startAt ?? 0)).toBe("00:30");
    expect(startAtOf("2026-10-22", "23:59")).toBe(Date.UTC(2026, 9, 22, 14, 59));
    expect(dayRange("2026-10-22")).toEqual({
      from: Date.UTC(2026, 9, 21, 15, 0),
      to: Date.UTC(2026, 9, 22, 15, 0),
    });
  });

  it.each([
    ["2026-10-22", true],
    ["2024-02-29", true],
    ["2000-01-01", true],
    ["2099-12-31", true],
    ["2023-02-29", false],
    ["2026-02-30", false],
    ["2026-13-01", false],
    ["2026-00-10", false],
    ["2026-10-00", false],
    ["2026-10-32", false],
    ["1999-12-31", false],
    ["2100-01-01", false],
    ["2026-1-5", false],
    ["20261022", false],
    ["", false],
    ["abcd-ef-gh", false],
  ])("조회 날짜 '%s'는 지원 범위의 실제 날짜인가 → %s", (text, expected) => {
    expect(isSupportedDate(text)).toBe(expected);
  });

  it("2월 30일 같은 없는 날짜를 다른 날로 보정하지 않는다", () => {
    expect(parseDate("2026-02-30")).toBeNull();
    expect(startAtOf("2026-02-30", "10:00")).toBeNull();
  });

  it("월·연말·윤일을 넘기는 이동과 다음 날 종료를 계산한다", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");

    const lateNight = startAtOf("2026-12-31", "23:30") ?? 0;
    const end = endAtOf(lateNight, 90) ?? 0;
    expect(formatMoment(end, 2026)).toBe("2027년 1월 1일 01:00");
    expect(formatDay(end, 2026)).toBe("2027년 1월 1일(금)");
    expect(formatDay(end)).toBe("1월 1일(금)");

    const leap = startAtOf("2028-02-28", "23:30") ?? 0;
    expect(formatDay(endAtOf(leap, 60) ?? 0)).toBe("2월 29일(화)");
  });

  it("달력에 나타낼 수 없는 먼 종료 일시는 계산하지 않는다", () => {
    const start = startAtOf("2099-12-31", "23:59") ?? 0;
    expect(endAtOf(start, 60 * 24 * 365 * 8000)).toBeNull();
    expect(endAtOf(start, Number.MAX_SAFE_INTEGER)).toBeNull();
    expect(endAtOf(start, 60)).not.toBeNull();
  });

  it("날짜 바 표시는 요일까지 한국 시간으로 쓴다", () => {
    expect(formatBarDate("2026-10-22")).toBe("10월 22일 목요일");
    expect(formatBarDate("2028-02-29")).toBe("2월 29일 화요일");
  });
});

describe("예약 입력 확인", () => {
  it("선택한 고객·시술 정보와 종료 일시를 계산해 저장할 값을 만든다", () => {
    const result = input();
    expect(result.customer).toEqual(seo);
    expect(result.treatment).toEqual(gel);
    expect(result.startAt).toBe(Date.UTC(2026, 9, 22, 1, 0));
    expect(result.endAt).toBe(Date.UTC(2026, 9, 22, 2, 0));
  });

  it("같은 이름의 고객도 id로 구분한다", () => {
    expect(input({ customerId: "2" }).customer).toEqual(seoSameName);
  });

  it("자정을 넘기는 예약은 다음 날 종료로 계산한다", () => {
    const result = input({ treatmentId: "2", startTime: "23:30" });
    expect(formatMoment(result.endAt)).toBe("10월 23일 01:00");
  });

  it.each([
    { overrides: { customerId: "" }, field: "customerId", message: "고객을 선택해주세요." },
    {
      overrides: { customerId: "99" },
      field: "customerId",
      message: "목록에 없는 고객이에요. 다시 선택해주세요.",
    },
    {
      overrides: { customerId: "1abc" },
      field: "customerId",
      message: "목록에 없는 고객이에요. 다시 선택해주세요.",
    },
    { overrides: { treatmentId: "" }, field: "treatmentId", message: "시술을 선택해주세요." },
    {
      overrides: { treatmentId: "99" },
      field: "treatmentId",
      message: "목록에 없는 시술이에요. 다시 선택해주세요.",
    },
    { overrides: { date: "" }, field: "date", message: "예약 날짜를 입력해주세요." },
    {
      overrides: { date: "2026-02-30" },
      field: "date",
      message: "없는 날짜예요. 날짜를 다시 확인해주세요.",
    },
    {
      overrides: { date: "2026-1-5" },
      field: "date",
      message: "없는 날짜예요. 날짜를 다시 확인해주세요.",
    },
    {
      overrides: { date: "1999-12-31" },
      field: "date",
      message: "2000~2099년 사이의 날짜를 입력해주세요.",
    },
    { overrides: { startTime: "" }, field: "startTime", message: "시작 시각을 입력해주세요." },
    {
      overrides: { startTime: "24:00" },
      field: "startTime",
      message: "시작 시각을 분 단위로 다시 입력해주세요.",
    },
    {
      overrides: { startTime: "10:60" },
      field: "startTime",
      message: "시작 시각을 분 단위로 다시 입력해주세요.",
    },
    {
      overrides: { startTime: "10:00:30" },
      field: "startTime",
      message: "시작 시각을 분 단위로 다시 입력해주세요.",
    },
    {
      overrides: { startTime: "9:00" },
      field: "startTime",
      message: "시작 시각을 분 단위로 다시 입력해주세요.",
    },
  ])("$field $overrides → $message", ({ overrides, field, message }) => {
    expect(fieldErrors(overrides)).toEqual({ [field]: message });
  });

  it("여러 필드가 틀리면 각 필드 오류를 함께 알린다", () => {
    expect(fieldErrors({ customerId: "", treatmentId: "", date: "", startTime: "" })).toEqual({
      customerId: "고객을 선택해주세요.",
      treatmentId: "시술을 선택해주세요.",
      date: "예약 날짜를 입력해주세요.",
      startTime: "시작 시각을 입력해주세요.",
    });
  });

  it("고객·시술 목록을 불러오는 중이거나 고를 수 없으면 값이 있어도 저장하지 않는다", () => {
    expect(
      fieldErrors(
        {},
        {
          ...choices,
          customers: { status: "loading", items: [] },
          treatments: { status: "loading", items: [] },
        },
      ),
    ).toEqual({
      customerId: "고객 목록을 불러온 뒤 선택해주세요.",
      treatmentId: "시술 목록을 불러온 뒤 선택해주세요.",
    });
    expect(
      fieldErrors(
        {},
        {
          ...choices,
          customers: { status: "unavailable", items: [] },
          treatments: { status: "unavailable", items: [] },
        },
      ),
    ).toEqual({
      customerId: "선택할 수 있는 고객이 없어요.",
      treatmentId: "선택할 수 있는 시술이 없어요.",
    });
  });

  it("소요시간이 올바르지 않은 시술은 예약하지 않는다", () => {
    const broken = {
      ...choices,
      treatments: { status: "ready" as const, items: [{ ...gel, duration: 0 }] },
    };
    expect(fieldErrors({}, broken)).toEqual({
      treatmentId: "이 시술은 소요시간이 올바르지 않아 예약할 수 없어요.",
    });
  });

  it("종료 일시를 달력에 나타낼 수 없으면 날짜 오류로 알린다", () => {
    const huge = {
      ...choices,
      treatments: {
        status: "ready" as const,
        items: [{ ...gel, duration: Number.MAX_SAFE_INTEGER }],
      },
    };
    expect(fieldErrors({}, huge)).toEqual({ date: "종료 일시를 계산할 수 없는 날짜예요." });
  });

  it("수정할 때 같은 시술이면 저장된 소요시간을 유지하고 다른 시술이면 새 시술로 다시 계산한다", () => {
    // 이후 시술 목록의 소요시간이 90분으로 바뀌었어도 예약에 저장된 60분을 유지한다
    const changedList = {
      ...choices,
      treatments: { status: "ready" as const, items: [{ ...gel, duration: 90 }, art] },
      keptTreatment: { id: 1, name: "예전 이름", duration: 60 },
    };
    const kept = input({ startTime: "14:00" }, changedList);
    expect(kept.treatment).toEqual({ id: 1, name: "예전 이름", duration: 60 });
    expect(kept.endAt - kept.startAt).toBe(60 * 60_000);

    const switched = input({ treatmentId: "2", startTime: "14:00" }, changedList);
    expect(switched.treatment).toEqual(art);
    expect(switched.endAt - switched.startAt).toBe(90 * 60_000);
  });

  it("취소 사유는 앞뒤 공백을 지우고 비면 사유 없음이다", () => {
    expect(cancelInputSchema.parse({ reason: "  고객 요청  " })).toEqual({ reason: "고객 요청" });
    expect(cancelInputSchema.parse({ reason: "   " })).toEqual({ reason: null });
    expect(cancelInputSchema.safeParse({ reason: "가".repeat(201) }).success).toBe(false);
    expect(cancelInputSchema.safeParse({ reason: "가".repeat(200) }).success).toBe(true);
  });
});

describe("날짜별 예약 조회", () => {
  it("처음에는 빈 목록이고 그 날짜에 시작하는 예약만 시작 시각순으로 보여준다", async () => {
    mockOf(client);
    const list = openList(day("2026-10-22"));
    await list.settled();
    expect(list.rows()).toEqual([]);

    await register({ startTime: "15:00", customerId: "2" });
    await register({ startTime: "09:30" });
    await register({ date: "2026-10-23", startTime: "08:00" });
    await register({ date: "2026-10-21", startTime: "20:00" });
    await list.settled();

    expect(times(list.rows())).toEqual(["09:30 김서연", "15:00 김서연"]);
  });

  it("한국 시간 자정 전후 예약은 각자의 날짜에 들어가고 자정을 넘겨 끝나도 시작 날짜에만 보인다", async () => {
    mockOf(client);
    await register({ date: "2026-10-22", startTime: "23:59", treatmentId: "2" });
    await register({ date: "2026-10-23", startTime: "00:00" });
    const first = openList(day("2026-10-22"));
    const second = openList(day("2026-10-23"));
    await first.settled();
    await second.settled();

    expect(times(first.rows())).toEqual(["23:59 김서연"]);
    expect(times(second.rows())).toEqual(["00:00 김서연"]);
  });

  it("시작 시각이 같으면 먼저 등록한 예약이 앞에 온다", async () => {
    mockOf(client);
    await register({ customerId: "2" });
    await register({ customerId: "1" });
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect(list.rows()?.map((row) => row.customer.id)).toEqual([2, 1]);
  });

  it("겹치는 시간의 예약도 막지 않고 둘 다 저장한다", async () => {
    mockOf(client);
    expect((await register({ startTime: "10:00" })).kind).toBe("created");
    expect((await register({ startTime: "10:30", customerId: "2" })).kind).toBe("created");
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect(list.rows()).toHaveLength(2);
  });

  it("조회 실패 뒤 다시 시도하면 실패 표시를 둔 채 다시 시도 중을 거쳐 목록이 나온다", async () => {
    mockOf(client).failNext.list = 1;
    const list = openList(day("2026-10-22"));
    await list.settled();
    expect(list.screen()).toEqual({ kind: "failed", retrying: false });

    const reloading = list.reload();
    expect(list.screen()).toEqual({ kind: "failed", retrying: true });
    await reloading;
    expect(list.screen()).toEqual({
      kind: "loaded",
      rows: [],
      refreshFailed: false,
      retrying: false,
    });
  });

  it("다시 불러오기가 실패해도 보이던 예약을 지우거나 0건으로 바꾸지 않는다", async () => {
    const mock = mockOf(client);
    await register();
    const list = openList(day("2026-10-22"));
    await list.settled();

    mock.failNext.list = 1;
    await list.reload();
    const screen = list.screen();
    expect(screen.kind === "loaded" && screen.refreshFailed).toBe(true);
    expect(list.rows()).toHaveLength(1);
  });

  it("다른 날짜로 바꾸면 새 날짜 결과가 올 때까지 이전 날짜의 예약을 보여주지 않는다", async () => {
    mockOf(client);
    await register({ date: "2026-10-22" });
    const first = openList(day("2026-10-22"));
    await first.settled();
    expect(first.rows()).toHaveLength(1);

    // 날짜가 바뀌면 다른 query다. 캐시가 없으면 이전 날짜의 행이 아니라 불러오는 중이다
    first.leave();
    client.removeQueries({ queryKey: reservationQueries.lists() });
    const next = openList(day("2026-10-23"));
    expect(next.screen()).toEqual({ kind: "loading" });
    await next.settled();
    expect(next.rows()).toEqual([]);
  });

  it("목록을 떠났다 다시 열어도 등록한 예약이 남아 있다", async () => {
    mockOf(client);
    const first = openList(day("2026-10-22"));
    await first.settled();
    await register();
    first.leave();
    client.removeQueries({ queryKey: reservationQueries.all() });

    const again = openList(day("2026-10-22"));
    await again.settled();
    expect(times(again.rows())).toEqual(["10:00 김서연"]);
  });

  it("다른 앱(새로고침·다른 테스트)의 가상 저장소와 공유하지 않는다", async () => {
    mockOf(client);
    await register();

    const other = newClient();
    reservationMock(other).delayMs = 0;
    const list = openList(day("2026-10-22"), other);
    await list.settled();
    expect(list.rows()).toEqual([]);
    other.clear();
  });
});

describe("예약 등록", () => {
  it("계산된 종료 일시와 고객·시술 정보를 가진 예약이 정확히 한 건 생긴다", async () => {
    const mock = mockOf(client);
    const result = await register({ treatmentId: "2", startTime: "10:00" });

    expect(result.kind).toBe("created");
    expect(mock.rows).toHaveLength(1);
    expect(mock.rows[0]).toMatchObject({
      id: 100,
      customer: seo,
      treatment: art,
      startAt: Date.UTC(2026, 9, 22, 1, 0),
      endAt: Date.UTC(2026, 9, 22, 2, 30),
      cancelledAt: null,
      cancelReason: null,
    });
  });

  it("저장에 실패하면 실패로 알리고 목록·저장소에 넣지 않는다", async () => {
    const mock = mockOf(client);
    mock.failNext.create = 1;
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect(await register()).toEqual({ kind: "failed" });
    expect(list.rows()).toEqual([]);
    expect(mock.rows).toEqual([]);
  });

  it("실패한 입력 그대로 다시 저장하면 한 번만 들어간다", async () => {
    const mock = mockOf(client);
    mock.failNext.create = 1;

    expect(await register()).toEqual({ kind: "failed" });
    expect(await register()).toMatchObject({ kind: "created" });
    expect(mock.rows).toHaveLength(1);
    expect(mock.calls.create).toBe(2);
  });

  it("저장하는 동안 예약 mutation 키로 저장 중을 알 수 있고 시술·고객 키와 섞이지 않는다", async () => {
    mockOf(client).delayMs = 20;
    const saving = client.getMutationCache().build(client, {
      mutationKey: reservationMutationKeys.create(),
      mutationFn: () => register(),
    });

    const done = saving.execute(undefined);
    expect(client.isMutating({ mutationKey: reservationMutationKeys.all() })).toBe(1);
    expect(client.isMutating({ mutationKey: ["treatments"] })).toBe(0);
    expect(client.isMutating({ mutationKey: ["customers"] })).toBe(0);
    await done;
    expect(client.isMutating({ mutationKey: reservationMutationKeys.all() })).toBe(0);
  });

  it("저장하는 사이 늦게 도착한 이전 조회 응답이 새 예약을 지우지 못한다", async () => {
    const mock = mockOf(client);
    // 첫 조회만 늦게 응답
    mock.delayMs = 50;
    const list = openList(day("2026-10-22"));
    mock.delayMs = 0;

    const result = await register();
    expect(result.kind).toBe("created");
    await list.settled();
    await vi.waitFor(() => expect(mock.calls.list).toBeGreaterThanOrEqual(2));
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(times(list.rows())).toEqual(["10:00 김서연"]);
  });

  it("등록한 날짜가 아닌 날짜의 목록은 그대로 둔다", async () => {
    mockOf(client);
    const other = openList(day("2026-10-23"));
    await other.settled();
    await register({ date: "2026-10-22" });
    await other.settled();

    expect(other.rows()).toEqual([]);
  });
});

describe("예약 수정", () => {
  async function created(overrides: Partial<ReservationFormValues> = {}) {
    const result = await register(overrides);
    if (result.kind !== "created") throw new Error("등록에 실패했어요");
    return result.reservation;
  }

  it("같은 예약을 갱신하고 시간·종료 일시가 규칙대로 바뀐다", async () => {
    const mock = mockOf(client);
    const original = await created();
    const list = openList(day("2026-10-22"));
    await list.settled();

    const result = await updateReservation(
      client,
      original.id,
      input({ customerId: "2", treatmentId: "2", startTime: "13:00" }),
    );

    expect(result.kind).toBe("updated");
    expect(mock.rows).toHaveLength(1);
    expect(mock.rows[0]).toMatchObject({
      id: original.id,
      customer: seoSameName,
      treatment: art,
      startAt: Date.UTC(2026, 9, 22, 4, 0),
      endAt: Date.UTC(2026, 9, 22, 5, 30),
    });
    await list.settled();
    expect(times(list.rows())).toEqual(["13:00 김서연"]);
  });

  it("날짜를 옮기면 기존 날짜 목록에서 빠지고 바뀐 날짜 목록에 시간순으로 나온다", async () => {
    mockOf(client);
    const original = await created({ date: "2026-10-22" });
    await created({ date: "2026-10-23", startTime: "12:00", customerId: "2" });
    const oldDay = openList(day("2026-10-22"));
    const newDay = openList(day("2026-10-23"));
    await oldDay.settled();
    await newDay.settled();

    await updateReservation(client, original.id, input({ date: "2026-10-23", startTime: "09:00" }));
    await oldDay.settled();
    await newDay.settled();

    expect(oldDay.rows()).toEqual([]);
    expect(times(newDay.rows())).toEqual(["09:00 김서연", "12:00 김서연"]);
  });

  it("시술 목록을 다시 불러와도 예약에 저장된 시술명·소요시간·시간은 바뀌지 않는다", async () => {
    const mock = mockOf(client);
    const original = await created();

    // 이후 시술 정보가 바뀐 것처럼 만든다
    const renamedChoices: ReservationChoices = {
      ...choices,
      treatments: { status: "ready", items: [{ id: 1, name: "새 이름", duration: 120 }, art] },
    };
    expect(reservationInputSchema(renamedChoices).parse(values).endAt).not.toBe(original.endAt);
    expect(mock.rows[0]?.treatment).toEqual(gel);
    expect(mock.rows[0]?.endAt).toBe(original.endAt);

    const list = openList(day("2026-10-22"));
    await list.settled();
    await list.reload();
    expect(list.rows()?.[0]?.treatment).toEqual(gel);
    expect(list.rows()?.[0]?.endAt).toBe(original.endAt);
  });

  it("수정에 실패하면 원래 예약을 유지한다", async () => {
    const mock = mockOf(client);
    const original = await created();
    mock.failNext.update = 1;
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect(await updateReservation(client, original.id, input({ startTime: "15:00" }))).toEqual({
      kind: "failed",
    });
    expect(mock.rows[0]).toEqual(original);
    expect(times(list.rows())).toEqual(["10:00 김서연"]);
  });

  it("이미 없는 예약은 덮어쓰지 않고 목록에서 내린다", async () => {
    const mock = mockOf(client);
    const original = await created();
    const list = openList(day("2026-10-22"));
    await list.settled();
    mock.rows = [];

    expect(await updateReservation(client, original.id, input({ startTime: "15:00" }))).toEqual({
      kind: "not_found",
      refreshed: true,
    });
    expect(mock.rows).toEqual([]);
    await list.settled();
    expect(list.rows()).toEqual([]);
  });

  it("이미 취소된 걸 확인했으면 목록 재조회가 실패해도 활성 행을 지우고 재조회 실패는 따로 알린다", async () => {
    const mock = mockOf(client);
    const original = await created();
    const basic = openList(day("2026-10-22"));
    const withCancelled = openList(day("2026-10-22", true));
    await basic.settled();
    await withCancelled.settled();
    // 다른 곳에서 먼저 취소됨. 오래된 목록은 아직 활성으로 알고 있다
    mock.rows[0] = { ...original, cancelledAt: 1_000, cancelReason: "최초 사유" };
    mock.failNext.list = 2;

    const result = await updateReservation(client, original.id, input({ startTime: "15:00" }));

    expect(result).toEqual({ kind: "cancelled", refreshed: false });
    expect(basic.rows()).toEqual([]);
    expect(withCancelled.rows()?.map((row) => row.cancelledAt)).toEqual([1_000]);
    const screen = basic.screen();
    expect(screen.kind === "loaded" && screen.refreshFailed).toBe(true);
    expect(mock.rows[0]?.cancelReason).toBe("최초 사유");
  });

  it("이미 취소된 예약은 수정하지 않는다", async () => {
    const mock = mockOf(client);
    const original = await created();
    await cancelReservation(client, original.id, { reason: "고객 요청" });

    expect(await updateReservation(client, original.id, input({ startTime: "15:00" }))).toEqual({
      kind: "cancelled",
      refreshed: true,
    });
    expect(mock.rows[0]?.startAt).toBe(original.startAt);
    expect(mock.rows[0]?.cancelReason).toBe("고객 요청");
  });
});

describe("예약 취소", () => {
  async function created() {
    const result = await register();
    if (result.kind !== "created") throw new Error("등록에 실패했어요");
    return result.reservation;
  }

  it("원래 내용을 보존하고 취소 시각·사유를 기록하며 기본 목록에서 뺀다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T05:03:00Z"));
    const mock = mockOf(client);
    const original = await created();
    const basic = openList(day("2026-10-22"));
    const withCancelled = openList(day("2026-10-22", true));
    await basic.settled();
    await withCancelled.settled();

    const result = await cancelReservation(client, original.id, { reason: "고객 요청" });

    expect(result.kind).toBe("cancelled");
    expect(mock.rows).toHaveLength(1);
    // 가짜 시계가 조회 지연 동안 조금 흐를 수 있어 취소 시각은 범위로 확인한다
    const cancelledAt = mock.rows[0]?.cancelledAt ?? 0;
    expect(cancelledAt).toBeGreaterThanOrEqual(Date.parse("2026-10-22T05:03:00Z"));
    expect(cancelledAt).toBeLessThan(Date.parse("2026-10-22T05:03:01Z"));
    expect(mock.rows[0]).toEqual({ ...original, cancelledAt, cancelReason: "고객 요청" });
    await basic.settled();
    await withCancelled.settled();
    expect(basic.rows()).toEqual([]);
    expect(withCancelled.rows()).toHaveLength(1);
    expect(formatMoment(withCancelled.rows()?.[0]?.cancelledAt ?? 0)).toBe("10월 22일 14:03");
  });

  it("사유 없이도 취소하고 물리 삭제하지 않는다", async () => {
    const mock = mockOf(client);
    const original = await created();

    await cancelReservation(client, original.id, { reason: null });

    expect(mock.rows).toHaveLength(1);
    expect(mock.rows[0]?.cancelReason).toBeNull();
    expect(mock.rows[0]?.cancelledAt).not.toBeNull();
  });

  it("취소에 실패하면 기존 예약을 유지한다", async () => {
    const mock = mockOf(client);
    const original = await created();
    mock.failNext.cancel = 1;
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect(await cancelReservation(client, original.id, { reason: null })).toEqual({
      kind: "failed",
    });
    expect(mock.rows[0]).toEqual(original);
    expect(times(list.rows())).toEqual(["10:00 김서연"]);
  });

  it("다시 취소해도 최초 취소 기록을 덮어쓰지 않는다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T05:03:00Z"));
    const mock = mockOf(client);
    const original = await created();
    await cancelReservation(client, original.id, { reason: "처음 사유" });
    const firstCancelledAt = mock.rows[0]?.cancelledAt;
    vi.setSystemTime(new Date("2026-10-22T09:00:00Z"));

    expect(await cancelReservation(client, original.id, { reason: "나중 사유" })).toEqual({
      kind: "already_cancelled",
      refreshed: true,
    });
    expect(mock.rows[0]?.cancelReason).toBe("처음 사유");
    expect(mock.rows[0]?.cancelledAt).toBe(firstCancelledAt);
  });

  it("이미 취소된 걸 확인했으면 재조회가 실패해도 활성 행을 지우고 최초 기록을 유지한다", async () => {
    const mock = mockOf(client);
    const original = await created();
    const basic = openList(day("2026-10-22"));
    const withCancelled = openList(day("2026-10-22", true));
    await basic.settled();
    await withCancelled.settled();
    mock.rows[0] = { ...original, cancelledAt: 1_000, cancelReason: "최초 사유" };
    mock.failNext.list = 2;

    const result = await cancelReservation(client, original.id, { reason: "두 번째 사유" });

    expect(result).toEqual({ kind: "already_cancelled", refreshed: false });
    expect(basic.rows()).toEqual([]);
    expect(withCancelled.rows()).toMatchObject([{ cancelledAt: 1_000, cancelReason: "최초 사유" }]);
    expect(mock.rows[0]).toMatchObject({ cancelledAt: 1_000, cancelReason: "최초 사유" });
  });

  it("이미 없는 예약을 취소하면 없다고 알리고 목록에서 내린다", async () => {
    const mock = mockOf(client);
    const original = await created();
    const list = openList(day("2026-10-22"));
    await list.settled();
    mock.rows = [];

    expect(await cancelReservation(client, original.id, { reason: null })).toEqual({
      kind: "not_found",
      refreshed: true,
    });
    await list.settled();
    expect(list.rows()).toEqual([]);
  });

  it("취소 포함 목록과 기본 목록에 오래된 데이터가 남지 않는다", async () => {
    mockOf(client);
    const first = await created();
    await register({ startTime: "11:00", customerId: "2" });
    const basic = openList(day("2026-10-22"));
    const withCancelled = openList(day("2026-10-22", true));
    await basic.settled();
    await withCancelled.settled();

    await cancelReservation(client, first.id, { reason: null });
    await basic.settled();
    await withCancelled.settled();

    expect(times(basic.rows())).toEqual(["11:00 김서연"]);
    expect(withCancelled.rows()?.map((row) => row.cancelledAt !== null)).toEqual([true, false]);
  });

  it("취소 전에 시작한 이전 조회가 늦게 도착해도 취소를 되돌리지 못한다", async () => {
    const mock = mockOf(client);
    const original = await created();
    // 취소 전 상태를 늦게 돌려주는 조회
    mock.delayMs = 50;
    const list = openList(day("2026-10-22"));
    mock.delayMs = 0;

    await cancelReservation(client, original.id, { reason: null });
    await list.settled();
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(list.rows()).toEqual([]);
  });
});

describe("가상 저장소 호출 횟수", () => {
  it("실제로 저장소에 닿은 등록·수정·취소 횟수를 센다", async () => {
    const mock = mockOf(client);
    const result = await register();
    if (result.kind !== "created") throw new Error("등록에 실패했어요");
    await updateReservation(client, result.reservation.id, input({ startTime: "11:00" }));
    await cancelReservation(client, result.reservation.id, { reason: null });

    expect(mock.calls).toMatchObject({ create: 1, update: 1, cancel: 1 });
  });
});
