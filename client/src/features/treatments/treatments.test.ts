import type { Treatment } from "@o2o/shared/contracts";

import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveListState } from "@/shared/ui/data-table/data-table.state.ts";

import { registerTreatment, treatmentMutationKeys, treatmentQueries } from "./treatments.api.ts";
import { treatmentInputSchema } from "./treatments.schema.ts";

// 경계는 HTTP 계약만, 그 안쪽(조회·캐시·목록 상태)은 실물로 돌린다
vi.hoisted(() => {
  vi.stubEnv("VITE_SERVER_URL", "https://api.example.test/");
});

const gel = { id: 1, name: "젤 원컬러", duration: 60, price: 35000 };
const care = { id: 2, name: "손 케어", duration: 40, price: 20000 };

const json = (body: unknown, status = 200) => Response.json(body, { status });
const invalidInput = (issues: Array<{ path: unknown[]; message: string }>) =>
  json(
    { defined: false, code: "BAD_REQUEST", message: "Input validation failed", data: { issues } },
    400,
  );

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
function openTreatmentList() {
  const observer = new QueryObserver(client, treatmentQueries.list());
  unsubscribers.push(observer.subscribe(() => {}));
  return {
    screen: () => resolveListState(observer.getCurrentResult()),
    reload: () => observer.refetch(),
    settled: () => vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false)),
  };
}

function loaded(rows: ReadonlyArray<Treatment>) {
  return { kind: "loaded", rows, refreshFailed: false, retrying: false };
}

// 폼처럼 스키마로 다듬어 저장
function register(input: { name: string; duration: string; price: string }) {
  return registerTreatment(client, treatmentInputSchema.parse(input));
}

function fieldErrors(input: { name?: string; duration?: string; price?: string }) {
  const result = treatmentInputSchema.safeParse({
    name: "젤 원컬러",
    duration: "60",
    price: "35000",
    ...input,
  });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
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

describe("시술 목록 조회", () => {
  it("응답 전에는 비어 있다고 단정하지 않고 응답이 오면 서버 순서 그대로 보여준다", async () => {
    fetchMock.mockImplementation(async () => json([care, gel]));
    const list = openTreatmentList();

    expect(list.screen()).toEqual({ kind: "loading" });
    await list.settled();
    expect(list.screen()).toEqual(loaded([care, gel]));
    expect(requests()).toEqual(["GET /treatments"]);
  });

  it("등록된 시술이 없으면 빈 목록이다", async () => {
    fetchMock.mockImplementation(async () => json([]));
    const list = openTreatmentList();

    await list.settled();
    expect(list.screen()).toEqual(loaded([]));
  });

  it("조회 실패 뒤 다시 시도하면 실패 표시를 둔 채 다시 시도 중을 거쳐 목록이 나온다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json({}, 500))
      .mockImplementation(async () => json([gel]));
    const list = openTreatmentList();
    await list.settled();
    expect(list.screen()).toEqual({ kind: "failed", retrying: false });

    const reloading = list.reload();
    expect(list.screen()).toEqual({ kind: "failed", retrying: true });
    await reloading;
    expect(list.screen()).toEqual(loaded([gel]));
  });

  it("다시 불러오기가 실패해도 보이던 목록을 지우거나 0건으로 바꾸지 않는다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([gel]))
      .mockImplementationOnce(async () => unreachable());
    const list = openTreatmentList();
    await list.settled();

    await list.reload();
    expect(list.screen()).toEqual({
      kind: "loaded",
      rows: [gel],
      refreshFailed: true,
      retrying: false,
    });
  });

  it("응답이 계약과 다르면(가격 없음) 목록으로 쓰지 않고 실패로 보여준다", async () => {
    fetchMock.mockImplementation(async () => json([{ id: 1, name: "젤", duration: 60 }]));
    const list = openTreatmentList();

    await list.settled();
    expect(list.screen()).toEqual({ kind: "failed", retrying: false });
  });
});

