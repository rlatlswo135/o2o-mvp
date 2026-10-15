import type { Customer } from "@o2o/shared/contracts";

import { customerInputSchema } from "@o2o/shared/contracts";
import { ORPCError } from "@orpc/client";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveTableState } from "@/shared/ui/data-table/data-table.tsx";

import { customerQueries, registerCustomer } from "./customers.api.ts";

// 경계는 서버와의 HTTP 계약 하나다. 그 안쪽(oRPC 클라이언트·응답 확인·query 캐시·입력 확인)은 전부 실물로 돌린다.
vi.hoisted(() => {
  vi.stubEnv("VITE_SERVER_URL", "https://api.example.test/");
});

const kim = { id: 1, name: "김서연", phone: "01000000001" };
const lee = { id: 2, name: "이지우", phone: "01000000002" };

/** 서버가 계약대로 돌려주는 응답. 오류는 oRPC가 계약의 오류를 실어 보내는 모양이다. */
const json = (body: unknown, status = 200) => Response.json(body, { status });
const contractError = (code: "NOT_FOUND" | "CONFLICT", status: number) =>
  json({ defined: true, code, message: code }, status);

const unreachable = () => {
  throw new TypeError("Failed to fetch");
};

// 요청은 보낸 순서대로 `mockImplementationOnce`로 응답을 정해 두고, 그 뒤 요청은 `mockImplementation`이 받는다.
const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

/** 보낸 요청을 `"GET /customers"`처럼 메서드와 경로로 본다. */
const requests = () =>
  fetchMock.mock.calls.map(([url, init]) => `${init.method} ${new URL(url).pathname}`);

const sentBody = (index: number) => JSON.parse(String(fetchMock.mock.calls[index]?.[1].body));

let client: QueryClient;
const unsubscribers: Array<() => void> = [];

/** 고객 화면이 목록을 열어 둔 상태. 화면이 보는 값은 목록 표(DataTable)가 그릴 상태다. */
function openCustomerList() {
  const observer = new QueryObserver(client, customerQueries.list());
  unsubscribers.push(observer.subscribe(() => {}));
  return {
    screen: () => resolveTableState(observer.getCurrentResult()),
    reload: () => observer.refetch(),
    settled: () => vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false)),
  };
}

function loaded(rows: ReadonlyArray<Customer>) {
  return { kind: "loaded", rows, refreshFailed: false };
}

/** 화면이 저장하는 길. 폼은 스키마 확인을 통과한 입력을 parse해 다듬은 값을 넘긴다. */
function register(input: { name: string; phone: string }) {
  return registerCustomer(client, customerInputSchema.parse(input));
}

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

describe("고객 목록 조회", () => {
  it("응답 전에는 비어 있다고 단정하지 않고 응답이 오면 서버 순서 그대로 보여준다", async () => {
    fetchMock.mockImplementation(async () => json([lee, kim]));
    const list = openCustomerList();

    expect(list.screen()).toEqual({ kind: "loading" });
    await list.settled();
    expect(list.screen()).toEqual(loaded([lee, kim]));
  });

  it.each([
    {
      situation: "고객이 없는 서버",
      respond: async () => json([]),
      expected: { kind: "loaded", rows: [], refreshFailed: false },
    },
    {
      situation: "서버 오류(500)",
      respond: async () => json({}, 500),
      expected: { kind: "failed" },
    },
    {
      situation: "서버에 닿지 않음",
      respond: async () => unreachable(),
      expected: { kind: "failed" },
    },
    {
      situation: "id가 문자열인 응답",
      respond: async () => json([{ ...kim, id: "1" }]),
      expected: { kind: "failed" },
    },
    {
      situation: "배열이 아닌 응답",
      respond: async () => json({ customers: [kim] }),
      expected: { kind: "failed" },
    },
  ])("$situation: 화면 상태는 $expected.kind", async ({ respond, expected }) => {
    fetchMock.mockImplementation(respond);
    const list = openCustomerList();

    await list.settled();
    expect(list.screen()).toEqual(expected);
  });

  it("조회 실패 뒤 다시 시도하면 다시 불러오는 중을 거쳐 목록이 나온다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json({}, 500))
      .mockImplementation(async () => json([kim]));
    const list = openCustomerList();
    await list.settled();
    expect(list.screen()).toEqual({ kind: "failed" });

    const reloading = list.reload();
    expect(list.screen()).toEqual({ kind: "loading" });
    await reloading;
    expect(list.screen()).toEqual(loaded([kim]));
  });

  it("다시 불러오기가 실패해도 보이던 목록을 유지하고 실패만 따로 알린다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([kim]))
      .mockImplementationOnce(async () => json({}, 500))
      .mockImplementation(async () => json([kim]));
    const list = openCustomerList();
    await list.settled();

    await list.reload();
    expect(list.screen()).toEqual({ kind: "loaded", rows: [kim], refreshFailed: true });

    // 다시 시도하는 동안에는 실패 표시를 내리고, 성공하면 최신 목록으로 바뀐다.
    const reloading = list.reload();
    expect(list.screen()).toEqual(loaded([kim]));
    await reloading;
    expect(list.screen()).toEqual(loaded([kim]));
  });
});

