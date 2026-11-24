/* Hoggy plates: the generated artwork for every listing (docs/design/redesign.md). Deterministic, no images, no network.
   Terrain = the place (seeded from the city), colour = the specialty, numerals = the date, line style = the evidence:
   solid + stamped country code: dates confirmed with the source stored; solid: confirmed earlier, being re-checked;
   dashed + outlined month: estimated. Courses get a dial (time, not place). Every plate is decorative: callers keep the
   same facts in text beside it. Runs in the browser (window.HoggyArt) and on the server (lib/pages.js). */
(function (root) {
  'use strict';
  const PAL = [ /* name, ground, ink, pop */
    ['flare', '#FF4D1F', '#15130F', '#FFE9DC'], ['lagoon', '#0F4C46', '#F4EFE6', '#FFB59E'], ['night', '#1B1915', '#F4EFE6', '#FF5B2E'],
    ['bone', '#E3D9C4', '#15130F', '#FF4D1F'], ['cobalt', '#2B3FD6', '#F4EFE6', '#FFD166'], ['plum', '#5A1E46', '#F8DCCB', '#FF8A66'],
    ['ochre', '#E3A52F', '#15130F', '#FFF6DF'], ['sky', '#BCD8E6', '#14263A', '#FF4D1F'], ['moss', '#55652A', '#F3F0D9', '#F2C14E'], ['rose', '#F0B4AA', '#3B0F14', '#FFF3EC']];
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const palette = key => PAL[hash(key || 'x') % PAL.length];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SIZES = { tall: [300, 375], wide: [640, 300], square: [300, 300], mini: [144, 144] };
  const R = n => Math.round(n);

  /* one closed, smooth ring around (cx, cy): points on a wobbly circle, joined through their midpoints */
  function ring(cx, cy, rad, w, pts, sx, sy) {
    const P = [];
    for (let i = 0; i < pts; i++) {
      const a = i / pts * Math.PI * 2, r = rad * (1 + w[0] * Math.sin(a + w[1]) + w[2] * Math.sin(2 * a + w[3]) + w[4] * Math.sin(3 * a + w[5]));
      P.push([cx + Math.cos(a) * r * sx, cy + Math.sin(a) * r * sy]);
    }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let m = mid(P[pts - 1], P[0]), d = `M${R(m[0])} ${R(m[1])}`;
    for (let i = 0; i < pts; i++) { const n = mid(P[i], P[(i + 1) % pts]); d += `Q${R(P[i][0])} ${R(P[i][1])} ${R(n[0])} ${R(n[1])}`; }
    return d + 'Z';
  }
  function hill(rand, cx, cy, radius, rings, pts, ink, est, sw) {
    const w = [.1 + rand() * .1, rand() * 6.3, .05 + rand() * .08, rand() * 6.3, .02 + rand() * .05, rand() * 6.3], sx = .85 + rand() * .4, sy = .85 + rand() * .4;
    let out = '';
    for (let k = rings; k >= 1; k--) {
      const rad = radius * Math.pow(k / rings, 1.15);
      const wk = [w[0] * (.55 + .45 * k / rings), w[1] + k * .09, w[2] * (.5 + .5 * k / rings), w[3] - k * .07, w[4], w[5] + k * .05];
      out += `<path d="${ring(cx, cy, rad, wk, pts, sx, sy)}" fill="${ink}" fill-opacity="${est ? '.035' : '.075'}" stroke="${ink}" stroke-opacity="${est ? '.55' : '.4'}" stroke-width="${sw}"${est ? ' stroke-dasharray="2 5" stroke-linecap="round"' : ''}/>`;
    }
    return out;
  }
  const coords = c => typeof c.lat === 'number' && typeof c.lng === 'number' && (c.lat || c.lng) ? `${Math.abs(c.lat).toFixed(2)}°${c.lat < 0 ? 'S' : 'N'} ${Math.abs(c.lng).toFixed(2)}°${c.lng < 0 ? 'W' : 'E'}` : '';
  const open = (W, H, cls, bg) => `<svg class="plate ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="${W}" height="${H}" fill="${bg}"/>`;

  /* a conference (or any event with a city and dates). o: { size: tall | wide | square | mini, ev: confirmed | unchecked | estimated } */
  function plate(c, o) {
    o = o || {};
    const size = SIZES[o.size] ? o.size : 'tall', [W, H] = SIZES[size], mini = size === 'mini', ev = o.ev || (c.datesConfirmed === false ? 'estimated' : 'unchecked'), est = ev === 'estimated';
    const [, bg, ink, pop] = palette(c.specialty || c.name), rand = rng(hash((c.city || c.name || '') + '|' + (c.countryCode || '')));
    const u = Math.min(W, H), cx = W * (.3 + rand() * .5), cy = H * (.16 + rand() * .32);
    let s = open(W, H, size + (est ? ' est' : ''), bg);
    s += hill(rand, cx, cy, u * (mini ? .8 : .78), mini ? 4 : 7, mini ? 10 : 16, ink, est, mini ? 2 : 1);
    if (!mini) s += hill(rand, W * (cx > W / 2 ? .12 + rand() * .2 : .7 + rand() * .2), H * (.62 + rand() * .3), u * .42, 4, 12, ink, est, 1);
    s += `<circle cx="${R(cx)}" cy="${R(cy)}" r="${mini ? 5 : 4}" fill="${pop}"/>`;
    const d = c.start ? new Date(c.start + 'T00:00:00Z') : null, day = d && !isNaN(d) ? d.getUTCDate() : '', mon = d && !isNaN(d) ? MON[d.getUTCMonth()] : '', yr = d && !isNaN(d) ? d.getUTCFullYear() : '';
    if (mini) { if (!est && day) s += `<text class="pn" x="13" y="${H - 16}" font-size="68" fill="${ink}">${day}</text>`; return s + '</svg>'; }
    const pad = size === 'wide' ? 28 : 18, small = size === 'wide' ? 15 : 12.5, big = size === 'wide' ? 170 : size === 'square' ? 128 : 150, co = coords(c);
    if (co) s += `<text class="pt" x="${pad}" y="${pad + small}" font-size="${small}" fill="${ink}">${esc(co)}</text>`;
    if (est) {
      s += `<text class="pt" x="${pad}" y="${H - pad - big * .5}" font-size="${small}" fill="${ink}">usually</text>`;
      s += `<text class="pn" x="${pad - 3}" y="${H - pad}" font-size="${big * .6}" fill="none" stroke="${ink}" stroke-width="1.6">${esc(mon)}</text>`;
      s += `<text class="pt" x="${W - pad}" y="${H - pad}" font-size="${small}" fill="${ink}" text-anchor="end">${esc(yr)} · est.</text>`;
    } else {
      s += `<text class="pn" x="${pad - 4}" y="${H - pad}" font-size="${big}" fill="${ink}">${day}</text>`;
      const tx = pad + (String(day).length > 1 ? big * .93 : big * .52);
      s += `<text class="pm" x="${tx}" y="${H - pad - big * .36}" font-size="${big * .2}" fill="${ink}">${esc(mon)}</text><text class="pt" x="${tx}" y="${H - pad - big * .36 + small * 1.5}" font-size="${small}" fill="${ink}">${esc(yr)}</text>`;
    }
    if (c.countryCode) {
      const x = W - pad - 15, y = pad + 15;
      if (ev === 'confirmed') s += `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="${ink}" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="21" fill="none" stroke="${ink}" stroke-width=".75" stroke-dasharray="1.5 3"/>`;
      s += `<text class="pm" x="${x}" y="${y + 5}" font-size="14" fill="${ink}" text-anchor="middle">${esc(c.countryCode)}</text>`;
    }
    return s + '</svg>';
  }

  /* a course type, or one session of it. label: the short name ("ALS2"); sub: small print (countries, or the session date) */
  function dial(key, label, o) {
    o = o || {};
    const size = SIZES[o.size] ? o.size : 'tall', [W, H] = SIZES[size], mini = size === 'mini';
    const [, bg, ink, pop] = palette('course:' + key), rand = rng(hash('dial|' + key)), u = Math.min(W, H);
    const cx = W * (.62 + rand() * .2), cy = H * (.3 + rand() * .14), n = mini ? 4 : 8, max = u * (mini ? .8 : .86), turn = rand() * 360;
    let s = open(W, H, size + ' pdial', bg);
    for (let k = 1; k <= n; k++) {
      const r = max * k / n, len = Math.PI * 2 * r, gap = len * (.08 + rand() * .3);
      s += `<circle cx="${R(cx)}" cy="${R(cy)}" r="${R(r)}" fill="${ink}" fill-opacity=".06" stroke="${ink}" stroke-opacity=".5" stroke-width="${mini ? 2 : 1}" stroke-dasharray="${R(len - gap)} ${R(gap)}" transform="rotate(${Math.round(turn + k * 47 + rand() * 60)} ${R(cx)} ${R(cy)})"/>`;
    }
    if (!mini) { const r = max * (n + .45) / n; s += `<circle cx="${R(cx)}" cy="${R(cy)}" r="${R(r)}" fill="none" stroke="${ink}" stroke-opacity=".6" stroke-width="7" stroke-dasharray="1 ${R(Math.PI * 2 * r / 60 - 1)}"/>`; }
    s += `<circle cx="${R(cx)}" cy="${R(cy)}" r="${mini ? 5 : 4}" fill="${pop}"/><path d="M${R(cx)} ${R(cy)}L${R(cx + Math.cos(turn) * max * .5)} ${R(cy + Math.sin(turn) * max * .5)}" stroke="${pop}" stroke-width="${mini ? 3 : 2}" stroke-linecap="round"/>`;
    const t = String(label || '');
    if (mini) return s + `<text class="pn" x="12" y="${H - 16}" font-size="${t.length > 4 ? 32 : t.length > 3 ? 44 : 56}" fill="${ink}">${esc(t.slice(0, 6))}</text></svg>`;
    const pad = size === 'wide' ? 28 : 18, small = size === 'wide' ? 15 : 12.5, avail = W - pad * 2, fs = Math.min(size === 'wide' ? 150 : 120, avail / Math.max(2, t.length) * 1.95);
    if (o.sub) s += `<text class="pt" x="${pad}" y="${pad + small}" font-size="${small}" fill="${ink}">${esc(o.sub)}</text>`;
    return s + `<text class="pn" x="${pad - 2}" y="${H - pad}" font-size="${R(fs)}" fill="${ink}" textLength="${t.length > 9 ? avail : ''}" lengthAdjust="spacingAndGlyphs">${esc(t)}</text></svg>`.replace(' textLength=""', '').replace(t.length > 9 ? '' : ' lengthAdjust="spacingAndGlyphs"', '');
  }

  /* the mark: a hedgehog as a dome with five quills (also a sun on a horizon). One colour: currentColor. */
  const MARK = '<path d="M3.5 23.5h25M7 23.5a9 9 0 0 1 18 0" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 4.5v5M7.2 8.4l2.9 4M24.8 8.4l-2.9 4M2.6 15.6l4.6 1.8M29.4 15.6l-4.6 1.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="20.4" cy="19.6" r="1.5" fill="currentColor"/>';
  const mark = cls => `<svg class="${cls || 'mark'}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${MARK}</svg>`;

  const api = { plate, dial, mark, palette, MARK, PAL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HoggyArt = api;
})(typeof window !== 'undefined' ? window : globalThis);
