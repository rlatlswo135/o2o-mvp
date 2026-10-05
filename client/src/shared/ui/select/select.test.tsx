import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { Field } from "../field/field.js";
import { Select } from "./select.js";

describe("Field + Select", () => {
  it("label·안내·오류·required를 select에 연결한다", () => {
    const html = renderToStaticMarkup(
      <Field id="staff" label="담당자" description="안내" error="오류" required>
        <Select>
          <option value="owner">사장님</option>
        </Select>
      </Field>,
    );

    expect(html).toContain('<label for="staff"');
    expect(html).toMatch(/<select[^>]*\sid="staff"/);
    expect(html).toMatch(/<select[^>]*\srequired=""/);
    expect(html).toMatch(/<select[^>]*\saria-invalid="true"/);
    expect(html).toMatch(/<select[^>]*\saria-describedby="staff-description staff-error"/);
  });

  it("꺾쇠 표시는 보조기기에서 숨긴다", () => {
    const html = renderToStaticMarkup(
      <Select aria-label="담당자">
        <option value="owner">사장님</option>
      </Select>,
    );

    expect(html).toMatch(/<\/select><span aria-hidden="true"/);
    expect(html).not.toContain("aria-invalid");
  });
});
