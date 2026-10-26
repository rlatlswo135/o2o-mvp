import type { Reservation } from "@o2o/shared/contracts";

import { endAtOf } from "@o2o/shared/contracts";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveListState } from "@/shared/ui/data-table/data-table.state.ts";

import type { ReservationListParams } from "./reservations.api.ts";
import type { ReservationChoices, ReservationFormValues } from "./reservations.schema.ts";

import { customerQueries } from "../customers/customers.api.ts";
import { treatmentQueries } from "../treatments/treatments.api.ts";
import {
  cancelReservation,
  registerReservation,
  reservationMutationKeys,
  reservationQueries,
  updateReservation,
} from "./reservations.api.ts";
import {
  cancelInputSchema,
  previewSchedule,
  rejectionErrors,
  reservationInputSchema,
  treatmentMessages,
  treatmentRows,
} from "./reservations.schema.ts";
import {
  addDays,
  dayRange,
  formatBarDate,
  formatDay,
  formatMinutes,
  formatMoment,
  formatTotal,
  isSupportedDate,
  parseDate,
  startAtOf,
  timeOf,
  todayKst,
} from "./reservations.time.ts";

// 경계는 HTTP 계약만, 그 안쪽(조회·캐시·목록 상태)은 실물로 돌린다
vi.hoisted(() => {
  vi.stubEnv("VITE_SERVER_URL", "https://api.example.test/");
});

const seo = { id: 1, name: "김서연", phone: "01012345678" };
const seoSameName = { id: 2, name: "김서연", phone: "01090123456" };
const gel = { id: 1, name: "젤 원컬러", duration: 60 };
const art = { id: 2, name: "젤 아트 (10손가락)", duration: 90 };
const care = { id: 3, name: "손 케어", duration: 30 };

const choices: ReservationChoices = {
  customers: { kind: "ready", items: [seo, seoSameName] },
  treatments: { kind: "ready", items: [gel, art, care] },
  keptCustomer: null,
  keptTreatments: [],
  seenTreatments: [],
};

const values: ReservationFormValues = {
  customerId: "1",
  treatmentIds: ["1"],
  date: "2026-10-22",
  startTime: "10:00",
};

// 2026-10-22 10:00(한국 시간)에 시작하는 젤 원컬러 60분
const at = (hour: number, minute = 0, day = 22) => Date.UTC(2026, 9, day, hour - 9, minute);

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  const startAt = overrides.startAt ?? at(10);
  const treatments = overrides.treatments ?? [gel];
  const minutes = treatments.reduce((sum, item) => sum + item.duration, 0);
  return {
    id: 100,
    customer: seo,
    treatments,
    startAt,
    endAt: startAt + minutes * 60_000,
    cancelledAt: null,
    cancelReason: null,
    ...overrides,
  };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
// 계약에 정의한 오류. oRPC는 이 모양의 본문만 오류로 읽는다
const defined = (code: string, status: number, data?: unknown) =>
  json({ defined: true, code, message: code, data }, status);
const invalidInput = (issues: Array<{ path: unknown[]; message: string }>) =>
  json(
    { defined: false, code: "BAD_REQUEST", message: "Input validation failed", data: { issues } },
    400,
  );

const unreachable = () => {
  throw new TypeError("Failed to fetch");
};

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

const requestOf = (url: string, init: RequestInit) => {
  const { pathname, search } = new URL(url);
  return `${init.method} ${pathname}${decodeURIComponent(search)}`;
};

const requests = () => fetchMock.mock.calls.map(([url, init]) => requestOf(url, init));

const sentBody = (request: string) => {
  const call = fetchMock.mock.calls.find(([url, init]) => requestOf(url, init) === request);
  return JSON.parse(String(call?.[1].body));
};

// 요청 문자열("GET /reservations?…")마다 응답을 고른다
function serve(respond: (request: string) => Response | Promise<Response>) {
  fetchMock.mockImplementation(async (url, init) => respond(requestOf(url, init)));
}

const listOf = (date: string, includeCancelled = false) =>
  `GET /reservations?date=${date}&includeCancelled=${includeCancelled}`;

let client: QueryClient;
const unsubscribers: Array<() => void> = [];

// 폼처럼 스키마로 확인해 보낼 값을 만든다
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

