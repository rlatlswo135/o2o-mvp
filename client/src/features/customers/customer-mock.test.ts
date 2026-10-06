import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createDelayedTask, createMockCustomerStore, exampleCustomers } from "./customer-mock.ts";

describe("createMockCustomerStore", () => {
  it("인스턴스마다 처음 예시로 시작하고 서로 데이터를 공유하지 않는다", () => {
    const first = createMockCustomerStore();
    const second = createMockCustomerStore();

    first.save({ name: "새 고객", phone: "010-9999-0000" }, "success");

    expect(second.list("success")).toEqual({ kind: "loaded", customers: exampleCustomers() });
    expect(first.list("success")).toMatchObject({ kind: "loaded" });
  });

  it("정상 조회는 현재 목록의 사본, 빈 결과는 가상 데이터를 비우고, 실패는 목록 없이 실패만 알린다", () => {
    const store = createMockCustomerStore();
    const loaded = store.list("success");

    expect(loaded.kind === "loaded" && loaded.customers).toHaveLength(5);
    expect(store.list("failure")).toEqual({ kind: "failed" });
    expect(store.list("empty")).toEqual({ kind: "loaded", customers: [] });
    expect(store.list("success")).toEqual({ kind: "loaded", customers: [] });
  });

  it("저장 성공은 새 식별자로 맨 앞에 한 번 추가하고 동명이인을 구분한다", () => {
    const store = createMockCustomerStore();
    const first = store.save({ name: "김서연", phone: "010-1234-0001" }, "success");
    const second = store.save({ name: "김서연", phone: "010-1234-0002" }, "success");
    const listed = store.list("success");

    expect(first.kind).toBe("saved");
    expect(second.kind).toBe("saved");
    if (first.kind !== "saved" || second.kind !== "saved" || listed.kind !== "loaded") return;
    expect(first.customer.id).not.toBe(second.customer.id);
    expect(listed.customers.slice(0, 2)).toEqual([second.customer, first.customer]);
    expect(listed.customers.filter((c) => c.name === "김서연")).toHaveLength(3);
    expect(listed.customers).toHaveLength(7);
  });

  it("공백·하이픈을 지운 번호가 같으면 중복으로 거절하고 목록을 바꾸지 않는다", () => {
    const store = createMockCustomerStore();

    expect(store.save({ name: "다른 이름", phone: "010 0000 1001" }, "success")).toEqual({
      kind: "duplicate",
    });
    expect(store.save({ name: "다른 이름", phone: "01000001001" }, "success")).toEqual({
      kind: "duplicate",
    });
    const listed = store.list("success");
    expect(listed.kind === "loaded" && listed.customers).toHaveLength(5);
  });

  it("저장 실패는 목록을 바꾸지 않는다", () => {
    const store = createMockCustomerStore();

    expect(store.save({ name: "새 고객", phone: "010-9999-0000" }, "failure")).toEqual({
      kind: "failed",
    });
    const listed = store.list("success");
    expect(listed.kind === "loaded" && listed.customers).toHaveLength(5);
  });
});

describe("createDelayedTask", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("대기 중 재시작을 무시하고 지연 뒤 한 번만 실행한다", () => {
    const task = createDelayedTask(600);
    const run = vi.fn<() => void>();

    expect(task.start(run)).toBe(true);
    expect(task.start(run)).toBe(false);
    vi.advanceTimersByTime(599);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(task.start(run)).toBe(true);
  });

  it("취소하면 늦은 완료를 실행하지 않고 다시 시작할 수 있다", () => {
    const task = createDelayedTask(600);
    const run = vi.fn<() => void>();

    task.start(run);
    task.cancel();
    vi.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
    expect(task.start(run)).toBe(true);
  });
});
