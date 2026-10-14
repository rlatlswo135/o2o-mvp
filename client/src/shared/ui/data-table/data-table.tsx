import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { useId, useRef } from "react";

import { Button } from "../button/button.js";
import { EmptyState } from "../empty-state/empty-state.js";
import { ErrorState } from "../error-state/error-state.js";
import { Skeleton } from "../skeleton/skeleton.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../table/table.js";
import { colors } from "../theme.stylex.js";

/**
 * 목록 조회 상태. TanStack Query의 `useQuery` 결과가 그대로 맞는 모양이며,
 * 공용 UI가 조회 라이브러리에 묶이지 않도록 필요한 값만 받는다.
 */
export type DataTableQuery<T> = {
  status: "pending" | "error" | "success";
  data: ReadonlyArray<T> | undefined;
  isFetching: boolean;
  refetch: () => unknown;
};

export type DataTableState<T> =
  | { kind: "loading" }
  | { kind: "failed" }
  /** refreshFailed: 다시 불러오기에 실패해 이전에 받은 목록을 보여주는 중. */
  | { kind: "loaded"; rows: ReadonlyArray<T>; refreshFailed: boolean };

/**
 * 조회 상태를 표가 그릴 상태로 정한다.
 * - 받은 목록이 없으면: 첫 응답 전·실패 후 다시 시도 중에는 불러오는 중, 실패로 끝나면 실패.
 * - 받은 목록이 있으면: 다시 불러오기가 실패해도 목록을 유지하고 실패만 따로 표시한다.
 */
export function resolveTableState<T>({
  status,
  data,
  isFetching,
}: Omit<DataTableQuery<T>, "refetch">): DataTableState<T> {
  if (data === undefined) {
    return status === "error" && !isFetching ? { kind: "failed" } : { kind: "loading" };
  }
  return { kind: "loaded", rows: data, refreshFailed: status === "error" && !isFetching };
}

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** 숫자 열은 end로 오른쪽 정렬한다. */
  align?: "start" | "end" | undefined;
};

export type DataTableProps<T> = {
  /** 영역 제목. 표 이름(caption)으로도 쓴다. */
  title: string;
  query: DataTableQuery<T>;
  columns: ReadonlyArray<DataTableColumn<T>>;
  rowKey: (row: T) => string | number;
  /** 제목 오른쪽 슬롯. 등록 버튼 등 목록에 대한 동작을 둔다. */
  toolbar?: ReactNode;
  /** 표 아래 슬롯. 받은 목록으로 합계 등을 그린다. */
  footer?: ((rows: ReadonlyArray<T>) => ReactNode) | undefined;
  loadingLabel: string;
  /** 첫 조회 실패 문구. 빈 결과와 구분되게 쓴다. */
  errorMessage: string;
  /** 다시 불러오기 실패 문구. 보이는 목록이 이전 내용임을 알린다. */
  refreshErrorMessage?: string | undefined;
  empty: { title: string; description: string; action?: ReactNode };
};

/**
 * 조회 결과 목록. 불러오는 중·조회 실패·빈 결과·목록을 서로 다른 표현으로 보여주고
 * 실패 시 다시 시도는 query.refetch로 직접 한다.
 */
export function DataTable<T>({
  title,
  query,
  columns,
  rowKey,
  toolbar,
  footer,
  loadingLabel,
  errorMessage,
  refreshErrorMessage = "최신 목록을 불러오지 못했어요. 이전에 불러온 목록을 보여드려요.",
  empty,
}: DataTableProps<T>) {
  const titleId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const state = resolveTableState(query);

  // 다시 시도 버튼이 사라지므로 목록 영역으로 포커스를 옮긴다.
  const handleRetry = () => {
    void query.refetch();
    sectionRef.current?.focus();
  };

  const retryButton = (
    <Button variant="secondary" onClick={handleRetry}>
      다시 시도
    </Button>
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby={titleId}
      tabIndex={-1}
      {...stylex.props(styles.section)}
    >
      <div {...stylex.props(styles.header)}>
        <h2 id={titleId} {...stylex.props(styles.title)}>
          {title}
        </h2>
        {toolbar}
      </div>

      {state.kind === "loading" && <Skeleton label={loadingLabel} rows={5} />}
      {state.kind === "failed" && <ErrorState message={errorMessage}>{retryButton}</ErrorState>}
      {state.kind === "loaded" && state.refreshFailed && (
        <ErrorState message={refreshErrorMessage}>{retryButton}</ErrorState>
      )}
      {state.kind === "loaded" && state.rows.length === 0 && (
        <EmptyState title={empty.title} description={empty.description}>
          {empty.action}
        </EmptyState>
      )}
      {state.kind === "loaded" && state.rows.length > 0 && (
        <div {...stylex.props(styles.body)}>
          <Table caption={title} hideCaption>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableHeaderCell key={column.key} align={column.align}>
                    {column.header}
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {state.rows.map((row, index) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.key} align={column.align}>
                      {column.cell(row, index)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {footer?.(state.rows)}
        </div>
      )}
    </section>
  );
}

const styles = stylex.create({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    borderRadius: "8px",
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "4px",
    outlineColor: colors.focusRing,
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px 12px",
    paddingBottom: "10px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.border,
  },
  title: {
    margin: 0,
    color: colors.primary,
    fontSize: "14px",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});