describe("시술 입력 확인", () => {
  it("앞뒤 공백을 지우고 숫자로 바꾼다. 0원은 유효하다", () => {
    expect(
      treatmentInputSchema.parse({ name: "  젤 원컬러 ", duration: " 060 ", price: " 0 " }),
    ).toEqual({ name: "젤 원컬러", duration: 60, price: 0 });
    expect(treatmentInputSchema.parse({ name: "젤", duration: "1", price: "35,000" })).toEqual({
      name: "젤",
      duration: 1,
      price: 35000,
    });
    // -0은 0원으로 본다
    expect(treatmentInputSchema.parse({ name: "젤", duration: "1", price: "-0" }).price).toBe(0);
  });

  it.each([{ name: "" }, { name: "   " }])("시술명 $name → 이름 필수", (input) => {
    expect(fieldErrors(input)).toEqual({ name: "시술 이름을 입력해주세요." });
  });

  it.each([
    { duration: "", message: "소요시간을 입력해주세요." },
    { duration: "  ", message: "소요시간을 입력해주세요." },
    { duration: "0", message: "1분 이상으로 입력해주세요." },
    { duration: "-30", message: "1분 이상으로 입력해주세요." },
    { duration: "1.5", message: "소수 없이 분 단위 정수로 입력해주세요." },
    { duration: "60.0", message: "소수 없이 분 단위 정수로 입력해주세요." },
    { duration: "1시간", message: "숫자로만 입력해주세요. 예: 60" },
    { duration: "abc", message: "숫자로만 입력해주세요. 예: 60" },
    { duration: "1e3", message: "숫자로만 입력해주세요. 예: 60" },
    { duration: "6 0", message: "숫자로만 입력해주세요. 예: 60" },
    { duration: "1,000", message: "숫자로만 입력해주세요. 예: 60" },
    { duration: "+60", message: "숫자로만 입력해주세요. 예: 60" },
    { duration: "9007199254740992", message: "입력할 수 있는 범위를 넘었어요." },
  ])("소요시간 '$duration' → $message", ({ duration, message }) => {
    expect(fieldErrors({ duration })).toEqual({ duration: message });
  });

  it.each([
    { price: "", message: "가격을 입력해주세요. 무료라면 0을 입력해요." },
    { price: "-1000", message: "0원 이상으로 입력해주세요." },
    { price: "−1000", message: "0원 이상으로 입력해주세요." },
    { price: "1000.5", message: "소수 없이 원 단위로 입력해주세요." },
    { price: "3,50,00", message: "숫자로만 입력해주세요. 예: 35000" },
    { price: "만원", message: "숫자로만 입력해주세요. 예: 35000" },
    { price: "1e4", message: "숫자로만 입력해주세요. 예: 35000" },
    { price: "9007199254740992", message: "입력할 수 있는 금액 범위를 넘었어요." },
  ])("가격 '$price' → $message", ({ price, message }) => {
    expect(fieldErrors({ price })).toEqual({ price: message });
  });

  it("여러 필드가 틀리면 각 필드 오류를 함께 알린다", () => {
    expect(fieldErrors({ name: " ", duration: "0", price: "" })).toEqual({
      name: "시술 이름을 입력해주세요.",
      duration: "1분 이상으로 입력해주세요.",
      price: "가격을 입력해주세요. 무료라면 0을 입력해요.",
    });
  });
});

