import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CLIENT_ENTRIES = [
  'admin/index',
  'onboarding/index',
];

function addUseClientDirective() {
  for (const entry of CLIENT_ENTRIES) {
    const filePath = resolve('dist', entry + '.js');
    try {
      const content = readFileSync(filePath, 'utf-8');
      if (!content.startsWith('"use client"')) {
        writeFileSync(filePath, `"use client";\n${content}`);
      }
    } catch {}
  }
}

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/core/**/*.ts',
    'src/auth/**/*.ts',
    'src/routes/**/*.ts',
    'src/tenant/**/*.ts',
    'src/admin/**/*.tsx',
    'src/admin/**/*.ts',
    'src/onboarding/**/*.tsx',
    'src/onboarding/**/*.ts',
    'src/validators/**/*.ts',
    'src/types/**/*.ts',
    '!src/types/**/*.d.ts',
    'src/billing/**/*.ts',
  ],
  format: ['esm'],
  outExtension: () => ({ js: '.js' }),
  platform: 'node',
  dts: false,
  splitting: true,
  clean: true,
  outDir: 'dist',
  external: [
    'react',
    'react-dom',
    'next',
    '@prisma/client',
    '@withwiz/toolkit',
    '@withwiz/blog-core',
    'stripe',
    'zod',
  ],
  onSuccess: async () => {
    const stylesDir = resolve('dist', 'styles');
    mkdirSync(stylesDir, { recursive: true });
    copyFileSync(resolve('styles', 'blog-system-admin.css'), resolve(stylesDir, 'blog-system-admin.css'));
    addUseClientDirective();
  },
});
