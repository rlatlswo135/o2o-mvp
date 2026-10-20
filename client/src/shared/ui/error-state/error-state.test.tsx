import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ErrorState } from "./error-state.js";

describe("ErrorState", () => {
  it("실패 문구를 보여주고 기호는 보조기기에서 숨긴다", () => {
    const html = renderToStaticMarkup(<ErrorState message="고객 목록을 불러오지 못했어요." />);

    expect(html).toMatch(/<span aria-hidden="true"[^>]*>!<\/span>/);
    expect(html).toContain(">고객 목록을 불러오지 못했어요.</p>");
  });

  it("조회 영역의 정적 상태라 live region을 붙이지 않는다", () => {
    expect(renderToStaticMarkup(<ErrorState message="실패" />)).not.toMatch(
      /role="(status|alert)"|aria-live/,
    );
  });

  it("warning은 같은 문구·숨긴 기호를 다른 표현(띠)으로 보여준다", () => {
    const danger = renderToStaticMarkup(<ErrorState message="최신 목록이 아니에요." />);
    const warning = renderToStaticMarkup(
      <ErrorState tone="warning" message="최신 목록이 아니에요." />,
    );
    const rootClass = (html: string) => /^<div class="([^"]*)"/.exec(html)?.[1];

    expect(warning).toMatch(/<span aria-hidden="true"[^>]*>!<\/span>/);
    expect(warning).toContain(">최신 목록이 아니에요.</p>");
    expect(warning).not.toMatch(/role="(status|alert)"|aria-live/);
    expect(rootClass(warning)).not.toBe(rootClass(danger));
  });

  it("재시도 액션은 전달했을 때만 렌더한다", () => {
    expect(renderToStaticMarkup(<ErrorState message="실패" />)).not.toContain("<button");
    expect(
      renderToStaticMarkup(
        <ErrorState message="실패">
          <button type="button">다시 시도</button>
        </ErrorState>,
      ),
    ).toContain('<button type="button">다시 시도</button>');
  });
});
