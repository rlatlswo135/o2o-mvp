import { onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveListState } from "@/shared/ui/data-table/data-table.state.ts";

import type { Treatment } from "./treatments.mock.ts";

import { registerTreatment, treatmentMutationKeys, treatmentQueries } from "./treatments.api.ts";
import { treatmentMock } from "./treatments.mock.ts";
import { treatmentInputSchema } from "./treatments.schema.ts";

// 경계는 가상 저장소, 그 안쪽(조회·캐시·목록 상태)은 실물로 돌린다
let client: QueryClient;
const unsubscribers: Array<() => void> = [];

const gel = { id: 1, name: "젤 원컬러", duration: 60, price: 35000 };
const consult = { id: 2, name: "네일 상담", duration: 15, price: 0 };

function newClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity },
    },
  });
}

// 테스트마다 새 QueryClient라 가상 저장소도 새로 시작한다
function mockOf(queryClient: QueryClient, rows: ReadonlyArray<Treatment>) {
  const mock = treatmentMock(queryClient);
  mock.rows = rows.map((row) => ({ ...row }));
  mock.nextId = 100;
  mock.delayMs = 0;
  return mock;
}

// screen()은 DataTable이 그릴 상태
function openTreatmentList(queryClient = client) {
  const observer = new QueryObserver(queryClient, treatmentQueries.list());
  const unsubscribe = observer.subscribe(() => {});
  unsubscribers.push(unsubscribe);
  return {
    screen: () => resolveListState(observer.getCurrentResult()),
    reload: () => observer.refetch(),
    settled: () => vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false)),
    leave: unsubscribe,
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
  client = newClient();
});

afterEach(() => {
  unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  client.clear();
});

