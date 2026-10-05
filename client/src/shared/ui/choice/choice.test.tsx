import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { Radio, RadioGroup, Switch } from "./choice.js";

// SSR 결과에서 해당 불리언 속성이 있는 input 태그만 고른다.
const inputsWith = (html: string, attribute: "checked" | "disabled") =>
  [...html.matchAll(/<input[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes(` ${attribute}=""`));
const checkedInputs = (html: string) => inputsWith(html, "checked");

const noop = () => undefined;

describe("RadioGroup + Radio", () => {
  it("그룹 값과 같은 라디오 하나만 선택하고 같은 name과 legend로 묶는다", () => {
    const html = renderToStaticMarkup(
      <RadioGroup legend="차단 방식" name="block" value="repeat" onChange={noop}>
        <Radio value="once">일회성</Radio>
        <Radio value="repeat">반복</Radio>
      </RadioGroup>,
    );

    expect(html).toMatch(/<fieldset[^>]*><legend[^>]*>차단 방식<\/legend>/);
    expect(html.match(/name="block"/g)).toHaveLength(2);
    const checked = checkedInputs(html);
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('value="repeat"');
  });

  it("비제어 그룹은 defaultValue로 처음 선택을 정한다", () => {
    const html = renderToStaticMarkup(
      <RadioGroup legend="차단 방식" defaultValue="once">
        <Radio value="once">일회성</Radio>
        <Radio value="repeat">반복</Radio>
      </RadioGroup>,
    );

    const checked = checkedInputs(html);
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('value="once"');
  });

  it("그룹 disabled는 fieldset과 모든 라디오를 막는다", () => {
    const html = renderToStaticMarkup(
      <RadioGroup legend="차단 방식" disabled>
        <Radio value="once">일회성</Radio>
        <Radio value="repeat">반복</Radio>
      </RadioGroup>,
    );

    expect(html).toMatch(/<fieldset disabled=""/);
    expect(inputsWith(html, "disabled")).toHaveLength(2);
  });
});

describe("Switch", () => {
  it("체크박스에 switch 역할을 주고 label 안에서 이름을 갖는다", () => {
    const html = renderToStaticMarkup(<Switch defaultChecked>알림 사용</Switch>);

    expect(html).toMatch(/<label[^>]*><input[^>]*type="checkbox"[^>]*role="switch"/);
    expect(html).toMatch(/\schecked=""/);
    expect(html).toMatch(/>알림 사용<\/label>$/);
  });
});