// rows()는 DataTable이 그릴 행. 불러오지 못했으면 null
function openList(params: ReservationListParams) {
  const observer = new QueryObserver(client, reservationQueries.list(params));
  const unsubscribe = observer.subscribe(() => {});
  unsubscribers.push(unsubscribe);
  const screen = () => resolveListState(observer.getCurrentResult());
  return {
    screen,
    reload: () => observer.refetch(),
    settled: () => vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false)),
    rows: () => {
      const current = screen();
      return current.kind === "loaded" ? current.rows : null;
    },
  };
}

const day = (date: string, includeCancelled = false): ReservationListParams => ({
  date,
  includeCancelled,
});

const times = (rows: ReadonlyArray<Reservation> | null) =>
  rows?.map((row) => `${timeOf(row.startAt)} ${row.customer.name}`);

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity },
    },
  });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  client.clear();
  vi.unstubAllGlobals();
});

afterAll(() => {
  vi.unstubAllEnvs();
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

  it("날짜 바 표시는 요일까지 한국 시간으로 쓴다", () => {
    expect(formatBarDate("2026-10-22")).toBe("10월 22일 목요일");
    expect(formatBarDate("2028-02-29")).toBe("2월 29일 화요일");
  });

  it("분은 천 단위 쉼표로, 합계는 60분부터 시간을 함께 쓴다", () => {
    expect(formatMinutes(1500)).toBe("1,500분");
    expect(formatTotal(45)).toBe("총 45분");
    expect(formatTotal(60)).toBe("총 60분 (1시간)");
    expect(formatTotal(90)).toBe("총 90분 (1시간 30분)");
    expect(formatTotal(1500)).toBe("총 1,500분 (25시간)");
  });
});

