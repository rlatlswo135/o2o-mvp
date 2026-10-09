import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string(),
  phone: z.string(),
});

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
