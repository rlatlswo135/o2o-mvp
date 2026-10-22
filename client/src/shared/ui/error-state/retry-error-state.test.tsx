import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { RetryErrorState } from "./retry-error-state.js";

const render = (retrying: boolean, tone?: "danger" | "warning") =>
  renderToStaticMarkup(
    <RetryErrorState
      message="불러오지 못했어요."
      tone={tone}
      retrying={retrying}
      onRetry={() => {}}
    />,
  );

describe("RetryErrorState", () => {
  it("실패 문구와 다시 시도 버튼, 비어 있는 숨긴 알림 영역을 둔다", () => {
    const html = render(false);

    expect(html).toContain("불러오지 못했어요.");
    expect(html).toMatch(/<button type="button"[^>]*>다시 시도<\/button>/);
    expect(html).not.toContain("aria-busy");
    expect(html).toMatch(/<span aria-live="polite"[^>]*><\/span>/);
  });

  it("다시 시도 중에는 문구를 그대로 두고 버튼만 막으며 진행을 숨긴 알림으로 전한다", () => {
    const html = render(true);

    expect(html).toContain("불러오지 못했어요.");
    expect(html).toMatch(/aria-disabled="true" aria-busy="true"[^>]*>.*다시 시도 중<\/button>/);
    expect(html).not.toMatch(/<button[^>]* disabled=""/);
    expect(html).toMatch(/<span aria-live="polite"[^>]*>다시 불러오는 중이에요\.<\/span>/);
  });

  it("tone은 오류 상자와 띠 모양을 고른다", () => {
    expect(render(false, "warning")).not.toBe(render(false, "danger"));
  });
});
