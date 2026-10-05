import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { DialogContentProps } from "./dialog.js";

import { Dialog, DialogContent, DialogTrigger } from "./dialog.js";

const actions = <button type="button">돌아가기</button>;

const renderDialog = (props: Partial<DialogContentProps> = {}) =>
  renderToStaticMarkup(
    <Dialog>
      <DialogTrigger>
        <button type="button">열기</button>
      </DialogTrigger>
      <DialogContent title="예약을 취소할까요?" actions={actions} {...props}>
        <p>본문</p>
      </DialogContent>
    </Dialog>,
  );

const dialogTag = (html: string) => /<dialog[^>]*>/.exec(html)?.[0] ?? "";

describe("Dialog", () => {
  it("제목을 dialog 이름으로, 설명을 dialog 설명으로 연결한다", () => {
    const html = renderDialog({ description: "일정에서 제외됩니다." });
    const titleId = /<h2 id="([^"]+)"/.exec(html)?.[1];
    const descriptionId = /<p id="([^"]+)"[^>]*>일정에서 제외됩니다.<\/p>/.exec(html)?.[1];

    expect(titleId).toBeTruthy();
    expect(descriptionId).toBeTruthy();
    expect(dialogTag(html)).toContain(`aria-labelledby="${titleId}"`);
    expect(dialogTag(html)).toContain(`aria-describedby="${descriptionId}"`);
  });

  it("설명이 없으면 aria-describedby를 붙이지 않는다", () => {
    expect(dialogTag(renderDialog())).not.toContain("aria-describedby");
  });

  it("닫힌 상태에서도 내용을 유지하되 open 속성 없이 렌더한다", () => {
    const html = renderDialog();

    expect(dialogTag(html)).not.toMatch(/\sopen/);
    expect(html).toContain(">예약을 취소할까요?</h2>");
    expect(html).toContain("<p>본문</p>");
  });

  it("닫기 아이콘 버튼에 접근 가능한 이름을 주고 기호는 숨긴다", () => {
    expect(renderDialog()).toMatch(
      /<button type="button" aria-label="닫기"[^>]*><span aria-hidden="true">×<\/span><\/button>/,
    );
    expect(renderDialog({ closeLabel: "창 닫기" })).toContain('aria-label="창 닫기"');
  });

  it("danger tone에서만 위험 표시를 보조기기에서 숨긴 채 보여준다", () => {
    const mark = /<span aria-hidden="true"[^>]*>!<\/span>/;

    expect(renderDialog({ tone: "danger" })).toMatch(mark);
    expect(renderDialog()).not.toMatch(mark);
  });

  it("트리거에 dialog를 연다는 의미를 붙인다", () => {
    expect(renderDialog()).toContain('<button type="button" aria-haspopup="dialog">열기</button>');
  });
});
