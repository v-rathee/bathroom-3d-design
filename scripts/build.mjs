import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { planSvg } from '../src/layout.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
await mkdir(output, { recursive: true });
const result = await build({
  entryPoints: [path.join(root, 'src', 'app.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: true,
  legalComments: 'inline',
  write: false,
});
const js = result.outputFiles[0].text;
const [template, css, threeLicense] = await Promise.all([
  readFile(path.join(root, 'index.html'), 'utf8'),
  readFile(path.join(root, 'styles.css'), 'utf8'),
  readFile(path.join(root, 'node_modules', 'three', 'LICENSE'), 'utf8'),
]);
const standalone = template
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>${css}</style>`)
  .replace('<script src="dist/viewer.js" defer></script>', () =>
    `<script type="text/plain" id="third-party-license">Three.js license:\n${threeLicense}</script>\n<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
await Promise.all([
  writeFile(path.join(output, 'viewer.js'), js),
  writeFile(path.join(root, 'Bathroom-3D.html'), standalone),
  writeFile(path.join(root, 'Bathroom-dimensioned-plan.svg'), planSvg()),
  writeFile(path.join(root, 'THIRD-PARTY-NOTICES.txt'), `Three.js\n\n${threeLicense}`),
]);
console.log(`Built offline viewer: ${path.join(root, 'Bathroom-3D.html')}`);
console.log(`Standalone size: ${(Buffer.byteLength(standalone) / 1024).toFixed(0)} KiB. No CDN, server, or external assets required.`);
