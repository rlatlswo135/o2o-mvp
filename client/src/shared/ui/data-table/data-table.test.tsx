import type { PaginationState } from "@tanstack/react-table";

import * as stylex from "@stylexjs/stylex";
import { functionalUpdate } from "@tanstack/react-table";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { ManualPagination } from "./data-table.engine.ts";
import type { DataTableQuery } from "./data-table.state.ts";

import { EmptyState } from "../empty-state/empty-state.tsx";
import { a11yStyles } from "../internal/control-styles.ts";
import { Skeleton } from "../skeleton/skeleton.tsx";
import {
  createAppColumnHelper,
  nextPagination,
  useAppTable,
  useDataTableEngine,
} from "./data-table.engine.ts";
import { resolveListState } from "./data-table.state.ts";
import { DataTable } from "./data-table.tsx";

type Row = { id: number; name: string };

const people = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: index + 1, name: `고객${index + 1}` }));

const columnHelper = createAppColumnHelper<Row>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", { header: "이름", cell: ({ getValue }) => getValue() }),
  columnHelper.accessor("id", {
    header: "번호",
    meta: { align: "end" },
    cell: ({ getValue }) => `#${getValue()}`,
  }),
]);

const getRowId = (row: Row) => String(row.id);

describe("조회 상태 판정", () => {
  const settled = { status: "success", fetchStatus: "idle", errorUpdateCount: 0 } as const;

  it("첫 응답 전에는 불러오는 중", () => {
    expect(
      resolveListState({ ...settled, status: "pending", data: undefined, fetchStatus: "fetching" }),
    ).toEqual({ kind: "loading" });
  });

  it("받은 목록 없이 실패하면 다시 시도하는 동안에도 실패를 유지한다", () => {
    expect(
      resolveListState({ ...settled, status: "error", data: undefined, errorUpdateCount: 1 }),
    ).toEqual({ kind: "failed", retrying: false });
    // 다시 시도하면 Query는 status를 pending으로 되돌린다
    expect(
      resolveListState({
        status: "pending",
        data: undefined,
        fetchStatus: "fetching",
        errorUpdateCount: 1,
      }),
    ).toEqual({ kind: "failed", retrying: true });
    // 오프라인이면 요청을 보내지 못하고 연결을 기다린다(isFetching false)
    expect(
      resolveListState({
        status: "pending",
        data: undefined,
        fetchStatus: "paused",
        errorUpdateCount: 1,
      }),
    ).toEqual({ kind: "failed", retrying: true });
  });

  it("실패 이력 없이 연결을 기다리는 첫 조회는 불러오는 중이다", () => {
    expect(
      resolveListState({ ...settled, status: "pending", data: undefined, fetchStatus: "paused" }),
    ).toEqual({ kind: "loading" });
  });

  it("받은 목록이 있으면 재조회 중에는 그대로, 재조회 실패는 목록을 두고 따로 표시한다", () => {
    const rows = people(2);

    expect(resolveListState({ ...settled, data: rows, fetchStatus: "fetching" })).toEqual({
      kind: "loaded",
      rows,
      refreshFailed: false,
      retrying: false,
    });
    expect(
      resolveListState({ ...settled, status: "error", data: rows, errorUpdateCount: 1 }),
    ).toEqual({ kind: "loaded", rows, refreshFailed: true, retrying: false });
    expect(
      resolveListState({
        status: "error",
        data: rows,
        fetchStatus: "fetching",
        errorUpdateCount: 1,
      }),
    ).toEqual({ kind: "loaded", rows, refreshFailed: true, retrying: true });
  });

  it("빈 목록도 받은 결과로 본다", () => {
    expect(resolveListState({ ...settled, data: [] })).toEqual({
      kind: "loaded",
      rows: [],
      refreshFailed: false,
      retrying: false,
    });
  });
});

