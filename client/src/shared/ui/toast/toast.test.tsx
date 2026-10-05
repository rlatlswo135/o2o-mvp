import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { NoticeContent } from "../notice/notice.js";

import { Toast } from "./toast.js";

const noop = () => {};
const failure: NoticeContent = {
  tone: "danger",
  title: "저장 실패",
  description: "다시 시도해주세요.",
};

describe("Toast", () => {
  it("알림이 없어도 알림 영역을 유지하고 컨테이너에는 live 의미를 겹치지 않는다", () => {
    const html = renderToStaticMarkup(<Toast notice={null} onClose={noop} />);

    expect(html).toContain('<div role="status"></div><div role="alert"></div>');
    expect(html.match(/role="/g)).toHaveLength(2);
    expect(html).not.toContain("aria-live");
  });

  it("실패 Toast는 alert 영역에 한 번만 넣고 닫기 버튼을 둔다", () => {
    const html = renderToStaticMarkup(<Toast notice={failure} onClose={noop} />);

    expect(html).toContain('<div role="status"></div><div role="alert">');
    expect(html.match(/>저장 실패<\/p>/g)).toHaveLength(1);
    expect(html).toContain('aria-label="저장 실패 닫기"');
  });
});
