import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { Skeleton } from "./skeleton.js";

describe("Skeleton", () => {
  it("로딩 영역을 busy로 표시하고 로딩 문구는 보조기기에 남긴다", () => {
    const html = renderToStaticMarkup(<Skeleton label="고객 목록을 불러오는 중이에요." />);

    expect(html).toMatch(/^<div aria-busy="true"/);
    expect(html).toMatch(/<p [^>]*>고객 목록을 불러오는 중이에요.<\/p>/);
    expect(html).not.toMatch(/aria-hidden="true"[^>]*>고객 목록을/);
  });

  it("placeholder 장식은 보조기기에서 숨기고 행 수를 따른다", () => {
    const decoration = (html: string) =>
      /<div aria-hidden="true"[^>]*>(.*)<\/div><\/div>$/.exec(html)?.[1] ?? "";
    const rowCount = (html: string) => decoration(html).match(/data-skeleton-row/g)?.length ?? 0;

    expect(rowCount(renderToStaticMarkup(<Skeleton label="불러오는 중" />))).toBe(3);
    expect(rowCount(renderToStaticMarkup(<Skeleton label="불러오는 중" rows={5} />))).toBe(5);
  });
});
