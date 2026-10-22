import type { Customer } from "@o2o/shared/contracts";

import { customerInputSchema, customerUpdateSchema } from "@o2o/shared/contracts";
import { ORPCError } from "@orpc/client";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveListState } from "@/shared/ui/data-table/data-table.state.ts";

import {
  customerQueries,
  deleteCustomer,
  registerCustomer,
  updateCustomer,
} from "./customers.api.ts";

// 경계는 HTTP 계약만, 그 안쪽은 실물로 돌린다
vi.hoisted(() => {
  vi.stubEnv("VITE_SERVER_URL", "https://api.example.test/");
});

const kim = { id: 1, name: "김서연", phone: "01000000001" };
const lee = { id: 2, name: "이지우", phone: "01000000002" };

const json = (body: unknown, status = 200) => Response.json(body, { status });
const contractError = (code: "NOT_FOUND" | "CONFLICT", status: number) =>
  json({ defined: true, code, message: code }, status);

const unreachable = () => {
  throw new TypeError("Failed to fetch");
};

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

const requests = () =>
  fetchMock.mock.calls.map(([url, init]) => `${init.method} ${new URL(url).pathname}`);

const sentBody = (index: number) => JSON.parse(String(fetchMock.mock.calls[index]?.[1].body));

let client: QueryClient;
const unsubscribers: Array<() => void> = [];

// screen()은 DataTable이 그릴 상태
function openCustomerList() {
  const observer = new QueryObserver(client, customerQueries.list());
  unsubscribers.push(observer.subscribe(() => {}));
  return {
    screen: () => resolveListState(observer.getCurrentResult()),
    reload: () => observer.refetch(),
    settled: () => vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false)),
  };
}

function loaded(rows: ReadonlyArray<Customer>) {
  return { kind: "loaded", rows, refreshFailed: false, retrying: false };
}

// 폼처럼 스키마로 다듬어 저장
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
      expected: { kind: "loaded", rows: [], refreshFailed: false, retrying: false },
    },
    {
      situation: "서버 오류(500)",
      respond: async () => json({}, 500),
      expected: { kind: "failed", retrying: false },
    },
    {
      situation: "서버에 닿지 않음",
      respond: async () => unreachable(),
      expected: { kind: "failed", retrying: false },
    },
    {
      situation: "id가 문자열인 응답",
      respond: async () => json([{ ...kim, id: "1" }]),
      expected: { kind: "failed", retrying: false },
    },
    {
      situation: "배열이 아닌 응답",
      respond: async () => json({ customers: [kim] }),
      expected: { kind: "failed", retrying: false },
    },
  ])("$situation: 화면 상태는 $expected.kind", async ({ respond, expected }) => {
    fetchMock.mockImplementation(respond);
    const list = openCustomerList();

    await list.settled();
    expect(list.screen()).toEqual(expected);
  });

  it("조회 실패 뒤 다시 시도하면 실패 표시를 둔 채 다시 시도 중을 거쳐 목록이 나온다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json({}, 500))
      .mockImplementation(async () => json([kim]));
    const list = openCustomerList();
    await list.settled();
    expect(list.screen()).toEqual({ kind: "failed", retrying: false });

    const reloading = list.reload();
    expect(list.screen()).toEqual({ kind: "failed", retrying: true });
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
    expect(list.screen()).toEqual({
      kind: "loaded",
      rows: [kim],
      refreshFailed: true,
      retrying: false,
    });

    // 재시도 중에도 실패 표시를 두고 다시 시도 중만 알린다
    const reloading = list.reload();
    expect(list.screen()).toEqual({
      kind: "loaded",
      rows: [kim],
      refreshFailed: true,
      retrying: true,
    });
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
    // 폼을 거치지 않은 값도 서버가 다시 확인
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

    // 첫 조회 응답이 이제 도착
    releaseOldList();
    await list.settled();
    expect(list.screen()).toEqual(loaded([lee, kim]));
  });
});