describe("예약 입력 확인", () => {
  it("고객 id·시술 id·시작 일시만 보낸다(이름·종료 일시는 서버가 정한다)", () => {
    expect(input()).toEqual({ customerId: 1, treatmentIds: [1], startAt: at(10) });
  });

  it("같은 이름의 고객도 id로 구분한다", () => {
    expect(input({ customerId: "2" }).customerId).toBe(2);
  });

  it("시술 여러 개는 체크한 순서가 아니라 체크 목록 순서로 보낸다", () => {
    expect(input({ treatmentIds: ["3", "1"] }).treatmentIds).toEqual([1, 3]);
  });

  it("23:30에 30분+60분 시술이면 총 90분, 다음 날 01:00에 끝난다", () => {
    const preview = previewSchedule(
      { ...values, treatmentIds: ["3", "1"], startTime: "23:30" },
      choices,
    );

    expect(preview.rows.map((row) => row.id)).toEqual([1, 3]);
    expect(preview.totalMinutes).toBe(90);
    expect(formatTotal(preview.totalMinutes ?? 0)).toBe("총 90분 (1시간 30분)");
    expect(formatMoment(preview.schedule?.endAt ?? 0)).toBe("10월 23일 01:00");
    expect(preview.outOfRange).toBe(false);
  });

  it("날짜·시각이 아직 올바르지 않으면 합계만 보여주고 종료 일시는 계산하지 않는다", () => {
    const preview = previewSchedule(
      { ...values, treatmentIds: ["1", "2"], startTime: "" },
      choices,
    );
    expect(preview.totalMinutes).toBe(150);
    expect(preview.schedule).toBeNull();
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
    { overrides: { treatmentIds: [] }, field: "treatmentIds", message: treatmentMessages.none },
    {
      overrides: { treatmentIds: ["1", "99"] },
      field: "treatmentIds",
      message: treatmentMessages.vanished,
    },
    { overrides: { date: "" }, field: "date", message: "예약 날짜를 입력해주세요." },
    {
      overrides: { date: "2026-02-30" },
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
      overrides: { startTime: "9:00" },
      field: "startTime",
      message: "시작 시각을 분 단위로 다시 입력해주세요.",
    },
  ])("$field $overrides → $message", ({ overrides, field, message }) => {
    expect(fieldErrors(overrides)).toEqual({ [field]: message });
  });

  it("여러 칸이 틀리면 각 칸 오류를 함께 알린다", () => {
    expect(fieldErrors({ customerId: "", treatmentIds: [], date: "", startTime: "" })).toEqual({
      customerId: "고객을 선택해주세요.",
      treatmentIds: treatmentMessages.none,
      date: "예약 날짜를 입력해주세요.",
      startTime: "시작 시각을 입력해주세요.",
    });
  });

  it("고객·시술 목록을 불러오는 중이거나 고를 수 없으면 값이 있어도 저장하지 않는다", () => {
    const loading: ReservationChoices = {
      ...choices,
      customers: { kind: "loading", items: [] },
      treatments: { kind: "loading", items: [] },
    };
    expect(fieldErrors({}, loading)).toEqual({
      customerId: "고객 목록을 불러온 뒤 선택해주세요.",
      treatmentIds: treatmentMessages.loading,
    });
    const failed: ReservationChoices = {
      ...choices,
      customers: { kind: "failed", items: [] },
      treatments: { kind: "failed", items: [] },
    };
    expect(fieldErrors({}, failed)).toEqual({
      customerId: "선택할 수 있는 고객이 없어요.",
      treatmentIds: treatmentMessages.unavailable,
    });
    const empty: ReservationChoices = {
      ...choices,
      customers: { kind: "empty", items: [] },
      treatments: { kind: "empty", items: [] },
    };
    expect(fieldErrors({ customerId: "", treatmentIds: [] }, empty)).toEqual({
      customerId: "선택할 수 있는 고객이 없어요.",
      treatmentIds: treatmentMessages.unavailable,
    });
  });

  it("소요시간이 올바르지 않은 시술이 섞이면 예약하지 않는다", () => {
    const broken: ReservationChoices = {
      ...choices,
      treatments: { kind: "ready", items: [{ ...gel, duration: 0 }, art] },
    };
    expect(fieldErrors({ treatmentIds: ["1", "2"] }, broken)).toEqual({
      treatmentIds: treatmentMessages.badDuration,
    });
  });

  it("시술 시간을 더해 종료 일시를 계산할 수 없으면 시술 칸 오류로 알린다", () => {
    const huge = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
    const overflow: ReservationChoices = {
      ...choices,
      treatments: {
        kind: "ready",
        items: [
          { ...gel, duration: huge },
          { ...art, duration: huge },
        ],
      },
    };
    expect(fieldErrors({ treatmentIds: ["1", "2"] }, overflow)).toEqual({
      treatmentIds: treatmentMessages.outOfRange,
    });
    expect(previewSchedule({ ...values, treatmentIds: ["1", "2"] }, overflow).outOfRange).toBe(
      true,
    );

    const far: ReservationChoices = {
      ...choices,
      treatments: { kind: "ready", items: [{ ...gel, duration: Number.MAX_SAFE_INTEGER }] },
    };
    expect(fieldErrors({}, far)).toEqual({ treatmentIds: treatmentMessages.outOfRange });
  });

  it("수정할 때 기존 시술은 해제했다 다시 체크해도 예약 당시 값으로 계산한다", () => {
    const editing: ReservationChoices = {
      ...choices,
      // 이후 시술 목록의 이름·소요시간이 바뀌었다
      keptTreatments: [{ id: 1, name: "예전 이름", duration: 45 }],
    };
    const preview = previewSchedule({ ...values, treatmentIds: ["2", "1"] }, editing);

    expect(preview.rows).toEqual([
      { id: 1, name: "예전 이름", duration: 45, kind: "kept_changed" },
      { ...art, kind: "listed" },
    ]);
    expect(preview.totalMinutes).toBe(135);
    expect(input({ treatmentIds: ["2", "1"] }, editing).treatmentIds).toEqual([1, 2]);
  });

  it("수정할 때 목록에 없는 기존 고객·시술도 그대로 두면 저장할 수 있다", () => {
    const gone = { id: 9, name: "이전 고객", phone: "01000000000" };
    const deleted = { id: 7, name: "단종 시술", duration: 20 };
    const editing: ReservationChoices = {
      customers: { kind: "loading", items: [] },
      treatments: { kind: "loading", items: [] },
      keptCustomer: gone,
      keptTreatments: [deleted],
      seenTreatments: [],
    };

    expect(input({ customerId: "9", treatmentIds: ["7"] }, editing)).toEqual({
      customerId: 9,
      treatmentIds: [7],
      startAt: at(10),
    });
    // 기존 시술을 고를 수 있으니 0개 체크는 목록 상태와 관계없이 '1개 이상' 안내다
    expect(fieldErrors({ customerId: "9", treatmentIds: [] }, editing)).toEqual({
      treatmentIds: treatmentMessages.none,
    });
  });

  it("체크 목록은 사라진 시술, 삭제된 기존 시술, 시술 목록 순서로 보인다", () => {
    const deleted = { id: 7, name: "단종 시술", duration: 20 };
    const editing: ReservationChoices = {
      ...choices,
      treatments: { kind: "ready", items: [gel, art] },
      keptTreatments: [deleted, gel],
      // 이번 시트에서 체크했는데 다시 불러온 목록에서 빠진 시술
      seenTreatments: [{ id: 8, name: "사라진 시술", duration: 15 }],
    };

    expect(treatmentRows(["8", "7", "1", "5"], editing)).toEqual([
      { id: 8, name: "사라진 시술", duration: 15, kind: "vanished" },
      { id: 5, name: null, duration: null, kind: "vanished" },
      { ...deleted, kind: "deleted" },
      { ...gel, kind: "kept" },
      { ...art, kind: "listed" },
    ]);
    // 시술 목록을 모르면 기존 예약 시술만 보인다
    expect(treatmentRows(["1"], { ...editing, treatments: { kind: "failed", items: [] } })).toEqual(
      [
        { ...deleted, kind: "kept" },
        { ...gel, kind: "kept" },
      ],
    );
  });

  it("서버가 확정한 거부는 해당 칸 오류로, 칸을 모르면 시트 알림으로 보낸다", () => {
    expect(rejectionErrors("customer_not_found")).toEqual({
      customerId: "더 이상 없는 고객이에요. 목록을 새로 불러왔으니 다시 선택해주세요.",
    });
    expect(rejectionErrors("treatment_not_found")).toEqual({
      treatmentIds: treatmentMessages.notFound,
    });
    expect(rejectionErrors("schedule_out_of_range")).toEqual({
      treatmentIds: treatmentMessages.outOfRange,
    });
    expect(rejectionErrors("invalid_treatments")).toEqual({
      treatmentIds: treatmentMessages.invalid,
    });
    expect(rejectionErrors("invalid")).toBeNull();
  });

  it("취소 사유는 앞뒤 공백을 지우고 비면 사유 없음이다", () => {
    expect(cancelInputSchema.parse({ reason: "  고객 요청  " })).toEqual({ reason: "고객 요청" });
    expect(cancelInputSchema.parse({ reason: "   " })).toEqual({ reason: null });
    expect(cancelInputSchema.safeParse({ reason: "가".repeat(201) }).success).toBe(false);
    expect(cancelInputSchema.safeParse({ reason: "가".repeat(200) }).success).toBe(true);
  });
});