describe("고객 등록", () => {
  it("입력을 다듬어(이름 앞뒤 공백, 전화번호는 숫자만) 보내고 새 고객을 목록 맨 위에 올린다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([kim]))
      .mockImplementationOnce(async () => json(lee, 201))
      .mockImplementationOnce(async () => json([lee, kim]));
    const list = openCustomerList();
    await list.settled();

    const result = await register({ name: "  이지우 ", phone: " 010-0000-0002 " });

    expect(result).toEqual({ kind: "created", customer: lee });
    expect(sentBody(1)).toEqual({ name: lee.name, phone: lee.phone });
    expect(list.screen()).toEqual(loaded([lee, kim]));
    // 저장 뒤 서버 순서로 다시 맞춘다.
    expect(requests()).toEqual(["GET /customers", "POST /customers", "GET /customers"]);
  });

  it("목록을 열지 않은 채 등록해도 서버에 보낸다", async () => {
    fetchMock.mockImplementationOnce(async () => json(kim, 201));

    expect(await register({ name: "김서연", phone: "010-0000-0001" })).toMatchObject({
      kind: "created",
    });
    expect(sentBody(0)).toEqual({ name: kim.name, phone: kim.phone });
  });

  it("이미 있는 전화번호는 중복으로 알리고 목록은 그대로 둔다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([kim]))
      .mockImplementationOnce(async () => contractError("CONFLICT", 409));
    const list = openCustomerList();
    await list.settled();

    expect(await register({ name: "다른 사람", phone: kim.phone })).toEqual({ kind: "duplicate" });
    expect(list.screen()).toEqual(loaded([kim]));
    expect(requests()).toEqual(["GET /customers", "POST /customers"]);
  });

  it("서버가 입력을 거절하면(400) 실패로 알린다", async () => {
    // 폼 확인을 거치지 않은 값이 와도 서버가 같은 계약으로 다시 확인한다.
    fetchMock.mockImplementationOnce(async () =>
      json({ defined: false, code: "BAD_REQUEST", message: "Input validation failed" }, 400),
    );

    expect(await registerCustomer(client, { name: "김서연", phone: "12" })).toEqual({
      kind: "failed",
    });
  });

  it.each([
    { situation: "서버 오류(500)", respond: async () => json({}, 500) },
    { situation: "서버에 닿지 않음", respond: async () => unreachable() },
  ])("저장 실패($situation)는 실패로 알리고 보이던 목록을 그대로 둔다", async ({ respond }) => {
    fetchMock.mockImplementationOnce(async () => json([kim])).mockImplementationOnce(respond);
    const list = openCustomerList();
    await list.settled();

    expect(await register({ name: "이지우", phone: lee.phone })).toEqual({ kind: "failed" });
    expect(list.screen()).toEqual(loaded([kim]));
  });

  it("실패한 입력은 고친 뒤 다시 등록할 수 있다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json({}, 500))
      .mockImplementationOnce(async () => json(kim, 201));

    expect(await register({ name: "김서연", phone: kim.phone })).toEqual({ kind: "failed" });
    expect(await register({ name: "김서연", phone: kim.phone })).toMatchObject({ kind: "created" });
  });

  it("등록하는 사이 늦게 도착한 이전 조회 응답이 새 고객을 지우지 못한다", async () => {
    let releaseOldList!: () => void;
    const oldListHeld = new Promise<void>((resolve) => (releaseOldList = resolve));
    fetchMock
      .mockImplementationOnce(async () => {
        await oldListHeld;
        return json([kim]);
      })
      .mockImplementationOnce(async () => json(lee, 201))
      .mockImplementation(async () => json([lee, kim]));
    const list = openCustomerList();
    await vi.waitFor(() => expect(requests()).toEqual(["GET /customers"]));

    await register({ name: "이지우", phone: lee.phone });
    expect(list.screen()).toEqual(loaded([lee, kim]));

    // 처음 요청한 조회(고객이 김서연뿐이던 시점)의 응답이 이제야 도착한다.
    releaseOldList();
    await list.settled();
    expect(list.screen()).toEqual(loaded([lee, kim]));
  });
});

describe("고객 한 명 조회", () => {
  /** 고객 상세를 열어 둔 상태. */
  function openCustomerDetail(id: number) {
    const observer = new QueryObserver(client, customerQueries.detail(id));
    unsubscribers.push(observer.subscribe(() => {}));
    return {
      result: () => observer.getCurrentResult(),
      settled: () => vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false)),
    };
  }

  it("id로 고객 한 명을 불러온다", async () => {
    fetchMock.mockImplementation(async () => json(kim));
    const detail = openCustomerDetail(kim.id);

    await detail.settled();
    expect(detail.result().data).toEqual(kim);
    expect(requests()).toEqual(["GET /customers/1"]);
  });

  it("없는 고객이면 NOT_FOUND로 실패해 다른 실패와 구분할 수 있다", async () => {
    fetchMock.mockImplementation(async () => contractError("NOT_FOUND", 404));
    const detail = openCustomerDetail(99);

    await detail.settled();
    const { error } = detail.result();
    expect(error instanceof ORPCError && error.code).toBe("NOT_FOUND");
  });

  it.each([
    { situation: "서버 오류(500)", respond: async () => json({}, 500) },
    { situation: "서버에 닿지 않음", respond: async () => unreachable() },
  ])("조회 실패($situation)는 NOT_FOUND가 아닌 실패다", async ({ respond }) => {
    fetchMock.mockImplementation(respond);
    const detail = openCustomerDetail(kim.id);

    await detail.settled();
    const { status, error } = detail.result();
    expect(status).toBe("error");
    expect(error instanceof ORPCError && error.code).not.toBe("NOT_FOUND");
  });
});
