'use strict';
/* Draws Hoggy's app icons and share image (icons/*.png) from icons/icon.svg and an HTML card in the house style, in Chromium.
   Run after changing the logo:  NODE_PATH=/opt/node-tools/node_modules node tools/make-icons.js
   The PNGs are committed; the server only serves them. */
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const DIR = path.join(__dirname, '..', 'icons');
const svg = fs.readFileSync(path.join(DIR, 'icon.svg'), 'utf8');
const logo = (size, pad) => `<!doctype html><html><body style="margin:0;background:${pad ? '#0b0d0e' : 'transparent'}"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">
  <div style="width:${size - 2 * pad}px;height:${size - 2 * pad}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`;
const og = `<!doctype html><html><body style="margin:0"><div style="width:1200px;height:630px;box-sizing:border-box;padding:72px 80px;font-family:Inter,sans-serif;color:#f4f6f5;
  background:radial-gradient(900px 420px at 88% -10%,rgba(37,224,160,.34),transparent 62%),linear-gradient(135deg,#102a24,#0b0d0e 70%);display:flex;flex-direction:column;justify-content:space-between">
  <div style="display:flex;align-items:center;gap:22px"><div style="width:84px;height:84px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div><span style="font-weight:800;font-size:56px;letter-spacing:-.04em">Hoggy</span></div>
  <div><div style="font-weight:800;font-size:76px;line-height:1.04;letter-spacing:-.035em;max-width:16ch">Find the conference. Hoggy helps with the admin.</div>
  <div style="margin-top:26px;font-size:30px;color:#b7c2bf;letter-spacing:-.01em">Medical conferences and courses · trips · claim-ready receipts · CPD</div></div></div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const shot = async (html, w, h, file, transparent) => { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.setContent(html); await p.waitForTimeout(150); await p.screenshot({ path: path.join(DIR, file), omitBackground: !!transparent }); await p.close(); };
  await shot(logo(192, 0), 192, 192, 'icon-192.png', true);
  await shot(logo(512, 0), 512, 512, 'icon-512.png', true);
  await shot(logo(512, 72), 512, 512, 'icon-maskable-512.png'); /* safe zone: the logo inside the central 80% */
  await shot(logo(180, 0), 180, 180, 'apple-touch-icon.png');
  await shot(og, 1200, 630, 'og.png');
  await b.close();
  console.log('icons written to', DIR);
})();
