import { defineConfig } from 'vite-plus';

export default defineConfig({
  // @/*·@db/* 경로 별칭(tsconfig paths)을 테스트에서도 푼다
  resolve: { tsconfigPaths: true },
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
