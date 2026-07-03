/* Launches the packaged-layout Electron app (dist/ + electron/main.cjs),
   waits for the menu, screenshots the real window, checks for errors. */

import { _electron as electron } from 'playwright';

const app = await electron.launch({ args: ['.'] });
const win = await app.firstWindow();
const errors = [];
win.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
win.on('pageerror', (e) => errors.push(String(e)));

await win.waitForTimeout(3500);
await win.screenshot({ path: 'shots/50-electron-menu.png' });
console.log('title:', await win.title());
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
await app.close();
