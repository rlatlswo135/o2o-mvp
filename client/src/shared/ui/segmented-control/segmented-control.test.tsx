import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { SegmentedControl } from "./segmented-control.js";

// SSR 결과에서 해당 불리언 속성이 있는 input 태그만 고른다.
const inputsWith = (html: string, attribute: "checked" | "disabled") =>
  [...html.matchAll(/<input[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes(` ${attribute}=""`));
const checkedInputs = (html: string) => inputsWith(html, "checked");

const noop = () => undefined;

const themeOptions = [
  { value: "blue", label: "블루" },
  { value: "plum", label: "플럼" },
  { value: "sage", label: "세이지", disabled: true },
];

describe("SegmentedControl", () => {
  it("라디오 그룹 의미로 값 하나만 선택하고 숨긴 legend도 그룹 이름으로 남긴다", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        legend="테마"
        hideLegend
        name="theme"
        options={themeOptions}
        value="plum"
        onChange={noop}
      />,
    );

    expect(html).toMatch(/<legend[^>]*>테마<\/legend>/);
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    const checked = checkedInputs(html);
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('value="plum"');
  });

  it("옵션별 disabled를 해당 라디오에만 적용한다", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl legend="테마" options={themeOptions} defaultValue="blue" />,
    );

    const disabled = inputsWith(html, "disabled");
    expect(disabled).toHaveLength(1);
    expect(disabled[0]).toContain('value="sage"');
    expect(checkedInputs(html)[0]).toContain('value="blue"');
  });
});