describe("날짜별 예약 조회", () => {
  it("날짜와 취소 포함 여부를 쿼리 문자열로 보내고 서버 순서 그대로 보여준다", async () => {
    const early = reservation({ id: 101, startAt: at(9, 30) });
    const late = reservation({ id: 102, startAt: at(15), customer: seoSameName });
    const cancelled = reservation({ id: 103, cancelledAt: at(8), cancelReason: null });
    serve((request) =>
      request === listOf("2026-10-22", true) ? json([early, cancelled, late]) : json([early, late]),
    );
    const basic = openList(day("2026-10-22"));
    const withCancelled = openList(day("2026-10-22", true));

    expect(basic.screen()).toEqual({ kind: "loading" });
    await basic.settled();
    await withCancelled.settled();
    expect(times(basic.rows())).toEqual(["09:30 김서연", "15:00 김서연"]);
    expect(withCancelled.rows()?.map((row) => row.id)).toEqual([101, 103, 102]);
    expect(requests().toSorted()).toEqual([listOf("2026-10-22"), listOf("2026-10-22", true)]);
  });

  it("조회 실패 뒤 다시 시도하면 실패 표시를 둔 채 다시 시도 중을 거쳐 목록이 나온다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json({}, 500))
      .mockImplementation(async () => json([]));
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
    fetchMock
      .mockImplementationOnce(async () => json([reservation()]))
      .mockImplementationOnce(async () => unreachable());
    const list = openList(day("2026-10-22"));
    await list.settled();

    await list.reload();
    const screen = list.screen();
    expect(screen.kind === "loaded" && screen.refreshFailed).toBe(true);
    expect(list.rows()).toHaveLength(1);
  });

  it("응답이 계약과 다르면(시술 없음) 목록으로 쓰지 않고 실패로 보여준다", async () => {
    serve(async () => json([{ ...reservation(), treatments: [] }]));
    const list = openList(day("2026-10-22"));

    await list.settled();
    expect(list.screen()).toEqual({ kind: "failed", retrying: false });
  });

  it("다른 날짜로 바꾸면 새 날짜 결과가 올 때까지 이전 날짜의 예약을 보여주지 않는다", async () => {
    let releaseNext!: () => void;
    const nextHeld = new Promise<void>((resolve) => (releaseNext = resolve));
    serve(async (request) => {
      if (request === listOf("2026-10-22")) return json([reservation()]);
      await nextHeld;
      return json([]);
    });
    const first = openList(day("2026-10-22"));
    await first.settled();
    expect(first.rows()).toHaveLength(1);

    const next = openList(day("2026-10-23"));
    expect(next.screen()).toEqual({ kind: "loading" });
    releaseNext();
    await next.settled();
    expect(next.rows()).toEqual([]);
  });
});

