import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // node-pty는 네이티브 모듈(.node 바이너리)이므로 번들에 포함하면 안 된다.
              // require('node-pty')로 런타임에 node_modules에서 직접 로드해야 한다.
              // 네이티브 모듈은 번들에 포함하면 안 된다.
              // 런타임에 node_modules에서 직접 require()로 로드해야 한다.
              external: ['node-pty', 'ssh2', 'keytar', 'electron-store'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
        onstart(args) {
          args.reload();
        },
      },
    ]),
    electronRenderer(),
  ],
  build: {
    outDir: 'dist',
  },
});
