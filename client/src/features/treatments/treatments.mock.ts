import type { QueryClient } from "@tanstack/react-query";

import type { TreatmentInput } from "./treatments.schema.ts";

// 서버 연결 전 가상 데이터. 이 모양을 서버 계약으로 보지 않는다.
export type Treatment = TreatmentInput & { id: number };

export type TreatmentMock = {
  // 최근 등록이 앞
  rows: Treatment[];
  nextId: number;
  delayMs: number;
  // 테스트·개발 확인용 실패 주입. 남은 횟수만큼 다음 호출이 실패한다
  failNext: { list: number; create: number };
};

const seed: ReadonlyArray<Treatment> = [
  { id: 5, name: "네일 상담", duration: 15, price: 0 },
  { id: 4, name: "손 케어", duration: 40, price: 20000 },
  { id: 3, name: "젤 제거", duration: 30, price: 10000 },
  { id: 2, name: "젤 아트 (10손가락)", duration: 90, price: 55000 },
  { id: 1, name: "젤 원컬러", duration: 60, price: 35000 },
];

// 앱의 QueryClient마다 따로 둔다. 메뉴를 옮겨도 남고 새로고침하면 처음으로 돌아간다
const mocks = new WeakMap<QueryClient, TreatmentMock>();

export function treatmentMock(client: QueryClient): TreatmentMock {
  let mock = mocks.get(client);
  if (!mock) {
    mock = { rows: [...seed], nextId: 6, delayMs: 600, failNext: { list: 0, create: 0 } };
    mocks.set(client, mock);
    // 브라우저 확인 때 콘솔에서 실패·빈 목록을 주입한다. 배포 빌드에는 없다
    if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
      Object.assign(globalThis, { __treatmentMock: mock });
    }
  }
  return mock;
}

export async function fetchTreatments(
  client: QueryClient,
  signal?: AbortSignal,
): Promise<Treatment[]> {
  const mock = treatmentMock(client);
  // 요청 시점의 목록을 늦게 돌려주는 서버처럼 동작한다
  const snapshot = mock.rows.map((row) => ({ ...row }));
  await wait(mock.delayMs, signal);
  if (takeFailure(mock, "list")) throw new Error("가상 시술 목록 조회 실패");
  return snapshot;
}

export async function createTreatment(
  client: QueryClient,
  input: TreatmentInput,
): Promise<Treatment> {
  const mock = treatmentMock(client);
  await wait(mock.delayMs);
  if (takeFailure(mock, "create")) throw new Error("가상 시술 등록 실패");
  const treatment = { ...input, id: mock.nextId++ };
  mock.rows.unshift(treatment);
  return { ...treatment };
}

function takeFailure(mock: TreatmentMock, operation: keyof TreatmentMock["failNext"]) {
  if (mock.failNext[operation] <= 0) return false;
  mock.failNext[operation] -= 1;
  return true;
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