describe("시술 등록", () => {
  it("다듬은 값을 숫자로 보내고 서버가 준 새 시술을 목록 맨 위에 정확히 한 번 올린다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([gel]))
      .mockImplementationOnce(async () => json(care, 201))
      .mockImplementationOnce(async () => json([care, gel]));
    const list = openTreatmentList();
    await list.settled();

    const result = await register({ name: "  손 케어 ", duration: "40", price: "20,000" });

    expect(result).toEqual({ kind: "created", treatment: care });
    expect(sentBody(1)).toEqual({ name: "손 케어", duration: 40, price: 20000 });
    await list.settled();
    expect(list.screen()).toEqual(loaded([care, gel]));
    expect(requests()).toEqual(["GET /treatments", "POST /treatments", "GET /treatments"]);
  });

  it("서버가 칸을 짚어 거절하면(400) 그 칸의 문구를 돌려주고 목록은 그대로 둔다", async () => {
    fetchMock
      .mockImplementationOnce(async () => json([gel]))
      .mockImplementationOnce(async () =>
        invalidInput([
          { path: ["duration"], message: "입력할 수 있는 범위를 넘었어요." },
          { path: ["duration"], message: "두 번째 문구는 쓰지 않는다" },
          { path: ["price"], message: "입력할 수 있는 금액 범위를 넘었어요." },
        ]),
      );
    const list = openTreatmentList();
    await list.settled();

    expect(await register({ name: "젤", duration: "60", price: "0" })).toEqual({
      kind: "rejected",
      errors: {
        duration: "입력할 수 있는 범위를 넘었어요.",
        price: "입력할 수 있는 금액 범위를 넘었어요.",
      },
    });
    expect(list.screen()).toEqual(loaded([gel]));
    expect(requests()).toEqual(["GET /treatments", "POST /treatments"]);
  });

  it("칸을 알 수 없는 거절(400)은 칸 오류 없이 거절로 알린다", async () => {
    fetchMock.mockImplementationOnce(async () =>
      invalidInput([{ path: [], message: "형식 오류" }]),
    );

    expect(await register({ name: "젤", duration: "60", price: "0" })).toEqual({
      kind: "rejected",
      errors: {},
    });
  });

  it.each([
    { situation: "서버 오류(500)", respond: async () => json({}, 500) },
    { situation: "서버에 닿지 않음", respond: async () => unreachable() },
    { situation: "응답이 계약과 다름", respond: async () => json({ id: 2 }, 201) },
  ])(
    "결과를 알 수 없으면($situation) 다시 보내지 않고 목록만 다시 불러온다",
    async ({ respond }) => {
      fetchMock
        .mockImplementationOnce(async () => json([gel]))
        .mockImplementationOnce(respond)
        .mockImplementationOnce(async () => json([care, gel]));
      const list = openTreatmentList();
      await list.settled();

      expect(await register({ name: "손 케어", duration: "40", price: "20000" })).toEqual({
        kind: "unknown",
      });
      await vi.waitFor(() =>
        expect(requests()).toEqual(["GET /treatments", "POST /treatments", "GET /treatments"]),
      );
      await list.settled();
      // 서버에 저장돼 있었다면 다시 불러온 목록에 나타난다
      expect(list.screen()).toEqual(loaded([care, gel]));
    },
  );

  it("등록하는 동안 시술 mutation 키로 저장 중을 알 수 있고 고객 키와 섞이지 않는다", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    fetchMock.mockImplementationOnce(async () => {
      await held;
      return json(care, 201);
    });
    const saving = client.getMutationCache().build(client, {
      mutationKey: treatmentMutationKeys.create(),
      mutationFn: () => register({ name: "손 케어", duration: "40", price: "20000" }),
    });

    const done = saving.execute(undefined);
    expect(client.isMutating({ mutationKey: treatmentMutationKeys.all() })).toBe(1);
    expect(client.isMutating({ mutationKey: ["customers"] })).toBe(0);
    release();
    await done;
    expect(client.isMutating({ mutationKey: treatmentMutationKeys.all() })).toBe(0);
  });

  it("등록하는 사이 늦게 도착한 이전 조회 응답이 새 시술을 지우지 못한다", async () => {
    let releaseOldList!: () => void;
    const oldListHeld = new Promise<void>((resolve) => (releaseOldList = resolve));
    fetchMock
      .mockImplementationOnce(async () => {
        await oldListHeld;
        return json([gel]);
      })
      .mockImplementationOnce(async () => json(care, 201))
      .mockImplementation(async () => json([care, gel]));
    const list = openTreatmentList();
    await vi.waitFor(() => expect(requests()).toEqual(["GET /treatments"]));

    await register({ name: "손 케어", duration: "40", price: "20000" });
    expect(list.screen()).toEqual(loaded([care, gel]));

    releaseOldList();
    await list.settled();
    expect(list.screen()).toEqual(loaded([care, gel]));
  });
});
