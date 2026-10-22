import type { OnChangeFn, PaginationState, RowData, TableOptions } from "@tanstack/react-table";

import {
  createPaginatedRowModel,
  createTableHook,
  metaHelper,
  rowPaginationFeature,
  tableFeatures,
} from "@tanstack/react-table";
import { useState } from "react";

export const dataTableFeatures = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: metaHelper<{ align?: "start" | "end" }>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

export const { createAppColumnHelper, useAppTable, useTableContext } = createTableHook({
  features: dataTableFeatures,
  // 행 수가 바뀔 때의 페이지는 nextPagination 규칙으로 직접 맞춘다
  autoResetPageIndex: false,
});

export type DataTableColumns<TData extends RowData> = TableOptions<
  DataTableFeatures,
  TData
>["columns"];

/** 서버가 페이지를 나눌 때 바깥에서 쥐는 페이지 상태. data는 이미 나뉜 현재 페이지 행이다. */
export type ManualPagination = {
  state: PaginationState;
  onChange: OnChangeFn<PaginationState>;
  rowCount: number;
};

export const pageSizeOptions = [10, 20, 50] as const;

const initialPagination: PaginationState = { pageIndex: 0, pageSize: pageSizeOptions[0] };

/**
 * 행 수가 바뀐 뒤의 페이지.
 * 늘면 맨 앞에 들어온 새 항목이 보이게 첫 페이지, 같으면 그대로, 줄어 범위를 벗어나면 마지막 페이지.
 */
export function nextPagination(
  pagination: PaginationState,
  prevCount: number,
  nextCount: number,
): PaginationState {
  if (nextCount > prevCount) return { ...pagination, pageIndex: 0 };
  const lastPageIndex = Math.max(0, Math.ceil(nextCount / pagination.pageSize) - 1);
  if (pagination.pageIndex <= lastPageIndex) return pagination;
  return { ...pagination, pageIndex: lastPageIndex };
}

export type DataTableEngineOptions<TData extends RowData> = {
  data: ReadonlyArray<TData>;
  columns: DataTableColumns<TData>;
  getRowId: (row: TData) => string;
  /** 생략하면 받은 전체 목록을 화면에서 나눈다. */
  pagination?: ManualPagination | undefined;
};

export function useDataTableEngine<TData extends RowData>({
  data,
  columns,
  getRowId,
  pagination: manual,
}: DataTableEngineOptions<TData>) {
  const [clientPagination, setClientPagination] = useState(initialPagination);
  const [rowCount, setRowCount] = useState(data.length);

  // 행 수 변화는 렌더 중에 맞춰 보정 전 페이지가 한 번도 그려지지 않게 한다
  let pagination = clientPagination;
  if (!manual && rowCount !== data.length) {
    pagination = nextPagination(clientPagination, rowCount, data.length);
    setRowCount(data.length);
    setClientPagination(pagination);
  }

  return useAppTable({
    data,
    columns,
    getRowId,
    state: { pagination: manual?.state ?? pagination },
    onPaginationChange: manual?.onChange ?? setClientPagination,
    ...(manual && { manualPagination: true, rowCount: manual.rowCount }),
  });
}
