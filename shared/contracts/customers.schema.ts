import { z } from "zod";

// 응답 스키마에는 transform, pipe, default를 쓰지 않는다.
// 서버 출력 검증과 클라이언트 응답 검증이 같은 값을 그대로 통과시켜야 한다.
export const customerSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  phone: z.string(),
});

export type Customer = z.output<typeof customerSchema>;

const PHONE_SEPARATORS = /[\s-]/g;

// 클라이언트가 parse한 값을 서버가 다시 parse한다. transform은 두 번 적용해도 결과가 같아야 한다.
export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "고객 이름을 입력해주세요."),
  phone: z
    .string()
    .trim()
    .refine((value) => value.replace(PHONE_SEPARATORS, "") !== "", {
      error: "전화번호를 입력해주세요.",
      abort: true,
    })
    .regex(/^[\d\s-]+$/, "전화번호는 숫자, 공백, 하이픈(-)만 입력할 수 있어요.")
    .transform((value) => value.replace(PHONE_SEPARATORS, ""))
    .pipe(z.string().regex(/^\d{8,15}$/, "전화번호는 8~15자리 숫자로 입력해주세요.")),
});

export type CustomerInput = z.output<typeof customerInputSchema>;