describe("행 수가 바뀐 뒤의 페이지", () => {
  const third = { pageIndex: 2, pageSize: 10 };

  it("행이 늘면 맨 앞의 새 항목이 보이게 첫 페이지로 간다", () => {
    expect(nextPagination(third, 23, 24)).toEqual({ pageIndex: 0, pageSize: 10 });
  });

  it("행 수가 같거나 줄어도 범위 안이면 보던 페이지를 유지한다", () => {
    expect(nextPagination(third, 23, 23)).toBe(third);
    expect(nextPagination(third, 23, 21)).toBe(third);
  });

  it("줄어서 범위를 벗어나면 마지막 페이지로 맞춘다", () => {
    expect(nextPagination(third, 23, 20)).toEqual({ pageIndex: 1, pageSize: 10 });
    expect(nextPagination(third, 23, 0)).toEqual({ pageIndex: 0, pageSize: 10 });
  });
});

describe("TanStack 페이지 모델", () => {
  // 실제 TanStack 표를 만들고 이동 요청은 바깥 상태 변경으로 받는다
  function tableAt(rowCount: number, pagination: PaginationState) {
    const changes: PaginationState[] = [];
    let table: ReturnType<typeof useAppTable<Row>> | undefined;
    function Probe({ capture }: { capture: (created: typeof table) => void }) {
      capture(
        useAppTable({
          data: people(rowCount),
          columns,
          getRowId,
          state: { pagination },
          onPaginationChange: (updater) => changes.push(functionalUpdate(updater, pagination)),
        }),
      );
      return null;
    }
    renderToStaticMarkup(<Probe capture={(created) => (table = created)} />);
    if (!table) throw new Error("표가 만들어지지 않았다");
    const created = table;
    return {
      table: created,
      changes,
      rowIds: () => created.getRowModel().rows.map((row) => row.id),
    };
  }

  it("23행을 10개씩 나누면 10·10·3행이고 전체 건수는 23이다", () => {
    const pages = [0, 1, 2].map((pageIndex) => tableAt(23, { pageIndex, pageSize: 10 }));

    expect(pages.map(({ rowIds }) => rowIds().length)).toEqual([10, 10, 3]);
    expect(pages[2]?.rowIds()).toEqual(["21", "22", "23"]);
    for (const { table } of pages) {
      expect(table.getRowCount()).toBe(23);
      expect(table.getPageCount()).toBe(3);
    }
  });

  it("첫 페이지는 앞으로, 마지막 페이지는 뒤로 갈 수 없다", () => {
    const first = tableAt(23, { pageIndex: 0, pageSize: 10 }).table;
    const last = tableAt(23, { pageIndex: 2, pageSize: 10 }).table;

    expect([first.getCanPreviousPage(), first.getCanNextPage(), first.getCanLastPage()]).toEqual([
      false,
      true,
      true,
    ]);
    expect([last.getCanPreviousPage(), last.getCanNextPage(), last.getCanLastPage()]).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("이동 버튼이 부르는 API는 바깥 페이지 상태로 다음 위치를 알린다", () => {
    const { table, changes } = tableAt(23, { pageIndex: 1, pageSize: 10 });

    table.nextPage();
    table.previousPage();
    table.firstPage();
    table.lastPage();
    table.setPagination({ pageIndex: 0, pageSize: 20 });

    expect(changes).toEqual([
      { pageIndex: 2, pageSize: 10 },
      { pageIndex: 0, pageSize: 10 },
      { pageIndex: 0, pageSize: 10 },
      { pageIndex: 2, pageSize: 10 },
      { pageIndex: 0, pageSize: 20 },
    ]);
  });

  it("20개씩이면 첫 페이지 20행, 전체 2페이지다", () => {
    const { table, rowIds } = tableAt(23, { pageIndex: 0, pageSize: 20 });

    expect(rowIds()).toHaveLength(20);
    expect(table.getPageCount()).toBe(2);
  });

  it.each([
    { rows: 0, pageRows: 0, pageCount: 0, canNext: false },
    { rows: 1, pageRows: 1, pageCount: 1, canNext: false },
    { rows: 10, pageRows: 10, pageCount: 1, canNext: false },
    { rows: 11, pageRows: 10, pageCount: 2, canNext: true },
  ])("$rows행: 첫 페이지 $pageRows행, 전체 $pageCount페이지", (expected) => {
    const { table, rowIds } = tableAt(expected.rows, { pageIndex: 0, pageSize: 10 });

    expect(rowIds()).toHaveLength(expected.pageRows);
    expect(table.getPageCount()).toBe(expected.pageCount);
    expect(table.getCanNextPage()).toBe(expected.canNext);
  });

  it("서버가 나눈 페이지(manual)는 받은 행을 다시 자르지 않고 이동은 바깥 상태로 넘긴다", () => {
    const state = { pageIndex: 1, pageSize: 10 };
    const changes: PaginationState[] = [];
    const manual: ManualPagination = {
      state,
      rowCount: 23,
      onChange: (updater) => changes.push(functionalUpdate(updater, state)),
    };
    let table: ReturnType<typeof useDataTableEngine<Row>> | undefined;
    function Probe({ capture }: { capture: (created: typeof table) => void }) {
      capture(
        useDataTableEngine({
          data: people(23).slice(10, 20),
          columns,
          getRowId,
          pagination: manual,
        }),
      );
      return null;
    }
    renderToStaticMarkup(<Probe capture={(created) => (table = created)} />);

    expect(table?.getRowModel().rows.map((row) => row.id)).toEqual(
      people(23)
        .slice(10, 20)
        .map((row) => String(row.id)),
    );
    expect(table?.getRowCount()).toBe(23);
    expect(table?.getPageCount()).toBe(3);
    table?.nextPage();
    expect(changes).toEqual([{ pageIndex: 2, pageSize: 10 }]);
  });
});

describe("DataTable 조합", () => {
  function query(overrides: Partial<DataTableQuery<Row>>): DataTableQuery<Row> {
    return {
      status: "success",
      data: people(23),
      fetchStatus: "idle",
      errorUpdateCount: 0,
      refetch: () => {},
      ...overrides,
    };
  }

  function render(state: Partial<DataTableQuery<Row>> = {}, pagination?: ManualPagination) {
    return renderToStaticMarkup(
      <DataTable.Root
        title="고객 목록"
        query={query(state)}
        columns={columns}
        getRowId={getRowId}
        pagination={pagination}
      >
        <DataTable.Header actions={<button type="button">+ 등록</button>}>
          <DataTable.Count>{(count) => `전체 ${count}명`}</DataTable.Count>
          <DataTable.PageSize />
        </DataTable.Header>
        <DataTable.Content
          pending={<Skeleton label="불러오는 중이에요." rows={4} />}
          error={<DataTable.RetryError message="불러오지 못했어요." />}
          empty={<EmptyState title="비어 있어요" description="첫 항목을 추가해보세요." />}
        />
        <DataTable.Footer>
          <DataTable.Pagination />
        </DataTable.Footer>
      </DataTable.Root>,
    );
  }

  const bodyRows = (html: string) => /<tbody>(.*)<\/tbody>/.exec(html)?.[1]?.match(/<tr/g) ?? [];
  const pageButton = (html: string, label: string) =>
    new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0] ?? "";

  it("머리 줄(건수·크기·동작) → 표 → 표 밖 하단 이동 순서로 조합한다", () => {
    const html = render();

    expect(html).toMatch(/전체 23명.*<select.*\+ 등록.*<table.*<\/table>.*<nav/);
    expect(html).not.toContain("<tfoot");
    expect(html).not.toMatch(/<nav.*<\/table>/);
  });

  it("건수는 페이지로 나누기 전 전체 행 수이고 표에는 현재 페이지 행만 그린다", () => {
    const html = render();

    expect(html).toContain(">전체 23명</p>");
    expect(bodyRows(html)).toHaveLength(10);
    expect(html).toContain("고객10");
    expect(html).not.toContain("고객11");
  });

  it("title은 숨긴 h2·표 caption·하단 이동 이름에 쓴다", () => {
    const html = render();
    const titleId = /<section aria-labelledby="([^"]+)"/.exec(html)?.[1];
    const hiddenClass = stylex.props(a11yStyles.visuallyHidden).className;

    expect(titleId).toBeTruthy();
    expect(html).toContain(`<h2 id="${titleId}" class="${hiddenClass}">고객 목록</h2>`);
    expect(html).toMatch(/<caption[^>]*>고객 목록<\/caption>/);
    expect(html).toContain('<nav aria-label="고객 목록 페이지 이동">');
    expect(html.match(/<th scope="col"/g)).toHaveLength(2);
  });

  it("열 meta.align이 end면 머리글과 칸을 오른쪽 정렬한다", () => {
    const html = render();
    const [nameHead, idHead] = [...html.matchAll(/<th scope="col" class="([^"]*)"/g)].map(
      ([, className]) => className,
    );

    expect(idHead).not.toBe(nameHead);
    expect(html).toMatch(/<td class="([^"]*)">고객1<\/td><td class="(?!\1)[^"]*">#1<\/td>/);
  });

  it("페이지 크기는 숨긴 레이블이 붙은 select이고 10개씩이 기본이다", () => {
    const html = render();
    const selectId = /<select id="([^"]+)"/.exec(html)?.[1];

    expect(html).toMatch(/<span aria-hidden="true"[^>]*>·<\/span>/);
    expect(html).toContain(`<label for="${selectId}"`);
    expect(html).toContain(">페이지당 행 수</label>");
    expect([...html.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(([, text]) => text)).toEqual([
      "10개씩",
      "20개씩",
      "50개씩",
    ]);
    expect(html).toMatch(/<option value="10" selected="">/);
  });

  it("현재/전체 페이지를 보이고 보조기기에는 숨긴 문구로 알린다", () => {
    const html = render();

    expect(html).toMatch(/aria-live="polite" aria-atomic="true"/);
    expect(html).toMatch(/<span aria-hidden="true"><span[^>]*>1<\/span><span[^>]*> \/ 3<\/span>/);
    expect(html).toContain("전체 3페이지 중 1페이지");
  });

  it("첫 페이지에서는 첫/이전만 aria-disabled로 막고 네이티브 disabled는 쓰지 않는다", () => {
    const html = render();

    expect(pageButton(html, "첫 페이지")).toContain('aria-disabled="true"');
    expect(pageButton(html, "이전 페이지")).toContain('aria-disabled="true"');
    expect(pageButton(html, "다음 페이지")).not.toContain("aria-disabled");
    expect(pageButton(html, "마지막 페이지")).not.toContain("aria-disabled");
    expect(html).not.toMatch(/<button[^>]* disabled=""/);
    expect(html).toMatch(/<span aria-hidden="true">«<\/span>/);
  });

  it("한 페이지 결과는 1 / 1과 막힌 버튼 네 개를 보인다", () => {
    const html = render({ data: people(3) });

    expect(html).toContain("전체 1페이지 중 1페이지");
    for (const label of ["첫 페이지", "이전 페이지", "다음 페이지", "마지막 페이지"]) {
      expect(pageButton(html, label)).toContain('aria-disabled="true"');
    }
  });

  it.each([
    {
      situation: "첫 로딩",
      state: { status: "pending", data: undefined, fetchStatus: "fetching" },
      text: "불러오는 중이에요.",
    },
    {
      situation: "첫 실패",
      state: { status: "error", data: undefined, errorUpdateCount: 1 },
      text: "불러오지 못했어요.",
    },
    {
      situation: "첫 실패 뒤 다시 시도 중",
      state: { status: "pending", data: undefined, fetchStatus: "fetching", errorUpdateCount: 1 },
      text: "다시 시도 중",
    },
  ] as const)("$situation: 건수·크기·표·하단 이동을 숨기고 동작은 남긴다", ({ state, text }) => {
    const html = render(state);

    expect(html).toContain(text);
    expect(html).toContain("+ 등록");
    expect(html).not.toMatch(/전체|<select|<table|<nav/);
  });

  it("첫 실패 뒤 다시 시도 중에는 스켈레톤으로 바꾸지 않고 오류 상자의 버튼만 막는다", () => {
    const html = render({
      status: "pending",
      data: undefined,
      fetchStatus: "fetching",
      errorUpdateCount: 1,
    });

    expect(html).toContain("불러오지 못했어요.");
    expect(html).toMatch(/<button[^>]*aria-busy="true"[^>]*>.*다시 시도 중<\/button>/);
    // 스켈레톤은 aria-busy 영역이다. 숨긴 알림의 "다시 불러오는 중이에요."와 구분한다
    expect(html).not.toMatch(/<div aria-busy="true"/);
  });

  it("빈 결과는 0건과 빈 상태를 보이고 크기·하단 이동은 숨긴다", () => {
    const html = render({ data: [] });

    expect(html).toContain(">전체 0명</p>");
    expect(html).toContain("비어 있어요");
    expect(html).not.toMatch(/<select|<table|<nav/);
  });

  it("재조회 중에는 정상 목록과 같게 보인다", () => {
    expect(render({ fetchStatus: "fetching" })).toBe(render());
  });

  it("재조회 실패는 이전 목록·건수·하단 이동을 둔 채 표 위에 띠와 다시 시도를 둔다", () => {
    const html = render({ status: "error", errorUpdateCount: 1 });

    expect(html).toMatch(
      /전체 23명.*최신 목록을 불러오지 못했어요\. 이전에 불러온 목록을 보여드려요\..*다시 시도.*<table.*고객1.*<nav/,
    );
    expect(bodyRows(html)).toHaveLength(10);
  });

  it("재조회 실패 뒤 다시 시도 중에도 띠를 두고 버튼만 막는다", () => {
    const html = render({ status: "error", fetchStatus: "fetching", errorUpdateCount: 1 });

    expect(html).toContain("최신 목록을 불러오지 못했어요.");
    expect(html).toMatch(/aria-busy="true"[^>]*>.*다시 시도 중<\/button>/);
  });

  it("받은 목록이 비어 있어도 재조회 실패 띠와 다시 시도를 빈 상태 위에 둔다", () => {
    const html = render({ status: "error", data: [], errorUpdateCount: 1 });

    expect(html).toMatch(/전체 0명.*최신 목록을 불러오지 못했어요\..*다시 시도.*비어 있어요/);
    expect(html).not.toMatch(/<select|<table|<nav/);
    expect(
      render({ status: "error", data: [], fetchStatus: "fetching", errorUpdateCount: 1 }),
    ).toMatch(
      /최신 목록을 불러오지 못했어요\..*aria-busy="true"[^>]*>.*다시 시도 중<\/button>.*비어 있어요/,
    );
  });

  it("첫 실패 뒤 오프라인 다시 시도는 스켈레톤 대신 오류 상자와 막힌 버튼을 둔다", () => {
    const html = render({
      status: "pending",
      data: undefined,
      fetchStatus: "paused",
      errorUpdateCount: 1,
    });

    expect(html).toContain("불러오지 못했어요.");
    expect(html).toMatch(/aria-busy="true"[^>]*>.*다시 시도 중<\/button>/);
    expect(html).not.toMatch(/<div aria-busy="true"/);
  });

  it("서버가 나눈 페이지(manual)는 받은 행을 모두 그리고 바깥 상태·전체 건수로 조작을 맞춘다", () => {
    const html = render(
      { data: people(23).slice(10, 20) },
      { state: { pageIndex: 1, pageSize: 10 }, rowCount: 23, onChange: () => {} },
    );

    expect(bodyRows(html)).toHaveLength(10);
    expect(html).toMatch(/고객11.*고객20/);
    expect(html).toContain(">전체 23명</p>");
    expect(html).toContain("전체 3페이지 중 2페이지");
    expect(pageButton(html, "이전 페이지")).not.toContain("aria-disabled");
  });

  it("상태 슬롯을 생략하면 공통 기본 표현을 쓴다", () => {
    const withDefaults = (state: Partial<DataTableQuery<Row>>) =>
      renderToStaticMarkup(
        <DataTable.Root title="목록" query={query(state)} columns={columns} getRowId={getRowId}>
          <DataTable.Content />
        </DataTable.Root>,
      );

    expect(withDefaults({ status: "pending", data: undefined })).toContain('aria-busy="true"');
    expect(withDefaults({ status: "pending", data: undefined })).toContain(
      "목록을 불러오는 중이에요.",
    );
    expect(withDefaults({ status: "error", data: undefined })).toContain("다시 시도");
    expect(withDefaults({ data: [] })).toContain("아직 등록된 항목이 없어요");
  });
});
