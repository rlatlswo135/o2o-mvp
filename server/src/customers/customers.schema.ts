import { z } from 'zod';

// TODO: phone 정규식 넣어서 validating 에러 뱉게
export const createCustomerSchema = z.object({
  name: z.string(),
  phone: z.string(),
});

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
