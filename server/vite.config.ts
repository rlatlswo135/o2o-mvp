import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    projects: [
      {
        test: {
          name: 'unit',
          include: ['**/*.spec.ts'],
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['**/*.e2e-spec.ts'],
        },
      },
    ],
  },
});
