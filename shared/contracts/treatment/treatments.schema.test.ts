import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";

import { treatmentInputSchema, treatmentSchema } from "./treatments.schema.ts";

const max = Number.MAX_SAFE_INTEGER;

describe("시술 입력", () => {
  it("이름 앞뒤 공백을 지우고, 다시 넣어도 같은 값이 나온다", () => {
    const once = treatmentInputSchema.parse({ name: "  젤 원컬러 ", duration: 60, price: 0 });

    expect(once).toEqual({ name: "젤 원컬러", duration: 60, price: 0 });
    expect(treatmentInputSchema.parse(once)).toEqual(once);
  });

  it("소요시간·가격은 안전 정수 상한까지 받는다", () => {
    expect(treatmentInputSchema.parse({ name: "긴 시술", duration: max, price: max })).toEqual({
      name: "긴 시술",
      duration: max,
      price: max,
    });
  });

  it.each([
    { duration: 0, message: "1분 이상으로 입력해주세요." },
    { duration: -30, message: "1분 이상으로 입력해주세요." },
    { duration: 1.5, message: "소수 없이 분 단위 정수로 입력해주세요." },
    { duration: max + 1, message: "입력할 수 있는 범위를 넘었어요." },
  ])("소요시간 $duration → $message", ({ duration, message }) => {
    const { error } = treatmentInputSchema.safeParse({ name: "젤", duration, price: 0 });

    expect(error && z.flattenError(error).fieldErrors).toEqual({ duration: [message] });
  });

  it.each([
    { price: -1, message: "0원 이상으로 입력해주세요." },
    { price: 1000.5, message: "소수 없이 원 단위로 입력해주세요." },
    { price: max + 1, message: "입력할 수 있는 금액 범위를 넘었어요." },
  ])("가격 $price → $message", ({ price, message }) => {
    const { error } = treatmentInputSchema.safeParse({ name: "젤", duration: 60, price });

    expect(error && z.flattenError(error).fieldErrors).toEqual({ price: [message] });
  });
});

describe("시술 응답", () => {
  it("안전 정수를 넘는 분·원은 계약에 맞지 않는 응답이다", () => {
    expect(
      treatmentSchema.safeParse({ id: 1, name: "젤", duration: max, price: max }).success,
    ).toBe(true);
    expect(
      treatmentSchema.safeParse({ id: 1, name: "젤", duration: max + 1, price: 0 }).success,
    ).toBe(false);
    expect(treatmentSchema.safeParse({ id: 1, name: "젤", duration: "60", price: 0 }).success).toBe(
      false,
    );
  });
});