describe("예약 등록", () => {
  it("고른 값을 보내고 서버가 준 예약을 그 날짜 목록에 시간순으로 한 번 넣는다", async () => {
    const existing = reservation({ id: 90, startAt: at(15) });
    const created = reservation({ treatments: [gel, care] });
    let saved = false;
    serve((request) => {
      if (request === "POST /reservations") {
        saved = true;
        return json(created, 201);
      }
      if (request === listOf("2026-10-22")) return json(saved ? [created, existing] : [existing]);
      return json([]);
    });
    const list = openList(day("2026-10-22"));
    const other = openList(day("2026-10-23"));
    await list.settled();
    await other.settled();

    const result = await register({ treatmentIds: ["3", "1"] });

    expect(result).toEqual({ kind: "created", reservation: created });
    expect(sentBody("POST /reservations")).toEqual({
      customerId: 1,
      treatmentIds: [1, 3],
      startAt: at(10),
    });
    await list.settled();
    expect(times(list.rows())).toEqual(["10:00 김서연", "15:00 김서연"]);
    expect(other.rows()).toEqual([]);
    expect(requests().filter((request) => request.startsWith("POST"))).toHaveLength(1);
  });

  it("등록 뒤 목록 재조회가 실패해도 확인한 새 예약은 목록에 남는다", async () => {
    const existing = reservation({ id: 90, startAt: at(15) });
    fetchMock
      .mockImplementationOnce(async () => json([existing]))
      .mockImplementationOnce(async () => json(reservation(), 201))
      .mockImplementationOnce(async () => json({}, 500));
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect((await register()).kind).toBe("created");
    await list.settled();
    expect(times(list.rows())).toEqual(["10:00 김서연", "15:00 김서연"]);
    const screen = list.screen();
    expect(screen.kind === "loaded" && screen.refreshFailed).toBe(true);
  });

  it("없는 고객이라고 거부하면(422) 사유를 돌려주고 고객 목록을 다시 불러오게 한다", async () => {
    client.setQueryData(customerQueries.list().queryKey, []);
    serve(async () => defined("UNPROCESSABLE_CONTENT", 422, { reason: "customer_not_found" }));

    expect(await register()).toEqual({ kind: "rejected", reason: "customer_not_found" });
    expect(client.getQueryState(customerQueries.list().queryKey)?.isInvalidated).toBe(true);
    expect(requests()).toEqual(["POST /reservations"]);
  });

  it("없는 시술이라고 거부하면(422) 사유를 돌려주고 시술 목록을 다시 불러오게 한다", async () => {
    client.setQueryData(treatmentQueries.list().queryKey, []);
    serve(async () =>
      defined("UNPROCESSABLE_CONTENT", 422, { reason: "treatment_not_found", treatmentIds: [3] }),
    );

    expect(await register()).toEqual({ kind: "rejected", reason: "treatment_not_found" });
    expect(client.getQueryState(treatmentQueries.list().queryKey)?.isInvalidated).toBe(true);
  });

  it("종료 일시를 계산할 수 없다고 거부하면(422) 그 사유를 돌려준다", async () => {
    serve(async () => defined("UNPROCESSABLE_CONTENT", 422, { reason: "schedule_out_of_range" }));

    expect(await register()).toEqual({ kind: "rejected", reason: "schedule_out_of_range" });
  });

  it("입력 형식 거부(400)는 시술 칸 문제인지 아닌지만 나눈다", async () => {
    serve(async () => invalidInput([{ path: ["treatmentIds"], message: "같은 시술을 두 번" }]));
    expect(await register()).toEqual({ kind: "rejected", reason: "invalid_treatments" });

    serve(async () => invalidInput([{ path: ["startAt"], message: "분 단위" }]));
    expect(await register()).toEqual({ kind: "rejected", reason: "invalid" });
  });

  it.each([
    { situation: "서버 오류(500)", respond: async () => json({}, 500) },
    { situation: "서버에 닿지 않음", respond: async () => unreachable() },
    { situation: "응답이 계약과 다름", respond: async () => json({ id: 100 }, 201) },
    {
      situation: "거부 사유가 계약과 다름",
      respond: async () => defined("UNPROCESSABLE_CONTENT", 422, { reason: "unknown_reason" }),
    },
  ])(
    "결과를 알 수 없으면($situation) 다시 보내지 않고 목록만 다시 불러온다",
    async ({ respond }) => {
      fetchMock
        .mockImplementationOnce(async () => json([]))
        .mockImplementationOnce(respond)
        .mockImplementationOnce(async () => json([reservation()]));
      const list = openList(day("2026-10-22"));
      await list.settled();

      expect(await register()).toEqual({ kind: "unknown" });
      await vi.waitFor(() =>
        expect(requests()).toEqual([
          listOf("2026-10-22"),
          "POST /reservations",
          listOf("2026-10-22"),
        ]),
      );
      await list.settled();
      // 서버에 저장돼 있었다면 다시 불러온 목록에 나타난다
      expect(times(list.rows())).toEqual(["10:00 김서연"]);
    },
  );

  it("저장하는 동안 예약 mutation 키로 저장 중을 알 수 있고 시술·고객 키와 섞이지 않는다", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    fetchMock.mockImplementationOnce(async () => {
      await held;
      return json(reservation(), 201);
    });
    const saving = client.getMutationCache().build(client, {
      mutationKey: reservationMutationKeys.create(),
      mutationFn: () => register(),
    });

    const done = saving.execute(undefined);
    expect(client.isMutating({ mutationKey: reservationMutationKeys.all() })).toBe(1);
    expect(client.isMutating({ mutationKey: ["treatments"] })).toBe(0);
    expect(client.isMutating({ mutationKey: ["customers"] })).toBe(0);
    release();
    await done;
    expect(client.isMutating({ mutationKey: reservationMutationKeys.all() })).toBe(0);
  });

  it("저장하는 사이 늦게 도착한 이전 조회 응답이 새 예약을 지우지 못한다", async () => {
    let releaseOldList!: () => void;
    const oldListHeld = new Promise<void>((resolve) => (releaseOldList = resolve));
    fetchMock
      .mockImplementationOnce(async () => {
        await oldListHeld;
        return json([]);
      })
      .mockImplementationOnce(async () => json(reservation(), 201))
      .mockImplementation(async () => json([reservation()]));
    const list = openList(day("2026-10-22"));
    await vi.waitFor(() => expect(requests()).toEqual([listOf("2026-10-22")]));

    await register();
    releaseOldList();
    await list.settled();
    expect(times(list.rows())).toEqual(["10:00 김서연"]);
  });
});

