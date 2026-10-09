import type { Customer, CustomerInput } from "./customer.ts";

import { comparablePhone } from "./customer.ts";

// 실제 BE 연결 전 가상 조회·저장. 실제 요청으로 교체할 범위를 이 파일에 모은다.

export type ListOutcome = "success" | "empty" | "failure";
export type SaveOutcome = "success" | "failure";

export type ListResult =
  | { kind: "loaded"; customers: ReadonlyArray<Customer> }
  | { kind: "failed" };
export type SaveResult =
  | { kind: "saved"; customer: Customer }
  | { kind: "duplicate" }
  | { kind: "failed" };

/** 가상 예시 고객. 실제 고객 정보가 아니다. */
export function exampleCustomers(): Customer[] {
  return [
    { id: 1001, name: "김서연", phone: "010-0000-1001" },
    { id: 1002, name: "이지우", phone: "010-0000-1002" },
    { id: 1003, name: "박수빈", phone: "010-0000-1003" },
    { id: 1004, name: "정하은", phone: "010-0000-1004" },
    { id: 1005, name: "최윤서", phone: "010-0000-1005" },
  ];
}

/**
 * 페이지 인스턴스 하나가 쓰는 가상 저장소. 메모리에만 두므로 새로고침하면 처음 예시로 돌아간다.
 * 결과(outcome)는 화면의 가상 동작 확인 영역이 정한다.
 */
export function createMockCustomerStore() {
  let customers = exampleCustomers();
  let nextId = 1006;

  return {
    list(outcome: ListOutcome): ListResult {
      if (outcome === "failure") return { kind: "failed" };
      if (outcome === "empty") customers = [];
      return { kind: "loaded", customers: [...customers] };
    },
    save(input: CustomerInput, outcome: SaveOutcome): SaveResult {
      if (outcome === "failure") return { kind: "failed" };
      const phone = comparablePhone(input.phone);
      if (customers.some((customer) => comparablePhone(customer.phone) === phone)) {
        return { kind: "duplicate" };
      }
      const customer = { id: nextId, ...input };
      nextId += 1;
      customers = [customer, ...customers];
      return { kind: "saved", customer };
    },
  };
}

/**
 * 가상 비동기 대기. 대기 중 재시작은 무시해 중복 요청을 막고,
 * 취소하면 늦은 완료가 실행되지 않는다(상태 변경·페이지 이탈 정리).
 */
export function createDelayedTask(delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    start(run: () => void) {
      if (timer !== null) return false;
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delayMs);
      return true;
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
