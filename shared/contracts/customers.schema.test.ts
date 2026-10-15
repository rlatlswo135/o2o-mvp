import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";

import { customerInputSchema } from "./customers.schema.ts";

describe("고객 입력", () => {
  it("이름 앞뒤 공백을 지우고 전화번호는 숫자만 남긴다", () => {
    expect(customerInputSchema.parse({ name: "  김서연 ", phone: " 010-1234 5678 " })).toEqual({
      name: "김서연",
      phone: "01012345678",
    });
  });

  it("한 번 정리한 값을 다시 넣어도 같은 값이 나온다", () => {
    // 클라이언트가 정리한 값을 서버가 다시 검증한다.
    const once = customerInputSchema.parse({ name: " 김서연 ", phone: "010-1234-5678" });

    expect(customerInputSchema.parse(once)).toEqual(once);
  });

  it.each(["1234-5678", "123456789012345"])("숫자 8~15자리는 받는다: %s", (phone) => {
    expect(customerInputSchema.safeParse({ name: "김서연", phone }).success).toBe(true);
  });

  it.each([
    {
      case: "이름과 전화번호가 비어 있음",
      input: { name: "   ", phone: "" },
      errors: { name: ["고객 이름을 입력해주세요."], phone: ["전화번호를 입력해주세요."] },
    },
    {
      case: "숫자 없이 공백·하이픈만 있는 전화번호",
      input: { name: "김서연", phone: " - - " },
      errors: { phone: ["전화번호를 입력해주세요."] },
    },
    ...["010-0000-100a", "+82 10 0000 1001", "010.0000.1001"].map((phone) => ({
      case: `허용되지 않는 문자가 든 전화번호 ${phone}`,
      input: { name: "김서연", phone },
      errors: { phone: ["전화번호는 숫자, 공백, 하이픈(-)만 입력할 수 있어요."] },
    })),
    ...["123-4567", "1234567890123456"].map((phone) => ({
      case: `자릿수가 맞지 않는 전화번호 ${phone}`,
      input: { name: "김서연", phone },
      errors: { phone: ["전화번호는 8~15자리 숫자로 입력해주세요."] },
    })),
  ])("$case: 항목마다 오류를 하나씩만 알린다", ({ input, errors }) => {
    const { error } = customerInputSchema.safeParse(input);

    expect(error && z.flattenError(error).fieldErrors).toEqual(errors);
  });
});
