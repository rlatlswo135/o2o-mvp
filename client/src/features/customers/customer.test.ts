import { describe, expect, it } from "vite-plus/test";

import { comparablePhone, validateCustomerInput } from "./customer.ts";

describe("validateCustomerInput", () => {
  it("이름 앞뒤 공백을 지우고 전화번호는 문자열 그대로 보존한다", () => {
    expect(validateCustomerInput({ name: "  김서연 ", phone: " 010-0000-1001 " })).toEqual({
      ok: true,
      value: { name: "김서연", phone: "010-0000-1001" },
    });
    expect(validateCustomerInput({ name: "이지우", phone: "0101234" })).toEqual({
      ok: true,
      value: { name: "이지우", phone: "0101234" },
    });
  });

  it("공백뿐인 이름과 빈 전화번호를 각 항목 오류로 거절한다", () => {
    expect(validateCustomerInput({ name: "   ", phone: "" })).toEqual({
      ok: false,
      errors: { name: "고객 이름을 입력해주세요.", phone: "전화번호를 입력해주세요." },
    });
  });

  it("숫자·공백·하이픈 외 문자는 전화번호 오류로 거절한다", () => {
    for (const phone of ["010-0000-100a", "+82 10 0000 1001", "010.0000.1001"]) {
      expect(validateCustomerInput({ name: "김서연", phone })).toEqual({
        ok: false,
        errors: { phone: "전화번호는 숫자, 공백, 하이픈(-)만 입력할 수 있어요." },
      });
    }
  });

  it("숫자 없이 공백·하이픈만 있으면 빈 전화번호로 본다", () => {
    expect(validateCustomerInput({ name: "김서연", phone: " - - " })).toEqual({
      ok: false,
      errors: { phone: "전화번호를 입력해주세요." },
    });
  });
});

describe("comparablePhone", () => {
  it("비교할 때만 공백·하이픈을 지우고 앞자리 0은 유지한다", () => {
    expect(comparablePhone("010-0000 1001")).toBe("01000001001");
    expect(comparablePhone("0 1 0")).toBe("010");
  });
});
