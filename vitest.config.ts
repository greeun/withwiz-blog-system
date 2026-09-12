import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // 테스트는 배포 경로(@withwiz/blog-system/*)로 import하므로 소스 디렉터리에 연결한다.
      { find: /^@withwiz\/blog-system\/(.+)$/, replacement: src('$1/index.ts') },
      { find: /^@withwiz\/blog-system$/, replacement: src('index.ts') },
      // @withwiz/toolkit이 확장자 없이 next/server를 불러오므로 vite 해석용으로 보정한다.
      { find: /^next\/server$/, replacement: 'next/server.js' },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    server: {
      deps: {
        // toolkit 내부의 next/server import에도 위 별칭을 적용하기 위해 vite 변환 대상으로 포함한다.
        inline: ['@withwiz/toolkit'],
      },
    },
  },
});
