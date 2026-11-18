import { chromium } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const results = path.join(root, '.handover-qa');
await mkdir(results, { recursive: true });
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'msedge' : undefined,
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1700, height: 1250 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(pathToFileURL(path.join(root, 'Plumber-Concept.html')).href);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  const audit = await page.evaluate(() => {
    const issues = [];
    const sheets = [...document.querySelectorAll('.sheet')];
    for (const sheet of sheets) {
      const bounds = sheet.getBoundingClientRect();
      const footer = sheet.querySelector('.sheet-footer').getBoundingClientRect();
      for (const column of sheet.querySelectorAll('.column')) {
        const last = column.lastElementChild.getBoundingClientRect();
        if (last.bottom > footer.top - 2) issues.push(`${sheet.id}: content overlaps footer`);
        if (last.right > bounds.right || last.left < bounds.left) issues.push(`${sheet.id}: column outside page`);
      }
      if (sheet.scrollHeight > sheet.clientHeight + 1) issues.push(`${sheet.id}: page overflows`);
    }
    for (const svg of document.querySelectorAll('svg')) {
      const source = new XMLSerializer().serializeToString(svg);
      if (new DOMParser().parseFromString(source, 'image/svg+xml').querySelector('parsererror')) issues.push('Invalid drawing SVG');
      const bounds = svg.getBoundingClientRect();
      for (const text of svg.querySelectorAll('text')) {
        const box = text.getBoundingClientRect();
        if (box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1) {
          issues.push(`Drawing text outside SVG: ${text.textContent}`);
        }
      }
    }
    const plan = document.querySelector('.plan-drawing').getBoundingClientRect();
    return {
      sheets: sheets.length, issues,
      planWidthMm: plan.width / (96 / 25.4),
      planHeightMm: plan.height / (96 / 25.4),
      includesLocalPaths: document.body.innerText.includes('C:\\') || document.body.innerText.includes('file:///'),
    };
  });
  assert.equal(audit.sheets, 4, 'Handover must have four sheets.');
  assert.deepEqual(errors, [], 'Handover emitted browser errors.');
  assert.deepEqual(audit.issues, [], 'Handover drawing or page content is clipped.');
  assert.ok(Math.abs(audit.planWidthMm - 187.96) < 0.1);
  assert.ok(Math.abs(audit.planHeightMm - 160.02) < 0.1);
  assert.equal(audit.includesLocalPaths, false);
  for (const id of ['p01', 'p02', 'p03', 'p04']) {
    await page.locator(`#${id}`).screenshot({ path: path.join(results, `Plumber-${id}.png`) });
  }
  const pdfPath = path.join(root, 'Plumber-Concept.pdf');
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  const pdf = await PDFDocument.load(await readFile(pdfPath));
  assert.equal(pdf.getPageCount(), 4, 'PDF must contain exactly four pages.');
  for (const sheet of pdf.getPages()) {
    const size = sheet.getSize();
    assert.ok(Math.abs(size.width - 420 * 72 / 25.4) < 1, 'PDF page must be A3 landscape.');
    assert.ok(Math.abs(size.height - 297 * 72 / 25.4) < 1, 'PDF page must be A3 landscape.');
  }
  await writeFile(path.join(results, 'plumber-print-verification.json'), JSON.stringify({
    ...audit, pageCount: pdf.getPageCount(), pageSizesPoints: pdf.getPages().map(sheet => sheet.getSize()), browserErrors: errors,
  }, null, 2));
  console.log(`Created ${pdfPath}`);
  console.log('Verified: four A3 landscape pages; no clipped page/drawing content; 1:20 plan dimensions; no local paths in document text.');
} finally {
  await browser.close();
}
