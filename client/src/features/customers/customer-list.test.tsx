import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { CustomerListQuery } from "./customer-list.tsx";

import { CustomerList } from "./customer-list.tsx";
import { exampleCustomers } from "./customer-mock.ts";

const noop = () => {};
const loading: CustomerListQuery = { kind: "loading" };
const failed: CustomerListQuery = { kind: "failed" };
const empty: CustomerListQuery = { kind: "loaded", customers: [] };
const loaded: CustomerListQuery = {
  kind: "loaded",
  customers: [{ id: "c-2000", name: "김서연", phone: "010-1234-0000" }, ...exampleCustomers()],
};

function render(query: CustomerListQuery) {
  return renderToStaticMarkup(<CustomerList query={query} onRetry={noop} />);
}

describe("CustomerList", () => {
  it("불러오는 중에는 상태 문구만 보여주고 목록·개수·빈 결과를 단정하지 않는다", () => {
    const html = render(loading);

    expect(html).toContain("고객 목록을 불러오는 중이에요.");
    expect(html).not.toContain("<table");
    expect(html).not.toMatch(/등록된 고객|아직 등록된 고객이 없어요/);
  });

  it("조회 실패는 빈 목록·0명과 구분하고 다시 시도 버튼을 둔다", () => {
    const html = render(failed);

    expect(html).toContain("고객 목록을 불러오지 못했어요.");
    expect(html).toContain(">다시 시도</button>");
    expect(html).not.toContain("<table");
    expect(html).not.toMatch(/0명|아직 등록된 고객이 없어요/);
  });

  it("빈 결과는 첫 고객 등록 안내를 보여준다", () => {
    const html = render(empty);

    expect(html).toContain("아직 등록된 고객이 없어요");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("다시 시도");
  });

  it("목록은 순서 번호·이름·전화번호와 전체 개수를 보여주고 동명이인을 각각 표시한다", () => {
    const html = render(loaded);

    expect(html).toContain("<caption");
    expect(html).toContain("고객 목록");
    expect(html.match(/<tr/g)).toHaveLength(7);
    expect(html.match(/>김서연</g)).toHaveLength(2);
    expect(html).toContain(">01<");
    expect(html).toContain(">06<");
    expect(html).toContain(">010-1234-0000<");
    expect(html).toContain("등록된 고객 6명");
  });

  it("목록 영역은 제목으로 이름 붙고 재시도 후 포커스를 받을 수 있다", () => {
    const html = render(failed);

    expect(html).toMatch(/<section[^>]*aria-labelledby="customer-list-title"[^>]*tabindex="-1"/);
    expect(html).toMatch(/<h2 id="customer-list-title"[^>]*>전체 고객<\/h2>/);
  });
});
