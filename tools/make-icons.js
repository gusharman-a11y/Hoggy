'use strict';
/* Draws Hoggy's app icons and share image (icons/*.png) from icons/icon.svg and an HTML card in the house style
   (docs/design/redesign.md: paper, ink, the flare mark, plates from lib/art.js), in Chromium.
   Run after changing the logo:  NODE_PATH=/opt/node-tools/node_modules node tools/make-icons.js
   The PNGs are committed; the server only serves them. */
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const DIR = path.join(__dirname, '..', 'icons');
const svg = fs.readFileSync(path.join(DIR, 'icon.svg'), 'utf8');
const ROOT = path.join(__dirname, '..'), ART = require('../lib/art.js'), HS = require('../stats.js');
const font = f => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64');
const logo = (size, pad) => `<!doctype html><html><body style="margin:0;background:${pad ? '#FF4D1F' : 'transparent'}"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">
  <div style="width:${size - 2 * pad}px;height:${size - 2 * pad}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`;
/* the share image: the wordmark, the line from Home and three plates drawn from real upcoming listings (lib/art.js) */
global.window = {}; require('../data/conferences.js');
const day = new Date().toISOString().slice(0, 10), picks = HS.exampleConfs(global.window.HOGGY_CONFERENCES, day, 3);
const og = `<!doctype html><html><head><style>@font-face{font-family:BG;src:url(${font('plex-sans-condensed-700.woff2')});font-weight:100 900}@font-face{font-family:IS;src:url(${font('plex-sans-400.woff2')});font-weight:100 500}@font-face{font-family:IS;src:url(${font('plex-sans-600.woff2')});font-weight:501 900}
  .pn{font-family:BG;font-weight:800}.pm{font-family:BG;font-weight:800;text-transform:uppercase}.pt{font-family:IS;font-weight:600}
  .p{position:absolute;width:250px;height:312px;border-radius:6px;overflow:hidden;box-shadow:0 30px 60px -20px rgba(21,19,15,.45)}.p svg{width:100%;height:100%;display:block}</style></head>
  <body style="margin:0"><div style="position:relative;width:1200px;height:630px;box-sizing:border-box;padding:64px 72px;font-family:IS,sans-serif;color:#15130F;background:#F4EFE6;overflow:hidden">
  <div style="display:flex;align-items:center;gap:14px;color:#FF4D1F">${ART.mark().replace('<svg ', '<svg width="56" height="56" ')}<span style="font-family:BG;font-weight:700;font-size:48px;letter-spacing:-.03em;color:#15130F;line-height:1">hoggy</span></div>
  <div style="font-family:BG;font-weight:700;font-size:86px;line-height:.92;letter-spacing:-.03em;margin-top:36px;max-width:600px">Find the conference. <span style="color:#B8300A">Hoggy helps with the admin.</span></div>
  <div style="position:absolute;left:72px;bottom:56px;font-size:26px;font-weight:400;color:#5A5347">Medical conferences and courses · trips · claim-ready receipts · CPD</div>
  ${picks.map((c, i) => `<div class="p" style="${['right:250px;top:90px;rotate:-12deg', 'right:120px;top:150px;rotate:-2deg;z-index:2', 'right:10px;top:230px;rotate:9deg'][i]}">${ART.plate(c, { ev: HS.dateEvidence(c) })}</div>`).join('')}
  </div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const shot = async (html, w, h, file, transparent) => { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.evaluate(async () => { await Promise.all([...document.fonts].map(f => f.load().catch(() => null))); }); await p.waitForTimeout(200); await p.screenshot({ path: path.join(DIR, file), omitBackground: !!transparent }); await p.close(); };
  await shot(logo(192, 0), 192, 192, 'icon-192.png', true);
  await shot(logo(512, 0), 512, 512, 'icon-512.png', true);
  await shot(logo(512, 72), 512, 512, 'icon-maskable-512.png'); /* safe zone: the logo inside the central 80% */
  await shot(logo(180, 0), 180, 180, 'apple-touch-icon.png');
  await shot(og, 1200, 630, 'og.png');
  await b.close();
  console.log('icons written to', DIR);
})();
