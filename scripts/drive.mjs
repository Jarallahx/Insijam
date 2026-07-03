/* Playwright smoke driver: navigates the game, takes screenshots.
   Usage: node scripts/drive.mjs <script>
   where <script> is a ;-separated list of steps:
     wait:<ms> | shot:<name> | click:<x>,<y> | drag:<x1>,<y1>,<x2>,<y2>
     text:<selector-text-click> | eval:<js> | errors
   Coordinates are in CSS pixels on a 1280x800 viewport. */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const steps = (process.argv[2] ?? 'wait:2500;shot:menu;errors').split(';');
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

const url = process.argv[3] ?? 'http://localhost:5183';
await page.goto(url, { waitUntil: 'networkidle' });

for (const step of steps) {
  const [cmd, ...rest] = step.split(':');
  const arg = rest.join(':');
  if (cmd === 'wait') {
    await page.waitForTimeout(Number(arg));
  } else if (cmd === 'shot') {
    await page.screenshot({ path: `shots/${arg}.png` });
    console.log(`shot: shots/${arg}.png`);
  } else if (cmd === 'click') {
    const [x, y] = arg.split(',').map(Number);
    await page.mouse.click(x, y);
  } else if (cmd === 'drag') {
    const [x1, y1, x2, y2] = arg.split(',').map(Number);
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(x1 + ((x2 - x1) * i) / 12, y1 + ((y2 - y1) * i) / 12);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
  } else if (cmd === 'text') {
    await page.getByText(arg, { exact: false }).first().click();
  } else if (cmd === 'eval') {
    const r = await page.evaluate(arg);
    console.log('eval:', JSON.stringify(r));
  } else if (cmd === 'errors') {
    console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
  }
}

await browser.close();
