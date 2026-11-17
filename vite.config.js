import { defineConfig } from 'vite';
import { privateLibraryPlugin } from './src/catalog/library/private-assets-plugin.js';
import { resolve, sep, extname } from 'node:path';
import { createReadStream, statSync } from 'node:fs';

// Bind to 0.0.0.0 so the dev server is reachable from outside the container.
// Licensed GLBs stay under public/licensed; builds never copy that library.
// The private preview reads those assets directly from their licensed home.
export default defineConfig({
  plugins: [privateLibraryPlugin(), {
    name: 'private-public-preview',
    configurePreviewServer(server) {
      const publicRoot = resolve(__dirname, 'public');
      server.middlewares.use((req, res, next) => {
        let file;
        try { file = resolve(publicRoot, '.' + decodeURIComponent((req.url || '').split('?')[0])); }
        catch { return next(); }
        if (!file.startsWith(publicRoot + sep)) return next();
        try { if (!statSync(file).isFile()) return next(); } catch { return next(); }
        const mime = { '.glb': 'model/gltf-binary', '.js': 'text/javascript', '.wasm': 'application/wasm' };
        res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
        if (req.method === 'HEAD') return res.end();
        createReadStream(file).on('error', next).pipe(res);
      });
    },
  }],
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  build: {
    copyPublicDir: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        catalog: resolve(__dirname, 'catalog.html'),
        kit: resolve(__dirname, 'kit.html'),
        compile: resolve(__dirname, 'compile.html'),
      },
    },
  },
});