describe("고객 수정", () => {
  const edited = { ...kim, name: "김서연B", phone: "01000000009" };

  // 폼처럼 스키마로 다듬어 저장
  function update(input: { id: number; name: string; phone: string }) {
    return updateCustomer(client, customerUpdateSchema.parse(input));
  }

  it("입력을 다듬어 보내고 목록의 같은 자리에서 고쳐진 고객으로 바꾼다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([lee, kim]))
      .mockImplementationOnce(async () => json(edited))
      .mockImplementationOnce(async () => json([lee, edited]));
    const list = openCustomerList();
    await list.settled();

    const result = await update({ id: kim.id, name: " 김서연B ", phone: "010-0000-0009" });

    expect(result).toEqual({ kind: "updated", customer: edited });
    expect(sentBody(1)).toEqual({ name: edited.name, phone: edited.phone });
    expect(list.screen()).toEqual(loaded([lee, edited]));
    expect(requests()).toEqual(["GET /customers", "PUT /customers/1", "GET /customers"]);
  });

  it("열어 둔 상세 캐시도 고쳐진 값으로 바꾼다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json(kim))
      .mockImplementationOnce(async () => json(edited));
    await client.fetchQuery(customerQueries.detail(kim.id));

    await update({ id: kim.id, name: edited.name, phone: edited.phone });
    expect(client.getQueryData(customerQueries.detail(kim.id).queryKey)).toEqual(edited);
  });

  it("다른 고객이 쓰는 전화번호는 중복으로 알리고 목록은 그대로 둔다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([lee, kim]))
      .mockImplementationOnce(async () => contractError("CONFLICT", 409));
    const list = openCustomerList();
    await list.settled();

    expect(await update({ id: kim.id, name: kim.name, phone: lee.phone })).toEqual({
      kind: "duplicate",
    });
    expect(list.screen()).toEqual(loaded([lee, kim]));
    expect(requests()).toEqual(["GET /customers", "PUT /customers/1"]);
  });

  it("이미 없는 고객이면 NOT_FOUND로 알리고 목록에서도 내린다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([lee, kim]))
      .mockImplementationOnce(async () => contractError("NOT_FOUND", 404))
      .mockImplementationOnce(async () => json([lee]));
    const list = openCustomerList();
    await list.settled();

    expect(await update({ id: kim.id, name: edited.name, phone: edited.phone })).toEqual({
      kind: "not_found",
    });
    expect(list.screen()).toEqual(loaded([lee]));
  });

  it("서버가 입력을 거절하면(400) 실패로 알린다", async () => {
    // 폼을 거치지 않은 값도 서버가 다시 확인
    fetchMock.mockImplementationOnce(async () =>
      json({ defined: false, code: "BAD_REQUEST", message: "Input validation failed" }, 400),
    );

    expect(await updateCustomer(client, { id: kim.id, name: "김서연", phone: "12" })).toEqual({
      kind: "failed",
    });
  });

  it.each([
    { situation: "서버 오류(500)", respond: async () => json({}, 500) },
    { situation: "서버에 닿지 않음", respond: async () => unreachable() },
  ])("수정 실패($situation)는 실패로 알리고 보이던 목록을 그대로 둔다", async ({ respond }) => {
    fetchMock.mockImplementationOnce(async () => json([lee, kim])).mockImplementationOnce(respond);
    const list = openCustomerList();
    await list.settled();

    expect(await update({ id: kim.id, name: edited.name, phone: edited.phone })).toEqual({
      kind: "failed",
    });
    expect(list.screen()).toEqual(loaded([lee, kim]));
  });

  it("수정하는 사이 늦게 도착한 이전 조회 응답이 고친 값을 되돌리지 못한다", async () => {
    let releaseOldList!: () => void;
    const oldListHeld = new Promise<void>((resolve) => (releaseOldList = resolve));
    fetchMock
      .mockImplementationOnce(async () => {
        await oldListHeld;
        return json([lee, kim]);
      })
      .mockImplementationOnce(async () => json(edited))
      .mockImplementation(async () => json([lee, edited]));
    const list = openCustomerList();
    await vi.waitFor(() => expect(requests()).toEqual(["GET /customers"]));

    await update({ id: kim.id, name: edited.name, phone: edited.phone });
    releaseOldList();
    await list.settled();
    expect(list.screen()).toEqual(loaded([lee, edited]));
  });
});

describe("고객 삭제", () => {
  const noContent = () => new Response(null, { status: 204 });

  it("지운 고객을 목록에서 내리고 서버 순서로 다시 맞춘다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([lee, kim]))
      .mockImplementationOnce(async () => noContent())
      .mockImplementationOnce(async () => json([kim]));
    const list = openCustomerList();
    await list.settled();

    expect(await deleteCustomer(client, lee.id)).toEqual({ kind: "deleted" });
    expect(list.screen()).toEqual(loaded([kim]));
    expect(requests()).toEqual(["GET /customers", "DELETE /customers/2", "GET /customers"]);
  });

  it("지운 고객의 상세 캐시도 지운다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json(lee))
      .mockImplementationOnce(async () => noContent());
    await client.fetchQuery(customerQueries.detail(lee.id));

    await deleteCustomer(client, lee.id);
    expect(client.getQueryData(customerQueries.detail(lee.id).queryKey)).toBeUndefined();
  });

  it("이미 없는 고객이면 NOT_FOUND로 알리고 목록에서도 내린다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([lee, kim]))
      .mockImplementationOnce(async () => contractError("NOT_FOUND", 404))
      .mockImplementationOnce(async () => json([kim]));
    const list = openCustomerList();
    await list.settled();

    expect(await deleteCustomer(client, lee.id)).toEqual({ kind: "not_found" });
    expect(list.screen()).toEqual(loaded([kim]));
  });

  it.each([
    { situation: "서버 오류(500)", respond: async () => json({}, 500) },
    { situation: "서버에 닿지 않음", respond: async () => unreachable() },
  ])("삭제 실패($situation)는 실패로 알리고 보이던 목록을 그대로 둔다", async ({ respond }) => {
    fetchMock.mockImplementationOnce(async () => json([lee, kim])).mockImplementationOnce(respond);
    const list = openCustomerList();
    await list.settled();

    expect(await deleteCustomer(client, lee.id)).toEqual({ kind: "failed" });
    expect(list.screen()).toEqual(loaded([lee, kim]));
    expect(requests()).toEqual(["GET /customers", "DELETE /customers/2"]);
  });
});

describe("고객 한 명 조회", () => {
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