describe("시술 목록 조회", () => {
  it("처음 열면 예시 시술 5개를 최근 등록 순으로 보여준다", async () => {
    treatmentMock(client).delayMs = 0;
    const list = openTreatmentList();

    expect(list.screen()).toEqual({ kind: "loading" });
    await list.settled();
    const screen = list.screen();
    expect(screen.kind === "loaded" && screen.rows.map((row) => row.name)).toEqual([
      "네일 상담",
      "손 케어",
      "젤 제거",
      "젤 아트 (10손가락)",
      "젤 원컬러",
    ]);
  });

  it("등록된 시술이 없으면 빈 목록이다", async () => {
    mockOf(client, []);
    const list = openTreatmentList();

    await list.settled();
    expect(list.screen()).toEqual(loaded([]));
  });

  it("조회 실패 뒤 다시 시도하면 실패 표시를 둔 채 다시 시도 중을 거쳐 목록이 나온다", async () => {
    mockOf(client, [gel]).failNext.list = 1;
    const list = openTreatmentList();
    await list.settled();
    expect(list.screen()).toEqual({ kind: "failed", retrying: false });

    const reloading = list.reload();
    expect(list.screen()).toEqual({ kind: "failed", retrying: true });
    await reloading;
    expect(list.screen()).toEqual(loaded([gel]));
  });

  it("다시 불러오기가 실패해도 보이던 목록을 지우거나 0건으로 바꾸지 않는다", async () => {
    const mock = mockOf(client, [gel]);
    const list = openTreatmentList();
    await list.settled();

    mock.failNext.list = 1;
    await list.reload();
    expect(list.screen()).toEqual({
      kind: "loaded",
      rows: [gel],
      refreshFailed: true,
      retrying: false,
    });

    await list.reload();
    expect(list.screen()).toEqual(loaded([gel]));
  });

  it("빈 목록을 다시 불러오다 실패해도 실패를 따로 알린다", async () => {
    const mock = mockOf(client, []);
    const list = openTreatmentList();
    await list.settled();

    mock.failNext.list = 1;
    await list.reload();
    expect(list.screen()).toEqual({
      kind: "loaded",
      rows: [],
      refreshFailed: true,
      retrying: false,
    });
  });

  it("조회 실패 뒤 오프라인에서 다시 시도하면 연결을 기다리는 동안 실패와 다시 시도 중을 유지한다", async () => {
    // 연결이 돌아왔을 때 멈춘 조회를 이어 가려면 QueryClient가 onlineManager를 구독해야 한다
    client.mount();
    mockOf(client, [gel]).failNext.list = 1;
    const list = openTreatmentList();
    await list.settled();

    onlineManager.setOnline(false);
    try {
      const reloading = list.reload();
      expect(list.screen()).toEqual({ kind: "failed", retrying: true });

      onlineManager.setOnline(true);
      await reloading;
      expect(list.screen()).toEqual(loaded([gel]));
    } finally {
      onlineManager.setOnline(true);
      client.unmount();
    }
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
  it("다듬은 값으로 등록하고 새 시술을 목록 맨 위에 정확히 한 번 올린다", async () => {
    const mock = mockOf(client, [gel]);
    const list = openTreatmentList();
    await list.settled();

    const result = await register({ name: "  손 케어 ", duration: "40", price: "20,000" });

    const care = { id: 100, name: "손 케어", duration: 40, price: 20000 };
    expect(result).toEqual({ kind: "created", treatment: care });
    await list.settled();
    expect(list.screen()).toEqual(loaded([care, gel]));
    expect(mock.rows).toEqual([care, gel]);
  });

  it("0원 시술도 등록한다", async () => {
    mockOf(client, []);
    const list = openTreatmentList();
    await list.settled();

    await register({ name: "네일 상담", duration: "15", price: "0" });
    await list.settled();
    expect(list.screen()).toEqual(loaded([{ ...consult, id: 100 }]));
  });

  it("저장에 실패하면 실패로 알리고 목록·저장소에 넣지 않는다", async () => {
    const mock = mockOf(client, [gel]);
    mock.failNext.create = 1;
    const list = openTreatmentList();
    await list.settled();

    expect(await register({ name: "손 케어", duration: "40", price: "20000" })).toEqual({
      kind: "failed",
    });
    expect(list.screen()).toEqual(loaded([gel]));
    expect(mock.rows).toEqual([gel]);
  });

  it("실패한 입력 그대로 다시 등록하면 한 번만 들어간다", async () => {
    const mock = mockOf(client, [gel]);
    mock.failNext.create = 1;
    const input = { name: "손 케어", duration: "40", price: "20000" };

    expect(await register(input)).toEqual({ kind: "failed" });
    expect(await register(input)).toMatchObject({ kind: "created" });
    expect(mock.rows.map((row) => row.name)).toEqual(["손 케어", "젤 원컬러"]);
  });

  it("등록하는 동안 시술 mutation 키로 저장 중을 알 수 있고 고객 키와 섞이지 않는다", async () => {
    mockOf(client, [gel]).delayMs = 20;
    const saving = client.getMutationCache().build(client, {
      mutationKey: treatmentMutationKeys.create(),
      mutationFn: () => register({ name: "손 케어", duration: "40", price: "20000" }),
    });

    const done = saving.execute(undefined);
    expect(client.isMutating({ mutationKey: treatmentMutationKeys.all() })).toBe(1);
    expect(client.isMutating({ mutationKey: ["customers"] })).toBe(0);
    await done;
    expect(client.isMutating({ mutationKey: treatmentMutationKeys.all() })).toBe(0);
  });

  it("등록하는 사이 늦게 도착한 이전 조회 응답이 새 시술을 지우지 못한다", async () => {
    const mock = mockOf(client, [gel]);
    // 첫 조회만 늦게 응답
    mock.delayMs = 50;
    const list = openTreatmentList();
    mock.delayMs = 0;

    const result = await register({ name: "손 케어", duration: "40", price: "20000" });
    expect(result.kind).toBe("created");
    await list.settled();
    await new Promise((resolve) => setTimeout(resolve, 80));

    const care = { id: 100, name: "손 케어", duration: 40, price: 20000 };
    expect(list.screen()).toEqual(loaded([care, gel]));
  });
});

describe("메뉴 이동", () => {
  it("목록을 떠났다 다시 열어도 등록한 시술이 남아 있다", async () => {
    mockOf(client, [gel]);
    const first = openTreatmentList();
    await first.settled();
    await register({ name: "손 케어", duration: "40", price: "20000" });
    first.leave();
    // 캐시가 비워져도 같은 앱(QueryClient)의 가상 저장소에서 다시 불러온다
    client.removeQueries({ queryKey: treatmentQueries.all() });

    const again = openTreatmentList();
    await again.settled();
    const screen = again.screen();
    expect(screen.kind === "loaded" && screen.rows.map((row) => row.name)).toEqual([
      "손 케어",
      "젤 원컬러",
    ]);
  });

  it("다른 앱(새로고침·다른 테스트)의 가상 저장소와 공유하지 않는다", async () => {
    mockOf(client, [gel]);
    await register({ name: "발 케어", duration: "50", price: "30000" });

    const other = newClient();
    treatmentMock(other).delayMs = 0;
    const list = openTreatmentList(other);
    await list.settled();
    const screen = list.screen();
    expect(screen.kind === "loaded" && screen.rows.some((row) => row.name === "발 케어")).toBe(
      false,
    );
    expect(screen.kind === "loaded" && screen.rows).toHaveLength(5);
    other.clear();
  });
});
