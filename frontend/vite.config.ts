import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = resolve(import.meta.dirname, '..');
export default defineConfig({
  envDir: root,
  plugins: [
    react(),
    {
      name: 'public-research-documents',
      async closeBundle() {
        const destination = resolve(import.meta.dirname, 'dist/docs');
        await mkdir(destination, { recursive: true });
        for (const filename of ['research.md', 'architecture.md', 'data-contract.md', 'api.md']) {
          await cp(resolve(root, 'docs', filename), resolve(destination, filename));
        }
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4173', changeOrigin: true },
      '/docs': { target: 'http://127.0.0.1:4173', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
