import type { SeedRefine } from './index.ts';

export const refine: SeedRefine = (f) => ({
  customers: {
    count: 15,
    columns: {
      name: f.fullName(),
      phone: f.phoneNumber({ template: '###########' }),
    },
  },
});
