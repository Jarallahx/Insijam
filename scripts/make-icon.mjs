/* Renders the app icon (the game's mandala over a dusk gradient) at every
   Windows icon size via headless Chromium, then packs the PNGs into
   build/icon.ico (ICO supports embedded PNG entries). */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const SIZES = [256, 128, 64, 48, 32, 16];
mkdirSync('build', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

const pngs = [];
for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>*{margin:0;padding:0;background:transparent}</style><canvas id="c" width="${size}" height="${size}"></canvas>`
  );
  await page.evaluate((S) => {
    const ctx = document.getElementById('c').getContext('2d');
    const r = S * 0.22; // corner radius
    // rounded-square clip
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(S, 0, S, S, r);
    ctx.arcTo(S, S, 0, S, r);
    ctx.arcTo(0, S, 0, 0, r);
    ctx.arcTo(0, 0, S, 0, r);
    ctx.closePath();
    ctx.clip();
    // dusk-to-night gradient
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#2b3059');
    g.addColorStop(0.55, '#6d597a');
    g.addColorStop(1, '#b56576');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    // soft center glow
    const halo = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5);
    halo.addColorStop(0, 'rgba(255,227,204,0.5)');
    halo.addColorStop(1, 'rgba(255,227,204,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, S, S);

    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.3;
    // the ring
    ctx.strokeStyle = 'rgba(255,250,240,0.95)';
    ctx.lineWidth = Math.max(1, S * 0.038);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    if (S >= 48) {
      // petals around the ring
      ctx.fillStyle = '#eaac8b';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, S * 0.075, S * 0.034, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // a few stars
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const [sx, sy, sr] of [
        [0.18, 0.2, 0.012],
        [0.82, 0.16, 0.016],
        [0.72, 0.82, 0.012],
        [0.15, 0.74, 0.014],
      ]) {
        ctx.beginPath();
        ctx.arc(S * sx, S * sy, Math.max(0.7, S * sr), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // the bright core
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.12);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(1, 'rgba(255,236,214,0.25)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }, size);
  const buf = await page.screenshot({ omitBackground: true });
  pngs.push({ size, buf });
  console.log(`rendered ${size}x${size} (${buf.length} bytes)`);
}
await browser.close();

// ---- pack ICO (PNG entries) ----
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = [];
for (const { size, buf } of pngs) {
  const e = Buffer.alloc(16);
  e.writeUInt8(size === 256 ? 0 : size, 0);
  e.writeUInt8(size === 256 ? 0 : size, 1);
  e.writeUInt8(0, 2); // palette
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // planes
  e.writeUInt16LE(32, 6); // bpp
  e.writeUInt32LE(buf.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += buf.length;
  entries.push(e);
}
writeFileSync('build/icon.ico', Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]));
console.log('wrote build/icon.ico');

// also a 256 png for other uses
writeFileSync('build/icon.png', pngs[0].buf);
console.log('wrote build/icon.png');
