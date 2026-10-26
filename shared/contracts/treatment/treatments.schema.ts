import { z } from "zod";

// 분·원은 JS number로 정확히 다룰 수 있는 안전 정수까지 받는다. DB도 integer(32bit)가 아니라 bigint로 저장한다.
export const treatmentSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  duration: z.number().int().positive(),
  price: z.number().int().nonnegative(),
});

// zod의 int는 안전 정수만 받는다. 범위를 넘으면 too_big·too_small, 소수면 invalid_type이다
const intMessages = (fraction: string, tooSmall: string, tooBig: string) => ({
  error: (issue: { code?: string | undefined }) =>
    issue.code === "too_big" ? tooBig : issue.code === "too_small" ? tooSmall : fraction,
});

// 클라이언트 폼은 문자열을 숫자로 바꾼 뒤 이 스키마의 출력 모양으로 보낸다. 서버가 다시 확인한다.
export const treatmentInputSchema = z.object({
  name: z.string().trim().min(1, "시술 이름을 입력해주세요."),
  duration: z
    .number("소요시간을 입력해주세요.")
    .int(
      intMessages(
        "소수 없이 분 단위 정수로 입력해주세요.",
        "1분 이상으로 입력해주세요.",
        "입력할 수 있는 범위를 넘었어요.",
      ),
    )
    .min(1, "1분 이상으로 입력해주세요."),
  price: z
    .number("가격을 입력해주세요. 무료라면 0을 입력해요.")
    .int(
      intMessages(
        "소수 없이 원 단위로 입력해주세요.",
        "0원 이상으로 입력해주세요.",
        "입력할 수 있는 금액 범위를 넘었어요.",
      ),
    )
    .min(0, "0원 이상으로 입력해주세요."),
});

export type Treatment = z.output<typeof treatmentSchema>;
export type TreatmentInput = z.output<typeof treatmentInputSchema>;
