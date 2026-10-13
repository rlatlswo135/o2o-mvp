import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { Customer, CustomerInput } from "./customer.ts";

import { customersQueryOptions } from "./customer-api.ts";
import { registerCustomer, toListQuery } from "./customer-flow.ts";

// 경계는 서버와의 HTTP 계약 하나다. 그 안쪽(ky·zod·query 캐시·입력 확인)은 전부 실물로 돌린다.
vi.hoisted(() => {
  vi.stubEnv("VITE_SERVER_URL", "https://api.example.test/");
});

type Fault = number | "network";

/** 서버 계약(GET 목록·POST 등록·전화번호 중복 409)을 흉내 내는 메모리 서버. 목록은 최근 등록순이다. */
function createFakeServer(seed: ReadonlyArray<Customer> = []) {
  const rows = [...seed];
  const requests: string[] = [];
  let nextId = Math.max(0, ...seed.map((row) => row.id)) + 1;
  let fault: Fault | null = null;
  let listBody: unknown;
  let gate: Promise<void> | null = null;

  async function handle(request: Request): Promise<Response> {
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
    if (fault === "network") throw new TypeError("Failed to fetch");
    if (fault !== null) return Response.json({}, { status: fault });

    if (request.method === "GET") {
      const body = listBody ?? rows;
      // 응답은 요청 시점 기준이고, 붙잡아 두면 늦게 도착한다.
      const held = gate;
      gate = null;
      if (held) await held;
      return Response.json(body);
    }

    const input = (await request.json()) as CustomerInput;
    if (rows.some((row) => row.phone === input.phone)) return Response.json({}, { status: 409 });
    const created = { id: nextId++, ...input };
    rows.unshift(created);
    return Response.json(created, { status: 201 });
  }

  return {
    handle,
    requests,
    stored: () => rows.map(({ name, phone }) => ({ name, phone })),
    fail: (next: Fault) => void (fault = next),
    recover: () => void (fault = null),
    /** 목록 응답 본문을 계약과 다른 값으로 바꾼다. */
    serveList: (body: unknown) => void (listBody = body),
    /** 다음 목록 요청의 응답을 release를 부를 때까지 붙잡는다. */
    holdNextList: () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      gate = promise;
      return resolve;
    },
  };
}

const kim = { id: 1, name: "김서연", phone: "010-0000-0001" };
const lee = { id: 2, name: "이지우", phone: "010-0000-0002" };

let client: QueryClient;
let server: ReturnType<typeof createFakeServer>;
const unsubscribers: Array<() => void> = [];

function startServer(seed?: ReadonlyArray<Customer>) {
  server = createFakeServer(seed);
  vi.stubGlobal("fetch", (request: Request) => server.handle(request));
}

/** 고객 화면이 목록을 열어 둔 상태. 화면이 보는 값은 toListQuery를 거친 상태다. */
function openCustomerList() {
  const observer = new QueryObserver(client, customersQueryOptions);
  unsubscribers.push(observer.subscribe(() => {}));
  return {
    screen: () => toListQuery(observer.getCurrentResult()),
    reload: () => observer.refetch(),
    settled: () => vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false)),
  };
}

function register(input: CustomerInput) {
  return registerCustomer(client, input);
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  startServer();
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
    startServer([lee, kim]);
    const list = openCustomerList();

    expect(list.screen()).toEqual({ kind: "loading" });
    await list.settled();
    expect(list.screen()).toEqual({ kind: "loaded", customers: [lee, kim] });
  });

  it.each([
    { situation: "고객이 없는 서버", setup: () => {}, expected: { kind: "loaded", customers: [] } },
    { situation: "서버 오류(500)", setup: () => server.fail(500), expected: { kind: "failed" } },
    {
      situation: "서버에 닿지 않음",
      setup: () => server.fail("network"),
      expected: { kind: "failed" },
    },
    {
      situation: "id가 문자열인 응답",
      setup: () => server.serveList([{ ...kim, id: "1" }]),
      expected: { kind: "failed" },
    },
    {
      situation: "배열이 아닌 응답",
      setup: () => server.serveList({ customers: [kim] }),
      expected: { kind: "failed" },
    },
  ])("$situation: 화면 상태는 $expected.kind", async ({ setup, expected }) => {
    setup();
    const list = openCustomerList();

    await list.settled();
    expect(list.screen()).toEqual(expected);
  });

  it("조회 실패 뒤 다시 시도하면 다시 불러오는 중을 거쳐 목록이 나온다", async () => {
    startServer([kim]);
    server.fail(500);
    const list = openCustomerList();
    await list.settled();
    expect(list.screen()).toEqual({ kind: "failed" });

    server.recover();
    const reloading = list.reload();
    expect(list.screen()).toEqual({ kind: "loading" });
    await reloading;
    expect(list.screen()).toEqual({ kind: "loaded", customers: [kim] });
  });
});

