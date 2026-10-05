import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { Field } from "../field/field.js";
import { Textarea } from "./textarea.js";

describe("Field + Textarea", () => {
  it("label·안내·오류·required를 textarea에 연결하고 직접 준 설명과 합친다", () => {
    const html = renderToStaticMarkup(
      <Field id="reason" label="변경 사유" description="안내" error="오류" required>
        <Textarea aria-describedby="extra" />
      </Field>,
    );

    expect(html).toContain('<label for="reason"');
    expect(html).toMatch(/<textarea[^>]*\sid="reason"/);
    expect(html).toMatch(/<textarea[^>]*\srequired=""/);
    expect(html).toMatch(/<textarea[^>]*\saria-invalid="true"/);
    expect(html).toMatch(
      /<textarea[^>]*\saria-describedby="reason-description reason-error extra"/,
    );
  });

  it("오류가 없으면 invalid로 표시하지 않는다", () => {
    const html = renderToStaticMarkup(
      <Field id="reason" label="변경 사유">
        <Textarea />
      </Field>,
    );

    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("aria-describedby");
  });
});
