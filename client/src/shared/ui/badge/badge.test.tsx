import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { BadgeTone } from "./badge.js";

import { Badge, badgeMark } from "./badge.js";

const tones: ReadonlyArray<BadgeTone> = ["info", "success", "neutral", "warning", "danger"];
const markedTones: ReadonlyArray<BadgeTone> = ["info", "success", "warning", "danger"];

describe("Badge", () => {
  it("의미별 보조 기호를 구분하고 neutral은 기호 없이 둔다", () => {
    expect(tones.map((tone) => badgeMark(tone))).toEqual(["•", "✓", null, "!", "!"]);
  });

  it("기호가 있는 의미는 문구를 그대로 보여주고 기호만 보조기기에서 숨긴다", () => {
    for (const tone of markedTones) {
      const html = renderToStaticMarkup(<Badge tone={tone}>상태 문구</Badge>);

      expect(html).toContain(`<span aria-hidden="true">${badgeMark(tone)}</span>상태 문구`);
    }
  });

  it("정적 표시라 live region 속성을 붙이지 않는다", () => {
    const html = renderToStaticMarkup(<Badge tone="danger">처리 실패</Badge>);

    expect(html).not.toMatch(/role="(status|alert)"/);
    expect(html).not.toContain("aria-live");
  });

  it("tone을 생략하면 기호 없는 중립 표현을 쓴다", () => {
    expect(renderToStaticMarkup(<Badge>사용 안 함</Badge>)).not.toContain("aria-hidden");
  });
});