describe("예약 수정", () => {
  it("같은 예약을 PUT으로 갱신하고 서버가 준 예약으로 목록을 바꾼다", async () => {
    const original = reservation();
    const updated = reservation({ customer: seoSameName, treatments: [art], startAt: at(13) });
    let changed = false;
    serve((request) => {
      if (request === "PUT /reservations/100") {
        changed = true;
        return json(updated);
      }
      return json([changed ? updated : original]);
    });
    const list = openList(day("2026-10-22"));
    await list.settled();

    const result = await updateReservation(
      client,
      100,
      input({ customerId: "2", treatmentIds: ["2"], startTime: "13:00" }),
    );

    expect(result).toEqual({ kind: "updated", reservation: updated });
    expect(sentBody("PUT /reservations/100")).toEqual({
      customerId: 2,
      treatmentIds: [2],
      startAt: at(13),
    });
    await list.settled();
    expect(list.rows()).toEqual([updated]);
  });

  it("날짜를 옮기면 재조회가 실패해도 기존 날짜에서 빠지고 바뀐 날짜에 시간순으로 들어간다", async () => {
    const original = reservation();
    const other = reservation({ id: 101, startAt: at(12, 0, 23), customer: seoSameName });
    const moved = reservation({ startAt: at(9, 0, 23) });
    let saved = false;
    serve((request) => {
      if (request === "PUT /reservations/100") {
        saved = true;
        return json(moved);
      }
      if (saved) return json({}, 500);
      return json(request === listOf("2026-10-22") ? [original] : [other]);
    });
    const oldDay = openList(day("2026-10-22"));
    const newDay = openList(day("2026-10-23"));
    await oldDay.settled();
    await newDay.settled();

    await updateReservation(client, 100, input({ date: "2026-10-23", startTime: "09:00" }));
    await oldDay.settled();
    await newDay.settled();

    expect(oldDay.rows()).toEqual([]);
    expect(newDay.rows()?.map((row) => row.id)).toEqual([100, 101]);
  });

  it("이미 없는 예약이면(404) 덮어쓰지 않고 목록에서 내린다", async () => {
    let gone = false;
    serve((request) => {
      if (request === "PUT /reservations/100") {
        gone = true;
        return defined("NOT_FOUND", 404);
      }
      return json(gone ? [] : [reservation()]);
    });
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect(await updateReservation(client, 100, input({ startTime: "15:00" }))).toEqual({
      kind: "not_found",
      refreshed: true,
    });
    expect(list.rows()).toEqual([]);
  });

  it("이미 취소됐으면(409) 서버가 확인한 취소 기록을 반영하고 재조회 실패는 따로 알린다", async () => {
    const original = reservation();
    const cancelled = reservation({ cancelledAt: at(8), cancelReason: "최초 사유" });
    let conflicted = false;
    serve((request) => {
      if (request === "PUT /reservations/100") {
        conflicted = true;
        return defined("CONFLICT", 409, { reservation: cancelled });
      }
      return conflicted ? json({}, 500) : json([original]);
    });
    const basic = openList(day("2026-10-22"));
    const withCancelled = openList(day("2026-10-22", true));
    await basic.settled();
    await withCancelled.settled();

    const result = await updateReservation(client, 100, input({ startTime: "15:00" }));

    expect(result).toEqual({ kind: "cancelled", reservation: cancelled, refreshed: false });
    expect(basic.rows()).toEqual([]);
    expect(withCancelled.rows()).toEqual([cancelled]);
    const screen = basic.screen();
    expect(screen.kind === "loaded" && screen.refreshFailed).toBe(true);
  });

  it("거부되면(422) 사유를 돌려주고 목록은 다시 불러오지 않는다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([reservation()]))
      .mockImplementationOnce(async () =>
        defined("UNPROCESSABLE_CONTENT", 422, { reason: "schedule_out_of_range" }),
      );
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect(await updateReservation(client, 100, input())).toEqual({
      kind: "rejected",
      reason: "schedule_out_of_range",
    });
    expect(requests()).toEqual([listOf("2026-10-22"), "PUT /reservations/100"]);
    expect(list.rows()).toEqual([reservation()]);
  });

  it("결과를 알 수 없으면 원래 행을 지우지 않고 다시 보내지 않으며 목록만 다시 불러온다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([reservation()]))
      .mockImplementationOnce(async () => unreachable())
      .mockImplementationOnce(async () => json([reservation()]));
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect(await updateReservation(client, 100, input({ startTime: "15:00" }))).toEqual({
      kind: "unknown",
    });
    await vi.waitFor(() =>
      expect(requests()).toEqual([
        listOf("2026-10-22"),
        "PUT /reservations/100",
        listOf("2026-10-22"),
      ]),
    );
    await list.settled();
    expect(list.rows()).toEqual([reservation()]);
  });
});

