import { describe, expect, it } from "vite-plus/test";

import { formatAmount, parseAmount } from "./amount-field.util.js";

describe("parseAmount", () => {
  it("빈 값과 공백은 0이 아닌 빈 값으로 구분한다", () => {
    expect(parseAmount("")).toEqual({ status: "empty" });
    expect(parseAmount("   ")).toEqual({ status: "empty" });
  });

  it("음수·0·양수의 부호를 유지한다", () => {
    expect(parseAmount("-10000")).toEqual({ status: "valid", value: -10000 });
    expect(parseAmount("−10000")).toEqual({ status: "valid", value: -10000 });
    expect(parseAmount("0")).toEqual({ status: "valid", value: 0 });
    expect(parseAmount("+30000")).toEqual({ status: "valid", value: 30000 });
    expect(parseAmount(" 30000 ")).toEqual({ status: "valid", value: 30000 });
  });

  it("-0은 0으로 정규화한다", () => {
    const result = parseAmount("-0");
    expect(result).toEqual({ status: "valid", value: 0 });
    expect(result.status === "valid" && Object.is(result.value, -0)).toBe(false);
  });

  it("세 자리 묶음 쉼표만 허용한다", () => {
    expect(parseAmount("1,000,000")).toEqual({ status: "valid", value: 1000000 });
    expect(parseAmount("1,00")).toEqual({ status: "invalid", reason: "format" });
    expect(parseAmount(",100")).toEqual({ status: "invalid", reason: "format" });
  });

  it("정수 원 단위가 아니면 NaN·0 대신 형식 오류로 돌려준다", () => {
    for (const raw of ["abc", "10.5", "1e3", "--1", "-", "10원", "1 000", "0x10"]) {
      expect(parseAmount(raw)).toEqual({ status: "invalid", reason: "format" });
    }
  });

  it("안전한 정수 경계까지 허용하고 넘으면 범위 오류로 돌려준다", () => {
    expect(parseAmount("9007199254740991")).toEqual({
      status: "valid",
      value: Number.MAX_SAFE_INTEGER,
    });
    expect(parseAmount("-9007199254740991")).toEqual({
      status: "valid",
      value: -Number.MAX_SAFE_INTEGER,
    });
    expect(parseAmount("9007199254740992")).toEqual({ status: "invalid", reason: "range" });
    expect(parseAmount("-99999999999999999999")).toEqual({ status: "invalid", reason: "range" });
  });
});

describe("formatAmount", () => {
  it("천 단위 구분 쉼표와 부호로 표시한다", () => {
    expect(formatAmount(-10000)).toBe("-10,000");
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(30000)).toBe("30,000");
  });
});
