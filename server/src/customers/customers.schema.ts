import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1),
  phone: z
    .string()
    .trim()
    .regex(/^(?=.*\d)[\d\s-]+$/),
});

export const customerIdSchema = z.coerce.number().int().positive().max(2_147_483_647);

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
