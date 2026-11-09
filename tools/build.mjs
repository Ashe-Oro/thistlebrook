// Bundles src/ -> dist/. Licensed character engine is aliased from licensed/ (gitignored).
import * as esbuild from 'esbuild'; import fs from 'node:fs';
const watch = process.argv.includes('--watch'); const entry = process.argv.find(a => a.endsWith('.ts')) || 'src/main.ts';
fs.mkdirSync('dist', { recursive: true });
for (const f of fs.readdirSync('public')) fs.cpSync(`public/${f}`, `dist/${f}`, { recursive: true });
const ctx = await esbuild.context({
  entryPoints: { app: entry }, bundle: true, format: 'esm', target: 'es2022', outdir: 'dist', sourcemap: true, minify: !watch && !process.argv.includes('--dev'),
  loader: { '.json': 'json' }, alias: { '@char': './licensed/char/src' }, logLevel: 'info',
});
if (watch) await ctx.watch(); else { await ctx.rebuild(); await ctx.dispose(); }
