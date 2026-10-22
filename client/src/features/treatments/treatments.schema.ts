import { z } from "zod";

import { parseAmount } from "@/shared/ui/amount-field/amount-field.util.ts";

export const treatmentInputSchema = z.object({
  name: z.string().trim().min(1, "시술 이름을 입력해주세요."),
  // 분 값에는 쉼표·+를 쓸 일이 없어 오입력으로 본다
  duration: z
    .string()
    .trim()
    .transform((text, ctx) => {
      const fail = (message: string) => {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      };
      if (text === "") return fail("소요시간을 입력해주세요.");
      if (/^-\d+(\.\d+)?$/.test(text)) return fail("1분 이상으로 입력해주세요.");
      if (/^\d+\.\d+$/.test(text)) return fail("소수 없이 분 단위 정수로 입력해주세요.");
      if (!/^\d+$/.test(text)) return fail("숫자로만 입력해주세요. 예: 60");
      const minutes = Number(text);
      if (!Number.isSafeInteger(minutes)) return fail("입력할 수 있는 범위를 넘었어요.");
      if (minutes <= 0) return fail("1분 이상으로 입력해주세요.");
      return minutes;
    }),
  price: z.string().transform((raw, ctx) => {
    const fail = (message: string) => {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    };
    const amount = parseAmount(raw);
    switch (amount.status) {
      case "empty":
        return fail("가격을 입력해주세요. 무료라면 0을 입력해요.");
      case "invalid":
        if (amount.reason === "range") return fail("입력할 수 있는 금액 범위를 넘었어요.");
        // parseAmount는 소수도 형식 오류로 돌려주므로 소수 모양일 때만 문구를 바꾼다
        return /^[+\-−]?[\d,]+\.\d+$/.test(raw.trim())
          ? fail("소수 없이 원 단위로 입력해주세요.")
          : fail("숫자로만 입력해주세요. 예: 35000");
      case "valid":
        return amount.value < 0 ? fail("0원 이상으로 입력해주세요.") : amount.value;
    }
  }),
});

export type TreatmentInput = z.output<typeof treatmentInputSchema>;
