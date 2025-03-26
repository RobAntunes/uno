import { defineConfig } from 'vite';
import { join } from 'path';
import { builtinModules } from 'module';

export default defineConfig({
  root: __dirname,
  build: {
    outDir: '../../dist/apps/desktop',
    emptyOutDir: true,
    target: 'node16',
    lib: {
      entry: 'src/app/main.ts',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  resolve: {
    alias: {
      '@electron': join(__dirname, 'src/app'),
    },
  },
}); 