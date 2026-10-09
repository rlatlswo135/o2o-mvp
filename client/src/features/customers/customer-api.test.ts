import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { HTTPError, SchemaValidationError } from "ky";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createCustomerMutationOptions, customersQueryOptions } from "./customer-api.ts";

vi.hoisted(() => {
  vi.stubEnv("VITE_SERVER_URL", "https://api.example.test/");
});

type Fetch = (request: Request, options?: RequestInit) => Promise<Response>;

const customer = { id: 1, name: "테스트 고객", phone: "010-0000-0001" };
const created = { id: 2, name: "새 고객", phone: "010-0000-0002" };
const input = { name: created.name, phone: created.phone };
let client: QueryClient;

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
});

afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("customersQueryOptions", () => {
  it("환경변수의 서버 URL로 prefetch하고 목록 조회는 같은 key의 캐시를 재사용한다", async () => {
    const fetch = vi.fn<Fetch>().mockResolvedValue(Response.json([customer]));
    vi.stubGlobal("fetch", fetch);

    await client.prefetchQuery(customersQueryOptions);
    expect(client.getQueryData(customersQueryOptions.queryKey)).toEqual([customer]);
    expect(await client.fetchQuery(customersQueryOptions)).toEqual([customer]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const request = fetch.mock.calls[0]?.[0];
    expect(request?.url).toBe("https://api.example.test/customers");
    expect(request?.method).toBe("GET");
    expect(request?.signal).toBeInstanceOf(AbortSignal);
  });

  it("빈 목록은 정상 결과로 유지한다", async () => {
    vi.stubGlobal("fetch", vi.fn<Fetch>().mockResolvedValue(Response.json([])));
    expect(await client.fetchQuery(customersQueryOptions)).toEqual([]);
  });

  it("HTTP 실패를 빈 목록으로 바꾸거나 자동 재시도하지 않는다", async () => {
    const fetch = vi.fn<Fetch>().mockResolvedValue(Response.json({}, { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    await expect(client.fetchQuery(customersQueryOptions)).rejects.toMatchObject({
      response: { status: 500 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(customersQueryOptions.queryKey)).toBeUndefined();
  });

  it.each([
    { body: [{ ...customer, id: "1" }] },
    { body: "customer findAll" },
    { body: { customers: [customer] } },
  ])("계약과 다른 목록 $body는 거절한다", async ({ body }) => {
    vi.stubGlobal("fetch", vi.fn<Fetch>().mockResolvedValue(Response.json(body)));
    await expect(client.fetchQuery(customersQueryOptions)).rejects.toBeInstanceOf(
      SchemaValidationError,
    );
    expect(client.getQueryData(customersQueryOptions.queryKey)).toBeUndefined();
  });
});

describe("createCustomerMutationOptions", () => {
  it("공통 ky 인스턴스로 JSON 등록하고 새 고객 추가 뒤 활성 목록을 다시 조회한다", async () => {
    let postedBody: unknown;
    const fetch = vi
      .fn<Fetch>()
      .mockImplementationOnce(async (request) => {
        postedBody = await request.json();
        return Response.json(created, { status: 201 });
      })
      .mockResolvedValueOnce(Response.json([created, customer]));
    vi.stubGlobal("fetch", fetch);
    client.setQueryData(customersQueryOptions.queryKey, [customer]);
    const list = new QueryObserver(client, customersQueryOptions);
    const unsubscribe = list.subscribe(() => {});
    const mutation = new MutationObserver(client, createCustomerMutationOptions(client));

    expect(await mutation.mutate(input)).toEqual(created);
    const post = fetch.mock.calls[0]?.[0];
    expect(post?.url).toBe("https://api.example.test/customers");
    expect(post?.method).toBe("POST");
    expect(post?.headers.get("content-type")).toBe("application/json");
    expect(postedBody).toEqual(input);
    expect(fetch.mock.calls[1]?.[0].method).toBe("GET");
    expect(client.getQueryData(customersQueryOptions.queryKey)).toEqual([created, customer]);
    unsubscribe();
  });

  it.each([409, 500])("등록 실패 %s는 기존 캐시를 변경하지 않는다", async (status) => {
    vi.stubGlobal("fetch", vi.fn<Fetch>().mockResolvedValue(Response.json({}, { status })));
    client.setQueryData(customersQueryOptions.queryKey, [customer]);
    const mutation = new MutationObserver(client, createCustomerMutationOptions(client));

    await expect(mutation.mutate(input)).rejects.toBeInstanceOf(HTTPError);
    expect(mutation.getCurrentResult().error).toMatchObject({ response: { status } });
    expect(client.getQueryData(customersQueryOptions.queryKey)).toEqual([customer]);
  });

  it("등록 성공 시 이전 조회를 취소해서 늦은 응답이 새 고객을 덮지 못한다", async () => {
    const { promise: oldResponse, resolve: resolveList } = Promise.withResolvers<Response>();
    const fetch = vi
      .fn<Fetch>()
      .mockReturnValueOnce(oldResponse)
      .mockResolvedValueOnce(Response.json(created, { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    const pendingList = client.prefetchQuery(customersQueryOptions);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const signal = fetch.mock.calls[0]?.[0].signal;
    const mutation = new MutationObserver(client, createCustomerMutationOptions(client));

    await mutation.mutate(input);
    expect(signal?.aborted).toBe(true);
    resolveList(Response.json([]));
    await pendingList;
    expect(client.getQueryData(customersQueryOptions.queryKey)).toEqual([created]);
    expect(client.getQueryState(customersQueryOptions.queryKey)?.isInvalidated).toBe(true);
  });
});
