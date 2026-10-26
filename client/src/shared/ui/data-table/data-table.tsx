import type { ColumnDefTemplate, RowData } from "@tanstack/react-table";
import type { ComponentPropsWithRef, ReactNode, RefObject } from "react";

import * as stylex from "@stylexjs/stylex";
import { createContext, use, useId, useRef } from "react";

import type { DataTableEngineOptions } from "./data-table.engine.ts";
import type { DataTableQuery, ListState } from "./data-table.state.ts";

import { EmptyState } from "../empty-state/empty-state.tsx";
import { RetryErrorState } from "../error-state/retry-error-state.tsx";
import { a11yStyles } from "../internal/control-styles.ts";
import { Select } from "../select/select.tsx";
import { Skeleton } from "../skeleton/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../table/table.tsx";
import { colors, radii } from "../theme.stylex.ts";
import { pageSizeOptions, useDataTableEngine, useTableContext } from "./data-table.engine.ts";
import { resolveListState } from "./data-table.state.ts";

export { createAppColumnHelper } from "./data-table.engine.ts";

type ListContextValue = {
  title: string;
  state: ListState<unknown>;
  retry: () => void;
  sectionRef: RefObject<HTMLElement | null>;
};

const ListContext = createContext<ListContextValue | null>(null);

function useList() {
  const list = use(ListContext);
  if (!list) throw new Error("DataTable 부품은 DataTable.Root 안에서 쓴다.");
  return list;
}

// 받은 목록이 있고 한 건 이상일 때만 페이지 조작을 보인다
function useHasRows() {
  const { state } = useList();
  const table = useTableContext();
  return state.kind === "loaded" && table.getRowCount() > 0;
}

export type DataTableRootProps<TData extends RowData> = Omit<
  DataTableEngineOptions<TData>,
  "data"
> & {
  /** 섹션·표의 보조기기용 이름. 화면에는 보이지 않는다. */
  title: string;
  query: DataTableQuery<TData>;
  children: ReactNode;
};

const noRows: ReadonlyArray<never> = [];

function Root<TData extends RowData>({
  title,
  query,
  columns,
  getRowId,
  pagination,
  children,
}: DataTableRootProps<TData>) {
  const titleId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const table = useDataTableEngine({
    data: query.data ?? noRows,
    columns,
    getRowId,
    pagination,
  });

  const list: ListContextValue = {
    title,
    state: resolveListState(query),
    retry: () => void query.refetch(),
    sectionRef,
  };

  return (
    <section
      ref={sectionRef}
      aria-labelledby={titleId}
      tabIndex={-1}
      {...stylex.props(styles.section)}
    >
      <h2 id={titleId} {...stylex.props(a11yStyles.visuallyHidden)}>
        {title}
      </h2>
      <ListContext value={list}>
        <table.AppTable>{children}</table.AppTable>
      </ListContext>
    </section>
  );
}

export type DataTableHeaderProps = {
  children?: ReactNode;
  /** 머리 줄 오른쪽 끝. 등록 버튼 등 목록에 대한 동작을 둔다. 조회 상태와 관계없이 보인다. */
  actions?: ReactNode;
};

function Header({ children, actions }: DataTableHeaderProps) {
  return (
    <div {...stylex.props(styles.header)}>
      {children}
      {actions && <div {...stylex.props(styles.actions)}>{actions}</div>}
    </div>
  );
}

export type DataTableCountProps = {
  /** 페이지로 나누기 전 전체 건수를 보일 문구로 바꾼다. 단위·문구는 소비자가 정한다. */
  children: (count: number) => ReactNode;
};

function Count({ children }: DataTableCountProps) {
  const { state } = useList();
  const table = useTableContext();
  // 첫 로딩·첫 실패에는 받은 목록이 없어 건수를 숨긴다
  if (state.kind !== "loaded") return null;
  return <p {...stylex.props(styles.count)}>{children(table.getRowCount())}</p>;
}

