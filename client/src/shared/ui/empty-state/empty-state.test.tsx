import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { EmptyState } from "./empty-state.js";

describe("EmptyState", () => {
  it("제목과 설명을 항상 보여주고 live region을 붙이지 않는다", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="아직 등록된 고객이 없어요" description="첫 고객을 등록해보세요." />,
    );

    expect(html).toContain(">아직 등록된 고객이 없어요</p>");
    expect(html).toContain(">첫 고객을 등록해보세요.</p>");
    expect(html).not.toMatch(/role="(status|alert)"|aria-live/);
  });

  it("액션은 전달했을 때만 렌더한다", () => {
    const withoutAction = renderToStaticMarkup(<EmptyState title="결과 없음" description="설명" />);
    const withAction = renderToStaticMarkup(
      <EmptyState title="결과 없음" description="설명">
        <button type="button">고객 등록</button>
      </EmptyState>,
    );

    expect(withoutAction).not.toContain("<button");
    expect(withAction).toContain('<button type="button">고객 등록</button>');
  });
});
