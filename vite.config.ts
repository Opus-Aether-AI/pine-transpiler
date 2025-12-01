import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'cli/index': resolve(__dirname, 'src/cli/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'js' : 'cjs';
        return `${entryName}.${ext}`;
      },
    },
    sourcemap: true,
    minify: false,
    target: 'esnext',
    rollupOptions: {
      external: ['node:fs', 'node:path', 'node:util', 'node:url'],
    },
  },
  plugins: [dts({ rollupTypes: true })],
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: [...configDefaults.exclude],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/types.ts', // Type-only files with no runtime code
        'src/types/**', // Type definitions
        'src/**/index.ts', // Re-export barrels
        'src/runtime/**', // Runtime stubs (not used in transpilation)
        'src/stdlib/**', // StdPlus polyfill (tested separately)
      ],
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 60,
        statements: 70,
      },
    },
  },
});