describe("예약 취소", () => {
  it("사유를 보내고 기본 목록에서 빼며 취소 포함 목록에는 서버가 기록한 취소로 남긴다", async () => {
    const original = reservation();
    const cancelled = reservation({
      cancelledAt: Date.parse("2026-10-22T05:03:00Z"),
      cancelReason: "고객 요청",
    });
    let done = false;
    serve((request) => {
      if (request === "POST /reservations/100/cancel") {
        done = true;
        return json(cancelled);
      }
      if (request === listOf("2026-10-22", true)) return json([done ? cancelled : original]);
      return json(done ? [] : [original]);
    });
    const basic = openList(day("2026-10-22"));
    const withCancelled = openList(day("2026-10-22", true));
    await basic.settled();
    await withCancelled.settled();

    const result = await cancelReservation(client, 100, { reason: "고객 요청" });

    expect(result).toEqual({ kind: "cancelled", reservation: cancelled });
    expect(sentBody("POST /reservations/100/cancel")).toEqual({ reason: "고객 요청" });
    expect(basic.rows()).toEqual([]);
    expect(withCancelled.rows()).toEqual([cancelled]);
    expect(formatMoment(withCancelled.rows()?.[0]?.cancelledAt ?? 0)).toBe("10월 22일 14:03");
  });

  it("사유가 없으면 null을 보낸다", async () => {
    serve(async (request) =>
      request.startsWith("POST") ? json(reservation({ cancelledAt: at(14) })) : json([]),
    );

    await cancelReservation(client, 100, { reason: null });
    expect(sentBody("POST /reservations/100/cancel")).toEqual({ reason: null });
  });

  it("이미 취소됐으면(409) 재조회가 실패해도 처음 취소 기록으로 반영한다", async () => {
    const original = reservation();
    const first = reservation({ cancelledAt: at(8), cancelReason: "최초 사유" });
    let conflicted = false;
    serve((request) => {
      if (request === "POST /reservations/100/cancel") {
        conflicted = true;
        return defined("CONFLICT", 409, { reservation: first });
      }
      return conflicted ? json({}, 500) : json([original]);
    });
    const basic = openList(day("2026-10-22"));
    const withCancelled = openList(day("2026-10-22", true));
    await basic.settled();
    await withCancelled.settled();

    const result = await cancelReservation(client, 100, { reason: "두 번째 사유" });

    expect(result).toEqual({ kind: "already_cancelled", reservation: first, refreshed: false });
    expect(basic.rows()).toEqual([]);
    expect(withCancelled.rows()).toEqual([first]);
  });

  it("이미 없는 예약이면(404) 없다고 알리고 목록에서 내린다", async () => {
    let gone = false;
    serve((request) => {
      if (request === "POST /reservations/100/cancel") {
        gone = true;
        return defined("NOT_FOUND", 404);
      }
      return json(gone ? [] : [reservation()]);
    });
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect(await cancelReservation(client, 100, { reason: null })).toEqual({
      kind: "not_found",
      refreshed: true,
    });
    expect(list.rows()).toEqual([]);
  });

  it("사유 형식을 거부하면(400) 거부로 알리고 목록은 그대로 둔다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([reservation()]))
      .mockImplementationOnce(async () =>
        invalidInput([{ path: ["reason"], message: "취소 사유는 200자 이하로 입력해주세요." }]),
      );
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect(await cancelReservation(client, 100, { reason: "사유" })).toEqual({ kind: "rejected" });
    expect(list.rows()).toEqual([reservation()]);
    expect(requests()).toHaveLength(2);
  });

  it("결과를 알 수 없으면 다시 보내지 않고 목록만 다시 불러온다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([reservation()]))
      .mockImplementationOnce(async () => json({}, 503))
      .mockImplementationOnce(async () => json([]));
    const list = openList(day("2026-10-22"));
    await list.settled();

    expect(await cancelReservation(client, 100, { reason: null })).toEqual({ kind: "unknown" });
    await vi.waitFor(() =>
      expect(requests()).toEqual([
        listOf("2026-10-22"),
        "POST /reservations/100/cancel",
        listOf("2026-10-22"),
      ]),
    );
    await list.settled();
    // 서버에서 취소됐다면 다시 불러온 기본 목록에서 빠진다
    expect(list.rows()).toEqual([]);
  });

  it("취소 전에 시작한 이전 조회가 늦게 도착해도 취소를 되돌리지 못한다", async () => {
    let releaseOldList!: () => void;
    const oldListHeld = new Promise<void>((resolve) => (releaseOldList = resolve));
    fetchMock
      .mockImplementationOnce(async () => {
        await oldListHeld;
        return json([reservation()]);
      })
      .mockImplementationOnce(async () => json(reservation({ cancelledAt: at(14) })))
      .mockImplementation(async () => json([]));
    const list = openList(day("2026-10-22"));
    await vi.waitFor(() => expect(requests()).toEqual([listOf("2026-10-22")]));

    await cancelReservation(client, 100, { reason: null });
    releaseOldList();
    await list.settled();
    expect(list.rows()).toEqual([]);
  });
});
