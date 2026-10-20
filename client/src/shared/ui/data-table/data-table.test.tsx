import * as stylex from "@stylexjs/stylex";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { DataTableColumn, DataTableProps, DataTableQuery } from "./data-table.js";

import { a11yStyles } from "../internal/control-styles.js";
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

  type Slots = Pick<DataTableProps<Row>, "countLabel" | "toolbar" | "footer">;

  const defaultSlots: Slots = {
    countLabel: (count) => `전체 ${count}명`,
    toolbar: <button type="button">+ 등록</button>,
    footer: (list) => <p>합계 {list.length}명</p>,
  };

  function render(
    state: Partial<DataTableQuery<Row>>,
    selectedKey?: number,
    slots: Slots = defaultSlots,
  ) {
    return renderToStaticMarkup(
      <DataTable
        title="고객 목록"
        query={query(state)}
        selectedKey={selectedKey}
        columns={columns}
        rowKey={(row) => row.id}
        {...slots}
        loadingLabel="불러오는 중이에요."
        errorMessage="불러오지 못했어요."
        refreshErrorMessage="최신 목록이 아니에요."
        empty={{ title: "비어 있어요", description: "첫 항목을 추가해보세요." }}
      />,
    );
  }

  it("목록은 열 정의 순서대로 그리고 건수·툴바·푸터 슬롯을 함께 둔다", () => {
    const html = render({});

    expect(html).toMatch(/전체 2명.*\+ 등록.*<table/);
    expect(html).toMatch(/이름.*순번/);
    expect(html).toMatch(/김서연.*1.*이지우.*2/);
    expect(html).toMatch(/<\/table>.*합계 2명/);
    expect(html).not.toContain("최신 목록이 아니에요.");
  });

  it("title은 화면에서 숨긴 h2로 섹션 이름이 되고 표 caption으로도 쓴다", () => {
    const html = render({});
    const titleId = /<section aria-labelledby="([^"]+)"/.exec(html)?.[1];
    const hiddenClass = stylex.props(a11yStyles.visuallyHidden).className;

    expect(titleId).toBeTruthy();
    expect(html).toContain(`<h2 id="${titleId}" class="${hiddenClass}">고객 목록</h2>`);
    expect(html).toMatch(/<caption[^>]*>고객 목록<\/caption>/);
  });

  it("건수는 실시간 알림 없는 일반 문단이다", () => {
    const html = render({});

    expect(html).toMatch(/<p class="[^"]*">전체 2명<\/p>/);
    expect(html).not.toMatch(/aria-live|role="status"/);
  });

  it.each([
    { situation: "첫 로딩", state: { status: "pending", data: undefined } },
    { situation: "첫 조회 실패", state: { status: "error", data: undefined } },
    {
      situation: "실패 뒤 다시 시도 중",
      state: { status: "error", data: undefined, isFetching: true },
    },
  ] as const)("$situation에는 건수를 숨기고 툴바는 남긴다", ({ state }) => {
    const html = render(state);

    expect(html).not.toContain("전체");
    expect(html).toContain("+ 등록");
  });

  it.each([
    { situation: "정상 빈 결과", state: { data: [] }, label: "전체 0명" },
    { situation: "정상 목록", state: {}, label: "전체 2명" },
    { situation: "재조회 중", state: { isFetching: true }, label: "전체 2명" },
    { situation: "재조회 실패", state: { status: "error" }, label: "전체 2명" },
  ] as const)("$situation에는 보이는 행 수로 건수를 보인다", ({ state, label }) => {
    expect(render(state)).toContain(`>${label}</p>`);
  });

  it("건수 문구는 소비자가 정하고 DataTable은 단위를 넣지 않는다", () => {
    const html = render({}, undefined, { countLabel: (count) => `시술 ${count}개` });

    expect(html).toContain(">시술 2개</p>");
    expect(html).not.toContain("명");
  });

  it("countLabel을 생략하면 건수 없이 툴바와 푸터만 둔다", () => {
    const html = render({}, undefined, {
      toolbar: defaultSlots.toolbar,
      footer: defaultSlots.footer,
    });

    expect(html).not.toContain("전체");
    expect(html).toContain("+ 등록");
    expect(html).toMatch(/<\/table>.*합계 2명/);
  });

  it("건수와 툴바가 모두 없으면 머리 줄을 그리지 않는다", () => {
    const withoutHeader = render({}, undefined, {});
    const headerOnlyCount = render({}, undefined, { countLabel: defaultSlots.countLabel });

    expect(withoutHeader).toMatch(/고객 목록<\/h2><div[^>]*><div role="region"/);
    expect(headerOnlyCount).toMatch(/고객 목록<\/h2><div[^>]*><p[^>]*>전체 2명<\/p><\/div>/);
    // 첫 로딩에는 건수가 숨겨져 툴바 없는 소비자는 머리 줄이 없다
    expect(
      render({ status: "pending", data: undefined }, undefined, {
        countLabel: defaultSlots.countLabel,
      }),
    ).toMatch(/고객 목록<\/h2><div aria-busy="true"/);
  });

  it("다시 불러오기 실패는 목록 위에 다시 시도와 함께 알린다", () => {
    const html = render({ status: "error" });

    expect(html).toMatch(/최신 목록이 아니에요\..*다시 시도.*김서연/);
  });

  it("selectedKey와 같은 행만 선택 행으로 강조한다", () => {
    const rowClasses = (html: string) =>
      [...html.matchAll(/<tbody[^>]*>.*<\/tbody>/g)]
        .flatMap(([body]) => [...body.matchAll(/<tr class="([^"]*)"/g)])
        .map(([, className]) => className);
    const [plainFirst, plainSecond] = rowClasses(render({}));
    const [first, second] = rowClasses(render({}, 2));

    expect(plainFirst).toBe(plainSecond);
    expect(first).toBe(plainFirst);
    expect(second).not.toBe(plainSecond);
    expect(render({}, 2)).not.toContain("aria-selected");
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
