import { _electron as electron } from 'playwright';
const app = await electron.launch({ executablePath: 'release/win-unpacked/Insijam.exe' });
const win = await app.firstWindow();
await win.waitForTimeout(3500);
await win.screenshot({ path: 'shots/51-packaged-app.png' });
console.log('packaged title:', await win.title());
await app.close();
