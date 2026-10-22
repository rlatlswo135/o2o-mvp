import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "./table.js";

const renderTable = (hideCaption = false) =>
  renderToStaticMarkup(
    <Table caption="예약 목록" hideCaption={hideCaption}>
      <TableHead>
        <TableRow>
          <TableHeaderCell>고객</TableHeaderCell>
          <TableHeaderCell align="end">잔액</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell>김서연</TableCell>
          <TableCell align="end">0원</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>이지우</TableCell>
          <TableCell align="end">30,000원</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );

describe("Table", () => {
  it("caption을 표 이름과 스크롤 영역 이름으로 함께 연결한다", () => {
    const html = renderTable();
    const captionId = /<caption id="([^"]+)"/.exec(html)?.[1];

    expect(captionId).toBeTruthy();
    expect(html).toMatch(
      new RegExp(`<div role="region" aria-labelledby="${captionId}" tabindex="0"`),
    );
    expect(html).toContain(">예약 목록</caption>");
  });

  it("caption을 화면에서 숨겨도 표 이름은 남긴다", () => {
    expect(renderTable(true)).toContain(">예약 목록</caption>");
  });

  it("열 머리글은 scope=col 네이티브 구조를 유지한다", () => {
    const html = renderTable();

    expect(html).toMatch(/<table[^>]*><caption/);
    expect(html.match(/<th scope="col"/g)).toHaveLength(2);
    expect(html).toContain("<thead>");
    expect(html).toContain("<tbody>");
  });

  it("행 선택 표시 없이 네이티브 표로 두고 grid 역할을 쓰지 않는다", () => {
    const html = renderTable();

    expect(html).not.toContain("aria-selected");
    expect(html).not.toMatch(/role="(grid|row|gridcell)"/);
  });
});
