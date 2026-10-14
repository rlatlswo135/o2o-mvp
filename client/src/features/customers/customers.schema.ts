import { z } from "zod";

export const customerSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  phone: z.string(),
});

export type Customer = z.infer<typeof customerSchema>;

/** 등록 입력. 앞뒤 공백을 지운 값이 저장 값이 된다. 항목마다 첫 번째 오류만 보여주도록 비었으면 이후 확인을 멈춘다. */
export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "고객 이름을 입력해주세요."),
  phone: z
    .string()
    .trim()
    .refine((phone) => phone.replace(/[\s-]/g, "") !== "", {
      message: "전화번호를 입력해주세요.",
      abort: true,
    })
    .regex(/^[\d\s-]+$/, "전화번호는 숫자, 공백, 하이픈(-)만 입력할 수 있어요."),
});

/** 확인을 통과해 다듬어진 등록 입력. 저장에는 이 값만 보낸다. */
export type CustomerInput = z.output<typeof customerInputSchema>;
