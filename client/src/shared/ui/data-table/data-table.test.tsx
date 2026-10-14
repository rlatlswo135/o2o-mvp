import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { DataTableColumn, DataTableQuery } from "./data-table.js";

import { DataTable, resolveTableState } from "./data-table.js";

type Row = { id: number; name: string };

const rows: ReadonlyArray<Row> = [
  { id: 1, name: "김서연" },
  { id: 2, name: "이지우" },
];

function query(overrides: Partial<DataTableQuery<Row>>): DataTableQuery<Row> {
  return { status: "success", data: rows, isFetching: false, refetch: () => {}, ...overrides };
}

describe("resolveTableState", () => {
  it.each([
    { situation: "첫 응답 전", input: { status: "pending", data: undefined, isFetching: true } },
    {
      situation: "실패 뒤 다시 시도하는 중",
      input: { status: "error", data: undefined, isFetching: true },
    },
  ] as const)("$situation: 불러오는 중", ({ input }) => {
    expect(resolveTableState(input)).toEqual({ kind: "loading" });
  });

  it("받은 목록 없이 실패로 끝나면 실패", () => {
    expect(resolveTableState({ status: "error", data: undefined, isFetching: false })).toEqual({
      kind: "failed",
    });
  });

  it("받은 목록이 있으면 다시 불러오기 실패에도 목록을 유지하고 실패를 따로 표시한다", () => {
    expect(resolveTableState({ status: "error", data: rows, isFetching: false })).toEqual({
      kind: "loaded",
      rows,
      refreshFailed: true,
    });
    // 다시 시도하는 동안에는 실패 표시를 내린다.
    expect(resolveTableState({ status: "error", data: rows, isFetching: true })).toEqual({
      kind: "loaded",
      rows,
      refreshFailed: false,
    });
  });

  it("빈 목록도 받은 결과로 본다", () => {
    expect(resolveTableState({ status: "success", data: [], isFetching: false })).toEqual({
      kind: "loaded",
      rows: [],
      refreshFailed: false,
    });
  });
});

describe("DataTable", () => {
  const columns: ReadonlyArray<DataTableColumn<Row>> = [
    { key: "name", header: "이름", cell: (row) => row.name },
    { key: "no", header: "순번", cell: (_, index) => index + 1, align: "end" },
  ];

  function render(state: Partial<DataTableQuery<Row>>) {
    return renderToStaticMarkup(
      <DataTable
        title="전체 고객"
        query={query(state)}
        columns={columns}
        rowKey={(row) => row.id}
        toolbar={<button type="button">+ 등록</button>}
        footer={(list) => <p>합계 {list.length}명</p>}
        loadingLabel="불러오는 중이에요."
        errorMessage="불러오지 못했어요."
        refreshErrorMessage="최신 목록이 아니에요."
        empty={{ title: "비어 있어요", description: "첫 항목을 추가해보세요." }}
      />,
    );
  }

  it("목록은 열 정의 순서대로 그리고 제목·툴바·푸터 슬롯을 함께 둔다", () => {
    const html = render({});

    expect(html).toContain("전체 고객");
    expect(html).toContain("+ 등록");
    expect(html).toMatch(/이름.*순번/);
    expect(html).toMatch(/김서연.*1.*이지우.*2/);
    expect(html).toContain("합계 2명");
    expect(html).not.toContain("최신 목록이 아니에요.");
  });

  it("다시 불러오기 실패는 목록 위에 다시 시도와 함께 알린다", () => {
    const html = render({ status: "error" });

    expect(html).toMatch(/최신 목록이 아니에요\..*다시 시도.*김서연/);
  });

  it.each([
    {
      situation: "불러오는 중",
      state: { status: "pending", data: undefined },
      text: "불러오는 중이에요.",
    },
    {
      situation: "첫 조회 실패",
      state: { status: "error", data: undefined },
      text: "불러오지 못했어요.",
    },
    { situation: "빈 결과", state: { data: [] }, text: "비어 있어요" },
  ] as const)("$situation에는 표 대신 해당 상태만 보여준다", ({ state, text }) => {
    const html = render(state);

    expect(html).toContain(text);
    expect(html).toContain("+ 등록");
    expect(html).not.toContain("<table");
  });
});
