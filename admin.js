'use strict';
/* Data desk: approve discovered conference candidates, trigger ingest, see runs. Admin-only (HOGGY_ADMINS). */
(function () {
  const $ = s => document.querySelector(s), root = $('#root');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (p, o = {}) => { const r = await fetch(p, { method: o.method || 'GET', headers: { 'X-Requested-With': 'hoggy', ...(sessionStorage.getItem('hoggyAdminKey') ? { 'X-Admin-Key': sessionStorage.getItem('hoggyAdminKey') } : {}), ...(o.body ? { 'Content-Type': 'application/json' } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined, credentials: 'same-origin' }); let j = null; try { j = await r.json(); } catch (e) { } return { status: r.status, ...(j || {}), data: j }; };
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  async function draw() {
    const me = await api('/api/me');
    if (!me.user) { root.innerHTML = '<h1>Data desk</h1><p>Sign in to Hoggy first (<a href="/" style="text-decoration:underline">home</a>), then come back.</p>'; return; }
    const [cand, runs, chg, rep] = await Promise.all([api('/api/admin/candidates'), api('/api/admin/runs'), api('/api/admin/changes'), api('/api/admin/reported')]);
    if (cand.status === 403 && /key/i.test(cand.error || '')) { const k = prompt('Admin key'); if (k) { sessionStorage.setItem('hoggyAdminKey', k); return draw(); } }
    if (cand.status === 403) { root.innerHTML = '<h1>Data desk</h1><p>Your account is not an admin. Set HOGGY_ADMINS to your email and restart the server.</p>'; return; }
    const list = cand.data || [], rs = runs.data || [], changes = chg.data || [], reported = rep.data || [];
    root.innerHTML = `<div class="page-head"><div><h1>Data desk</h1><p>Review what the updater found. Nothing external is published until you approve it.</p></div><button class="btn primary" id="run">Run updater now</button></div>
    <div class="panel"><h3>Last runs</h3>${rs.length ? rs.map(r => `<div class="li"><div class="grow"><div class="t">${new Date(r.started).toLocaleString()}</div><div class="s">Refresh: ${esc(JSON.stringify(r.summary.refresh))} · Discover: ${esc(JSON.stringify(r.summary.discover))}</div>${(r.summary.changes || []).slice(0, 6).map(x => `<div class="s">${esc(x)}</div>`).join('')}</div></div>`).join('') : '<p class="note">No runs yet. Start the server with HOGGY_INGEST=1 or press Run.</p>'}</div>
    <div class="panel"><h3>${reported.length} reported review${reported.length === 1 ? '' : 's'}</h3>${reported.map(r => `<div class="li" data-rv="${r.id}"><div class="grow"><div class="t">${esc(r.author)} · ${esc(r.confId)} · ${r.reports} report${r.reports > 1 ? 's' : ''} ${r.reports >= 3 ? '(hidden)' : ''}</div><div class="s">${esc(r.text)}</div></div><button class="btn sm" data-ra="restore">Restore</button><button class="btn sm danger" data-ra="delete">Delete</button></div>`).join('') || '<p class="note">None.</p>'}</div>
    <div class="panel"><h3>${changes.length} date change${changes.length === 1 ? '' : 's'} proposed by the updater</h3>${changes.map(c => `<div class="li" data-chg="${c.id}"><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">Now ${esc(c.current.start)}..${esc(c.current.end)} (${esc(c.current.city)}) → organiser page says ${esc(c.proposed.start)}..${esc(c.proposed.end)}${c.proposed.city ? ' in ' + esc(c.proposed.city) : ''} · <a target="_blank" rel="noopener noreferrer" style="text-decoration:underline" href="${esc(c.proposed.evidenceUrl || '#')}">evidence</a></div></div><button class="btn sm primary" data-ca="approve">Apply</button><button class="btn sm danger" data-ca="reject">Ignore</button></div>`).join('') || '<p class="note">None waiting.</p>'}</div>
    <div class="panel"><h3>${list.length} candidate${list.length === 1 ? '' : 's'} to review</h3>${list.map(c => `<form class="cand" data-id="${esc(c.id)}" style="border-top:1px solid var(--line);padding:14px 0"><div class="note">Source ${esc(c.source)} · <a style="text-decoration:underline" target="_blank" rel="noopener noreferrer" href="${esc(c.json.url || c.json.sourceUrl)}">open</a></div>
      <div class="two"><div class="field"><label>Name</label><input name="name" value="${esc(c.json.name)}"></div><div class="field"><label>Organiser</label><input name="organiser"></div></div>
      <div class="two"><div class="field"><label>Specialty</label><input name="specialty" value="${esc(c.json.specialty)}"></div><div class="field"><label>Region</label><input name="region" value="${esc(c.json.region)}" placeholder="Europe / North America / Asia-Pacific / Middle East / Africa / Latin America"></div></div>
      <div class="two"><div class="field"><label>City</label><input name="city" value="${esc(c.json.location)}"></div><div class="field"><label>Country · ISO2</label><input name="country" placeholder="Country"><input name="countryCode" maxlength="2" placeholder="AU" style="margin-top:6px"></div></div>
      <div class="two"><div class="field"><label>Start</label><input name="start" type="date" value="${esc(c.json.start)}"></div><div class="field"><label>End</label><input name="end" type="date" value="${esc(c.json.end)}"></div></div>
      <div class="two"><div class="field"><label>Organiser URL (https)</label><input name="url" value="${esc(c.json.url)}"></div><div class="field"><label>CPD hours · accreditation body</label><input name="cpdHours" type="number" step="0.5" value="0"><input name="cpdBody" style="margin-top:6px"></div></div>
      <div class="field"><label>One-line description</label><input name="blurb"></div>
      <div class="row"><label class="row" style="gap:6px"><input type="checkbox" name="datesConfirmed"> dates confirmed on organiser site</label><button class="btn sm primary" data-a="approve">Approve</button><button type="button" class="btn sm danger" data-a="reject">Reject</button><span class="note err"></span></div></form>`).join('') || '<p class="note">Nothing pending.</p>'}</div>`;
    root.querySelectorAll('[data-rv]').forEach(el => el.addEventListener('click', async e => { const a = e.target.dataset.ra; if (!a) return; const r = await api('/api/admin/reviews/' + el.dataset.rv, { method: 'POST', body: { action: a } }); if (r.error) alert(r.error); else el.remove(); }));
    root.querySelectorAll('[data-chg]').forEach(el => el.addEventListener('click', async e => { const a = e.target.dataset.ca; if (!a) return; const r = await api('/api/admin/changes/' + el.dataset.chg, { method: 'POST', body: { action: a } }); if (r.error) alert(r.error); else el.remove(); }));
    $('#run').onclick = async () => { $('#run').disabled = true; await api('/api/admin/ingest', { method: 'POST' }); setTimeout(draw, 4000); };
    root.querySelectorAll('form.cand').forEach(f => f.addEventListener('click', async e => {
      const a = e.target.dataset.a; if (!a) return; e.preventDefault();
      const fd = Object.fromEntries(new FormData(f)), id = f.dataset.id;
      const conference = a === 'approve' ? { id: slug(fd.name + '-' + (fd.start || '').slice(0, 4)), name: fd.name, organiser: fd.organiser, specialty: fd.specialty, city: fd.city, country: fd.country, countryCode: String(fd.countryCode || '').toUpperCase(), region: fd.region, start: fd.start, end: fd.end || fd.start, format: 'In-person', cpdHours: +fd.cpdHours || 0, cpdBody: fd.cpdBody || '', url: fd.url, blurb: fd.blurb, datesConfirmed: !!fd.datesConfirmed, priceFrom: 0, attendees: 0 } : null;
      const r = await api('/api/admin/candidates/' + id, { method: 'POST', body: { action: a, conference } });
      if (r.error) f.querySelector('.err').textContent = r.error; else f.remove();
    }));
  }
  draw();
})();
