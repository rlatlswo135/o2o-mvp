import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { CustomerForm } from "./customer-form.tsx";

const nameInputRef = createRef<HTMLInputElement>();
const onSave = vi.fn<() => void>();
const onClose = vi.fn<() => void>();

function render(saving: boolean) {
  return renderToStaticMarkup(
    <CustomerForm
      titleId="register-title"
      nameInputRef={nameInputRef}
      saving={saving}
      onSave={onSave}
      onClose={onClose}
    />,
  );
}

describe("CustomerForm", () => {
  it("패널은 제목으로 이름 붙고 닫기 버튼은 이름을 가진다", () => {
    const html = render(false);

    expect(html).toMatch(/<section aria-labelledby="register-title"/);
    expect(html).toMatch(/<h2 id="register-title"[^>]*>새 고객 등록<\/h2>/);
    expect(html).toMatch(/<button type="button" aria-label="등록 닫기"/);
  });

  it("이름·전화번호는 필수 label과 연결되고 전화번호 안내가 설명으로 연결된다", () => {
    const html = render(false);

    expect(html).toMatch(/<label for="([^"]+)"[^>]*>이름<span aria-hidden="true"/);
    const nameInput = html.match(/<input[^>]*name="name"[^>]*>/)?.[0] ?? "";
    const phoneInput = html.match(/<input[^>]*name="phone"[^>]*>/)?.[0] ?? "";
    expect(nameInput).toContain('required=""');
    expect(nameInput).toContain('placeholder="고객 이름 입력"');
    expect(phoneInput).toContain('required=""');
    expect(phoneInput).toContain('type="tel"');
    expect(phoneInput).toMatch(/aria-describedby="[^"]+-description"/);
    expect(html).toContain("예약 안내에 사용할 연락처를 입력해주세요.");
    expect(html).toContain("같은 전화번호가 이미 등록되어 있으면 저장할 때 알려드려요.");
    expect(html).not.toContain("aria-invalid");
  });

  it("기본 상태는 입력·취소·저장이 가능하다", () => {
    const html = render(false);

    expect(html).not.toContain("readOnly");
    expect(html).not.toMatch(/readonly|aria-busy|disabled=""/);
    expect(html).toContain('type="submit"');
    expect(html).toContain("고객 저장</button>");
  });

  it("저장 중에는 입력을 읽기 전용으로, 저장 버튼을 진행 상태로, 취소·닫기를 비활성으로 바꾼다", () => {
    const html = render(true);

    expect(html).toMatch(/<form[^>]*aria-busy="true"/);
    expect(html.match(/<input[^>]*readOnly=""/g)).toHaveLength(2);
    expect(html).toMatch(/<button type="submit"[^>]*aria-disabled="true"[^>]*aria-busy="true"/);
    expect(html).toContain("저장 중</button>");
    expect(html).toMatch(/aria-label="등록 닫기" disabled=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>취소<\/button>/);
  });
});
