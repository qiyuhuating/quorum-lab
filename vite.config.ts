import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'build-revision',
      transformIndexHtml: () => [
        {
          tag: 'meta',
          attrs: { name: 'quorum-revision', content: process.env.GITHUB_SHA ?? 'local' },
          injectTo: 'head' as const,
        },
      ],
    },
  ],
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
