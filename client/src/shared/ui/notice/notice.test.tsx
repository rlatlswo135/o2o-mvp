import type { ReactElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { NoticeContent, NoticeTone } from "./notice.js";

import { LiveNotice, Notice } from "./notice.js";

const noop = () => {};
const tones: ReadonlyArray<NoticeTone> = ["success", "warning", "danger"];

const content = (tone: NoticeTone): NoticeContent => ({
  tone,
  title: `${tone} 제목`,
  description: `${tone} 설명`,
});

const regions = (html: string) => ({
  status: /<div role="status">(.*?)<\/div><div role="alert">/.exec(html)?.[1],
  alert: /<div role="alert">(.*)<\/div>$/.exec(html)?.[1],
});

describe("Notice", () => {
  it("의미별 기호는 숨기고 제목·설명 텍스트로 결과를 전달한다", () => {
    const marks = tones.map((tone) => {
      const html = renderToStaticMarkup(<Notice {...content(tone)} />);
      expect(html).toContain(`>${tone} 제목</p>`);
      expect(html).toContain(`>${tone} 설명</p>`);
      return /<span aria-hidden="true"[^>]*>(.)<\/span>/.exec(html)?.[1];
    });

    expect(marks).toEqual(["✓", "!", "!"]);
  });

  it("정적 표현이라 live region 속성이 없다", () => {
    for (const tone of tones) {
      expect(renderToStaticMarkup(<Notice {...content(tone)} onClose={noop} />)).not.toMatch(
        /role="(status|alert)"|aria-live/,
      );
    }
  });

  it("onClose가 있을 때만 대상 이름을 가진 닫기 버튼을 보여준다", () => {
    const close =
      /<button type="button" aria-label="([^"]+)"[^>]*><span aria-hidden="true">×<\/span><\/button>/;

    expect(renderToStaticMarkup(<Notice {...content("success")} />)).not.toContain("<button");
    expect(
      close.exec(renderToStaticMarkup(<Notice {...content("success")} onClose={noop} />))?.[1],
    ).toBe("success 제목 닫기");
    expect(
      close.exec(
        renderToStaticMarkup(
          <Notice {...content("success")} onClose={noop} closeLabel="결과 알림 닫기" />,
        ),
      )?.[1],
    ).toBe("결과 알림 닫기");
  });

  it("설명 없이 제목만 보여줄 수 있다", () => {
    expect(renderToStaticMarkup(<Notice tone="warning" title="제목만" />)).not.toMatch(
      /<p[^>]*><\/p>/,
    );
  });
});

describe("LiveNotice", () => {
  it("알림이 없어도 status·alert 영역을 비워 둔 채 유지한다", () => {
    expect(renderToStaticMarkup(<LiveNotice notice={null} />)).toBe(
      '<div role="status"></div><div role="alert"></div>',
    );
  });

  it("성공·경고는 status, 실패는 alert 영역 하나에만 넣는다", () => {
    for (const tone of tones) {
      const html = renderToStaticMarkup(<LiveNotice notice={content(tone)} onClose={noop} />);
      const { status, alert } = regions(html);
      const [filled, empty] = tone === "danger" ? [alert, status] : [status, alert];

      expect(filled).toContain(`${tone} 제목`);
      expect(empty).toBe("");
      expect(html.match(/ 제목<\/p>/g)).toHaveLength(1);
      expect(html.match(/role="/g)).toHaveLength(2);
    }
  });

  it("noticeKey는 영역 구조를 바꾸지 않고 안쪽 알림 항목만 구분한다", () => {
    type Region = ReactElement<{ children: ReactElement }>;
    type Regions = ReactElement<{ children: [Region, Region] }>;
    // 성공 알림이 들어간 status 영역의 안쪽 Notice key
    const innerKey = (noticeKey?: number) => {
      const element = LiveNotice({ notice: content("success"), noticeKey }) as Regions;
      return element.props.children[0].props.children.key;
    };

    expect(innerKey(1)).toBe("1");
    expect(innerKey(2)).toBe("2");
    expect(innerKey()).toBeNull();
    expect(renderToStaticMarkup(<LiveNotice notice={content("danger")} noticeKey={7} />)).toBe(
      renderToStaticMarkup(<LiveNotice notice={content("danger")} />),
    );
  });
});
