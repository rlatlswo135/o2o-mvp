import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { Input } from "../input/input.js";
import { Field } from "./field.js";

describe("Field + Input", () => {
  it("id를 생략해도 자동 생성 id로 label과 입력을 연결한다", () => {
    const html = renderToStaticMarkup(
      <Field label="이름">
        <Input />
      </Field>,
    );

    const labelFor = /<label for="([^"]+)"/.exec(html)?.[1];
    expect(labelFor).toBeTruthy();
    expect(html).toContain(`<input id="${labelFor}"`);
  });

  it("오류가 있으면 aria-invalid를 붙이고 안내·오류 문구를 함께 연결한다", () => {
    const html = renderToStaticMarkup(
      <Field id="phone" label="전화번호" description="안내 문구" error="오류 문구">
        <Input />
      </Field>,
    );

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="phone-description phone-error"');
    expect(html).toMatch(/<p id="phone-error"[^>]*>.*오류 문구<\/p>/);
  });

  it("오류가 없으면 안내 문구만 연결하고 invalid로 표시하지 않는다", () => {
    const html = renderToStaticMarkup(
      <Field id="name" label="이름" description="안내 문구">
        <Input />
      </Field>,
    );

    expect(html).toContain('aria-describedby="name-description"');
    expect(html).not.toContain("aria-invalid");
  });

  it("빈 오류 문구는 오류로 보지 않는다", () => {
    const html = renderToStaticMarkup(
      <Field id="name" label="이름" error="">
        <Input />
      </Field>,
    );

    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("aria-describedby");
  });

  it("Field의 연결 정보와 입력에 직접 준 aria-describedby를 합친다", () => {
    const html = renderToStaticMarkup(
      <Field id="name" label="이름" error="오류 문구">
        <Input aria-describedby="extra" />
      </Field>,
    );

    expect(html).toContain('aria-describedby="name-error extra"');
  });

  it("Field의 required를 입력까지 전달하고 시각 기호는 보조기기에서 숨긴다", () => {
    const html = renderToStaticMarkup(
      <Field id="name" label="이름" required>
        <Input />
      </Field>,
    );

    expect(html).toMatch(/<input[^>]*\srequired=""/);
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>\*<\/span>/);
  });
});
