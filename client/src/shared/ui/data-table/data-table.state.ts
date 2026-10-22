/**
 * 목록 조회 상태. TanStack Query의 `useQuery` 결과가 그대로 맞는 모양이며,
 * 공용 UI가 조회 라이브러리에 묶이지 않도록 필요한 값만 받는다.
 */
export type DataTableQuery<TData> = {
  status: "pending" | "error" | "success";
  data: ReadonlyArray<TData> | undefined;
  // paused: 오프라인이라 요청을 보내지 못하고 연결을 기다리는 중
  fetchStatus: "fetching" | "paused" | "idle";
  // 받은 목록 없이 실패한 뒤 다시 시도하면 status가 pending으로 돌아가 실패 이력은 이 값으로 안다
  errorUpdateCount: number;
  refetch: () => unknown;
};

export type ListState<TData> =
  | { kind: "loading" }
  | { kind: "failed"; retrying: boolean }
  /** refreshFailed: 다시 불러오기에 실패해 이전에 받은 목록을 보여주는 중. */
  | { kind: "loaded"; rows: ReadonlyArray<TData>; refreshFailed: boolean; retrying: boolean };

/**
 * 조회 상태를 목록이 그릴 상태로 정한다.
 * - 받은 목록이 없으면: 첫 응답 전에는 불러오는 중, 실패 후에는 다시 시도 중(연결 대기 포함)에도 실패를 유지한다.
 * - 받은 목록이 있으면: 다시 불러오기가 실패해도 목록을 유지하고 실패만 따로 표시한다.
 */
export function resolveListState<TData>({
  status,
  data,
  fetchStatus,
  errorUpdateCount,
}: Omit<DataTableQuery<TData>, "refetch">): ListState<TData> {
  const retrying = fetchStatus !== "idle";
  if (data === undefined) {
    if (status === "error" || errorUpdateCount > 0) return { kind: "failed", retrying };
    return { kind: "loading" };
  }
  const refreshFailed = status === "error";
  return { kind: "loaded", rows: data, refreshFailed, retrying: refreshFailed && retrying };
}
