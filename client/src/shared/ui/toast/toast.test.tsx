import { toast as flameToast } from "flame-ui";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { toast } from "./toast.js";

vi.mock("flame-ui", () => ({ toast: vi.fn<typeof flameToast>(), Toaster: () => null }));

/** 마지막으로 flame-ui에 넘긴 토스트 내용과 옵션. */
function lastShown() {
  const call = vi.mocked(flameToast).mock.lastCall;
  if (!call) throw new Error("toast가 호출되지 않았다");
  const [content, options] = call;
  return { html: renderToStaticMarkup(content), content, options };
}

describe("toast", () => {
  beforeEach(() => {
    vi.mocked(flameToast).mockClear();
  });

  it("toast()는 받은 내용을 감싸지 않고 그대로 넘긴다", () => {
    const content = <strong>직접 그린 알림</strong>;
    toast(content, { timeout: 1000 });

    expect(lastShown().content).toBe(content);
    expect(lastShown().options).toEqual({ timeout: 1000 });
  });

  it("제목과 설명을 차례로 결과 카드에 넣고 설명이 없으면 제목만 둔다", () => {
    toast.success({ title: "고객을 등록했어요.", description: "목록 맨 위에 추가했어요." });
    expect(lastShown().html).toMatch(
      /<p[^>]*>고객을 등록했어요\.<\/p><p[^>]*>목록 맨 위에 추가했어요\.<\/p>/,
    );

    toast.success({ title: <strong>김서연</strong> });
    expect(lastShown().html).toMatch(/<p[^>]*><strong>김서연<\/strong><\/p>/);
    expect(lastShown().html.match(/<p/g)).toHaveLength(1);
  });

  it("결과 기호는 보조기기에서 숨기고 카드 자체에는 live 의미를 겹치지 않는다", () => {
    toast.error({ title: "저장하지 못했어요." });
    const { html } = lastShown();

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("role=");
    expect(html).not.toContain("aria-live");
  });

  it("톤마다 기본 표시 시간을 두고 호출 측 timeout이 우선한다", () => {
    toast.success({ title: "성공" });
    expect(lastShown().options).toEqual({ timeout: 4000 });
    toast.warn({ title: "경고" });
    expect(lastShown().options).toEqual({ timeout: 6000 });
    toast.error({ title: "실패" });
    expect(lastShown().options).toEqual({ timeout: 6000 });
    toast.error({ title: "실패" }, { timeout: 10_000 });
    expect(lastShown().options).toEqual({ timeout: 10_000 });
  });
});
