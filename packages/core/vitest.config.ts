import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'], // src 폴더 내의 테스트 파일만 포함
    exclude: ['dist/**', 'node_modules/**'],
  },
});