function PageSize() {
  const selectId = useId();
  const table = useTableContext();
  const hasRows = useHasRows();
  if (!hasRows) return null;

  return (
    <div {...stylex.props(styles.pageSize)}>
      <span aria-hidden="true" {...stylex.props(styles.dot)}>
        ·
      </span>
      <label htmlFor={selectId} {...stylex.props(a11yStyles.visuallyHidden)}>
        페이지당 행 수
      </label>
      <div {...stylex.props(styles.pageSizeSelect)}>
        <Select
          id={selectId}
          value={table.atoms.pagination.get().pageSize}
          // setPageSize는 보던 행을 따라가므로 크기를 바꾸면 첫 페이지로 직접 옮긴다
          onChange={(event) =>
            table.setPagination({ pageIndex: 0, pageSize: Number(event.target.value) })
          }
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}개씩
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export type DataTableContentProps = {
  /** 첫 응답 전. 로딩 문구를 빼지 않는다. */
  pending?: ReactNode;
  /** 받은 목록 없이 실패. */
  error?: ReactNode;
  /** 다시 불러오기 실패. 이전 목록 위에 띠로 둔다. */
  refreshError?: ReactNode;
  empty?: ReactNode;
};

function Content({
  pending = <Skeleton label="목록을 불러오는 중이에요." rows={4} />,
  error = <RetryError message="목록을 불러오지 못했어요. 항목이 없다는 뜻은 아니에요." />,
  refreshError = (
    <RetryError message="최신 목록을 불러오지 못했어요. 이전에 불러온 목록을 보여드려요." />
  ),
  empty = <EmptyState title="아직 등록된 항목이 없어요" description="첫 항목을 추가해보세요." />,
}: DataTableContentProps) {
  const { title, state } = useList();
  const table = useTableContext();

  if (state.kind === "loading") return pending;
  if (state.kind === "failed") return error;

  // 빈 목록이어도 다시 불러오기 실패는 알린다
  return (
    <div {...stylex.props(styles.body)}>
      {state.refreshFailed && refreshError}
      {table.getRowCount() === 0 ? (
        empty
      ) : (
        <Table caption={title} hideCaption>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHeaderCell key={header.id} align={header.column.columnDef.meta?.align}>
                    {!header.isPlaceholder &&
                      renderTemplate(header.column.columnDef.header, header.getContext())}
                  </TableHeaderCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} align={cell.column.columnDef.meta?.align}>
                    {renderTemplate(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// FlexRender는 템플릿 함수를 컴포넌트로 그려 렌더마다 새로 만드는 열의 칸이 다시 마운트된다(버튼 포커스 유실).
// 그래서 함수로 부르고, 템플릿 안에서는 hook 대신 컴포넌트를 반환한다
function renderTemplate<TProps extends object>(
  template: ColumnDefTemplate<TProps> | undefined,
  props: TProps,
): ReactNode {
  return typeof template === "function" ? template(props) : template;
}

export type DataTableRetryErrorProps = {
  /** 실패 설명. 빈 결과와 구분되는 문구를 소비자가 정한다. */
  message: string;
};

/** 목록의 조회 실패. 첫 실패는 상자, 다시 불러오기 실패는 띠로 보이고 다시 시도는 Root의 query로 한다. */
function RetryError({ message }: DataTableRetryErrorProps) {
  const { state, retry, sectionRef } = useList();
  const retrying = state.kind !== "loading" && state.retrying;

  return (
    <RetryErrorState
      tone={state.kind === "loaded" ? "warning" : "danger"}
      message={message}
      retrying={retrying}
      onRetry={retry}
      // 성공하면 버튼이 사라지므로 목록 영역으로 옮긴다
      returnFocus={() => sectionRef.current}
    />
  );
}

function Footer({ children }: { children: ReactNode }) {
  const hasRows = useHasRows();
  if (!hasRows) return null;
  return <div {...stylex.props(styles.footer)}>{children}</div>;
}

function Pagination() {
  const { title } = useList();
  const table = useTableContext();
  const page = table.atoms.pagination.get().pageIndex + 1;
  const pageCount = Math.max(1, table.getPageCount());

  return (
    <nav aria-label={`${title} 페이지 이동`}>
      <div {...stylex.props(styles.pagination)}>
        <PageButton
          label="첫 페이지"
          symbol="«"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.firstPage()}
        />
        <PageButton
          label="이전 페이지"
          symbol="‹"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        />
        <p aria-live="polite" aria-atomic="true" {...stylex.props(styles.pageStatus)}>
          <span aria-hidden="true">
            <span {...stylex.props(styles.currentPage)}>{page}</span>
            <span {...stylex.props(styles.pageCount)}> / {pageCount}</span>
          </span>
          <span {...stylex.props(a11yStyles.visuallyHidden)}>
            전체 {pageCount}페이지 중 {page}페이지
          </span>
        </p>
        <PageButton
          label="다음 페이지"
          symbol="›"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        />
        <PageButton
          label="마지막 페이지"
          symbol="»"
          disabled={!table.getCanLastPage()}
          onClick={() => table.lastPage()}
        />
      </div>
    </nav>
  );
}

type PageButtonProps = Omit<
  ComponentPropsWithRef<"button">,
  "className" | "style" | "children" | "disabled"
> & {
  label: string;
  symbol: string;
  disabled: boolean;
};

// 경계에서 네이티브 disabled를 쓰면 누른 버튼이 포커스를 잃어 aria-disabled로 막는다
function PageButton({ label, symbol, disabled, onClick, ...props }: PageButtonProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      {...stylex.props(styles.pageButton, disabled && styles.pageButtonDisabled)}
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

export const DataTable = {
  Root,
  Header,
  Count,
  PageSize,
  Content,
  RetryError,
  Footer,
  Pagination,
};

const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    borderRadius: radii.card,
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
    gap: "8px 12px",
  },
  count: {
    margin: 0,
    color: colors.text,
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: "26px",
    fontVariantNumeric: "tabular-nums",
  },
  // 좁은 화면에서는 건수·등록 버튼 줄 아래로 내린다
  pageSize: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    order: {
      default: 0,
      [narrow]: 1,
    },
    flexBasis: {
      default: "auto",
      [narrow]: "100%",
    },
  },
  dot: {
    display: {
      default: "inline",
      [narrow]: "none",
    },
    color: colors.textMuted,
    fontSize: "16px",
  },
  pageSizeSelect: {
    width: "120px",
  },
  // 건수가 숨겨져도 동작은 오른쪽에 둔다
  actions: {
    marginInlineStart: "auto",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  pageButton: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    padding: 0,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.borderHover,
    borderRadius: radii.pill,
    backgroundColor: {
      default: colors.surface,
      ":hover": colors.neutralSurface,
    },
    color: colors.text,
    fontFamily: "inherit",
    fontSize: "16px",
    fontWeight: 600,
    lineHeight: 1,
    cursor: "pointer",
    transitionProperty: "background-color, border-color, color",
    transitionDuration: "120ms",
    outlineStyle: {
      default: "none",
      ":focus-visible": "solid",
    },
    outlineWidth: "2px",
    outlineOffset: "2px",
    outlineColor: colors.focusRing,
  },
  pageButtonDisabled: {
    borderColor: colors.disabledSurface,
    backgroundColor: colors.disabledSurface,
    color: colors.disabledText,
    cursor: "not-allowed",
  },
  pageStatus: {
    minWidth: "72px",
    margin: 0,
    fontSize: "14px",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  },
  currentPage: {
    color: colors.text,
    fontWeight: 700,
  },
  pageCount: {
    color: colors.textMuted,
    fontWeight: 400,
  },
});