describe("고객 등록", () => {
  it("입력 앞뒤 공백을 지워 저장하고 새 고객을 목록 맨 위에 올린다", async () => {
    startServer([kim]);
    const list = openCustomerList();
    await list.settled();

    const result = await register({ name: "  이지우 ", phone: " 010-0000-0002 " });

    expect(result).toMatchObject({ kind: "created", customer: { name: "이지우" } });
    expect(server.stored()).toEqual([
      { name: "이지우", phone: "010-0000-0002" },
      { name: kim.name, phone: kim.phone },
    ]);
    expect(list.screen()).toMatchObject({
      kind: "loaded",
      customers: [{ name: "이지우" }, { name: kim.name }],
    });
    // 저장 뒤 서버 순서로 다시 맞춘다.
    expect(server.requests).toEqual(["GET /customers", "POST /customers", "GET /customers"]);
  });

  it("목록을 열지 않은 채 등록해도 서버에 저장된다", async () => {
    expect(await register({ name: "김서연", phone: "010-0000-0001" })).toMatchObject({
      kind: "created",
    });
    expect(server.stored()).toEqual([{ name: "김서연", phone: "010-0000-0001" }]);
  });

  it.each([
    {
      case: "이름과 전화번호가 비어 있음",
      input: { name: "   ", phone: "" },
      errors: { name: "고객 이름을 입력해주세요.", phone: "전화번호를 입력해주세요." },
    },
    {
      case: "숫자 없이 공백·하이픈만 있는 전화번호",
      input: { name: "김서연", phone: " - - " },
      errors: { phone: "전화번호를 입력해주세요." },
    },
    ...["010-0000-100a", "+82 10 0000 1001", "010.0000.1001"].map((phone) => ({
      case: `허용되지 않는 문자가 든 전화번호 ${phone}`,
      input: { name: "김서연", phone },
      errors: { phone: "전화번호는 숫자, 공백, 하이픈(-)만 입력할 수 있어요." },
    })),
  ])(
    "입력 확인에 걸리면($case) 항목 오류만 알리고 서버로 보내지 않는다",
    async ({ input, errors }) => {
      expect(await register(input)).toEqual({ kind: "invalid", errors });
      expect(server.requests).toEqual([]);
    },
  );

  it("이미 있는 전화번호는 중복으로 알리고 목록은 그대로 둔다", async () => {
    startServer([kim]);
    const list = openCustomerList();
    await list.settled();

    expect(await register({ name: "다른 사람", phone: kim.phone })).toEqual({ kind: "duplicate" });
    expect(server.stored()).toEqual([{ name: kim.name, phone: kim.phone }]);
    expect(list.screen()).toEqual({ kind: "loaded", customers: [kim] });
  });

  it.each([500, "network" as const])(
    "저장 실패(%s)는 실패로 알리고 보이던 목록을 그대로 둔다",
    async (fault) => {
      startServer([kim]);
      const list = openCustomerList();
      await list.settled();
      server.fail(fault);

      expect(await register({ name: "이지우", phone: lee.phone })).toEqual({ kind: "failed" });
      expect(list.screen()).toEqual({ kind: "loaded", customers: [kim] });
    },
  );

  it("실패한 입력은 고친 뒤 다시 등록할 수 있다", async () => {
    server.fail(500);
    expect(await register({ name: "김서연", phone: kim.phone })).toEqual({ kind: "failed" });

    server.recover();
    expect(await register({ name: "김서연", phone: kim.phone })).toMatchObject({ kind: "created" });
    expect(server.stored()).toEqual([{ name: kim.name, phone: kim.phone }]);
  });

  it("등록하는 사이 늦게 도착한 이전 조회 응답이 새 고객을 지우지 못한다", async () => {
    startServer([kim]);
    const releaseOldList = server.holdNextList();
    const list = openCustomerList();
    await vi.waitFor(() => expect(server.requests).toEqual(["GET /customers"]));

    await register({ name: "이지우", phone: lee.phone });
    const expected = { kind: "loaded", customers: [{ name: "이지우" }, { name: kim.name }] };
    expect(list.screen()).toMatchObject(expected);

    // 처음 요청한 조회(고객이 김서연뿐이던 시점)의 응답이 이제야 도착한다.
    releaseOldList();
    await list.settled();
    expect(list.screen()).toMatchObject(expected);
  });
});
