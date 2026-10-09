import { z } from "zod";

export const customerSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  phone: z.string(),
});

export type Customer = z.infer<typeof customerSchema>;

export type CustomerInput = {
  name: string;
  phone: string;
};

export type CustomerFieldErrors = {
  name?: string | undefined;
  phone?: string | undefined;
};

export type CustomerValidation =
  | { ok: true; value: CustomerInput }
  | { ok: false; errors: CustomerFieldErrors };

const allowedPhone = /^[\d\s-]+$/;

/** 중복 비교용 전화번호. 공백·하이픈만 지우며 저장 값은 입력한 문자열 그대로 둔다. */
export function comparablePhone(phone: string) {
  return phone.replace(/[\s-]/g, "");
}

export function validateCustomerInput(input: CustomerInput): CustomerValidation {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const errors: CustomerFieldErrors = {};

  if (name === "") errors.name = "고객 이름을 입력해주세요.";
  if (comparablePhone(phone) === "") errors.phone = "전화번호를 입력해주세요.";
  else if (!allowedPhone.test(phone))
    errors.phone = "전화번호는 숫자, 공백, 하이픈(-)만 입력할 수 있어요.";

  return errors.name || errors.phone ? { ok: false, errors } : { ok: true, value: { name, phone } };
}
