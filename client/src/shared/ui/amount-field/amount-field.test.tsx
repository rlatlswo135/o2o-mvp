import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { Field } from "../field/field.js";
import { AmountDisplay, AmountInput } from "./amount-field.js";

describe("AmountInput", () => {
  it("Field label·안내·오류와 단위를 입력에 연결한다", () => {
    const html = renderToStaticMarkup(
      <Field id="amount" label="변경 금액" description="안내" error="오류" required>
        <AmountInput defaultValue="-10" />
      </Field>,
    );

    expect(html).toContain('<label for="amount"');
    expect(html).toMatch(/<input[^>]*\sid="amount"/);
    expect(html).toMatch(/<input[^>]*\srequired=""/);
    expect(html).toContain('aria-invalid="true"');

    const unitId = /<span id="([^"]+)"[^>]*>원<\/span>/.exec(html)?.[1];
    expect(unitId).toBeTruthy();
    expect(html).toContain(`aria-describedby="amount-description amount-error ${unitId}"`);
  });

  it("입력 원문을 바꾸지 않는다", () => {
    const html = renderToStaticMarkup(<AmountInput defaultValue="10000" />);

    expect(html).toContain('value="10000"');
    expect(html).toContain('type="text"');
  });
});

describe("AmountDisplay", () => {
  it("Field label과 output을 연결하고 값과 단위를 표시한다", () => {
    const html = renderToStaticMarkup(
      <Field id="balance" label="변경 후 잔액">
        <AmountDisplay value={-10000} />
      </Field>,
    );

    expect(html).toContain('<label for="balance"');
    expect(html).toMatch(/<output id="balance"/);
    expect(html).toMatch(/<data value="-10000"[^>]*>-10,000<\/data>/);
    expect(html).toMatch(/>원<\/span>/);
  });

  it("0은 값으로, null은 빈 값으로 구분해 표시한다", () => {
    const zero = renderToStaticMarkup(<AmountDisplay value={0} />);
    const empty = renderToStaticMarkup(<AmountDisplay value={null} />);

    expect(zero).toMatch(/<data value="0"[^>]*>0<\/data>/);
    expect(empty).not.toContain("<data");
    expect(empty).not.toContain(">원<");
    expect(empty).toContain("값 없음");
  });
});
