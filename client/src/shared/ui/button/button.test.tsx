import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { Button } from "./button.js";

describe("Button", () => {
  it("type을 생략하면 폼을 제출하지 않도록 button으로 렌더한다", () => {
    expect(renderToStaticMarkup(<Button>저장</Button>)).toContain('type="button"');
  });

  it("loading이면 포커스를 유지한 채 처리 중임을 알린다", () => {
    const html = renderToStaticMarkup(<Button loading>저장 중</Button>);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/\sdisabled=""/);
  });

  it("loading이 아니면 처리 중 속성과 표시를 출력하지 않는다", () => {
    const html = renderToStaticMarkup(<Button>저장</Button>);

    expect(html).not.toContain("aria-busy");
    expect(html).not.toContain("aria-disabled");
    expect(html).not.toContain("<span");
  });
});
