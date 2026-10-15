import { describe, expect, it } from "vite-plus/test";

import { formatPhone } from "./phone.ts";

describe("formatPhone", () => {
  it.each([
    ["01012345678", "010-1234-5678"],
    ["0111234567", "011-123-4567"],
    ["0311234567", "031-123-4567"],
    ["0212345678", "02-1234-5678"],
    ["021234567", "02-123-4567"],
    ["15881234", "1588-1234"],
  ])("%s → %s", (digits, expected) => {
    expect(formatPhone(digits)).toBe(expected);
  });

  it.each(["12345678901", "821012345678", "123456789"])(
    "국내 번호 형태가 아니면 그대로 둔다: %s",
    (digits) => {
      expect(formatPhone(digits)).toBe(digits);
    },
  );
});
