import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { Sheet, useSheetTitleId } from "./sheet.js";

const noop = () => {};

function Title() {
  return <h2 id={useSheetTitleId() ?? undefined}>고객 등록</h2>;
}

function dialogTag(html: string) {
  const tags = html.match(/<dialog[^>]*>/g) ?? [];
  expect(tags).toHaveLength(1);
  return tags[0] ?? "";
}

describe("Sheet", () => {
  it("안쪽 제목 id로 dialog 이름을 연결한다", () => {
    const html = renderToStaticMarkup(
      <Sheet open={false} onClose={noop} id="customer-panel">
        <Title />
      </Sheet>,
    );
    const dialog = dialogTag(html);
    const labelledBy = /\saria-labelledby="([^"]+)"/.exec(dialog)?.[1];

    expect(dialog).toContain(' id="customer-panel"');
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`<h2 id="${labelledBy}">고객 등록</h2>`);
  });

  it("dialog는 flame-ui Drawer가 하나만 그린다", () => {
    const dialog = dialogTag(
      renderToStaticMarkup(
        <Sheet open onClose={noop}>
          내용
        </Sheet>,
      ),
    );

    // Drawer.Content만 붙이는 표시
    expect(dialog).toContain("data-placement=");
  });

  it("열림은 showModal이 맡아 open 속성을 직접 쓰지 않는다", () => {
    expect(
      dialogTag(
        renderToStaticMarkup(
          <Sheet open onClose={noop}>
            내용
          </Sheet>,
        ),
      ),
    ).not.toMatch(/\sopen/);
  });

  it("Drawer의 인라인 크기를 지워 반응형 스타일이 크기를 정한다", () => {
    const dialog = dialogTag(
      renderToStaticMarkup(
        <Sheet open onClose={noop}>
          내용
        </Sheet>,
      ),
    );

    expect(dialog).not.toMatch(/style="[^"]*(height|width|margin)/);
  });

  it("닫을 수 없을 때만 브라우저 닫기 요청을 받지 않는다", () => {
    const render = (dismissible?: boolean) =>
      dialogTag(
        renderToStaticMarkup(
          <Sheet open onClose={noop} dismissible={dismissible}>
            내용
          </Sheet>,
        ),
      );

    expect(render(false)).toContain('closedby="none"');
    expect(render()).not.toContain("closedby");
    expect(render(true)).not.toContain("closedby");
  });

  it("손잡이 장식은 보조기기에서 숨긴다", () => {
    expect(
      renderToStaticMarkup(
        <Sheet open={false} onClose={noop}>
          내용
        </Sheet>,
      ),
    ).toMatch(/<span aria-hidden="true"[^>]*><\/span>내용/);
  });

  it("Sheet 밖에서는 제목 id가 없다", () => {
    expect(renderToStaticMarkup(<Title />)).toBe("<h2>고객 등록</h2>");
  });
});
