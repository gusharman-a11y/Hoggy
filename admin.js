'use strict';
/* Data desk: check proof of attendance, moderate reported reviews, approve discovered conference candidates, trigger ingest, see runs.
   Admin-only: the account must be in HOGGY_ADMINS and every call carries HOGGY_ADMIN_KEY. */
(function () {
  const $ = s => document.querySelector(s), root = $('#root');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (p, o = {}) => { const r = await fetch(p, { method: o.method || 'GET', headers: { 'X-Requested-With': 'hoggy', ...(sessionStorage.getItem('hoggyAdminKey') ? { 'X-Admin-Key': sessionStorage.getItem('hoggyAdminKey') } : {}), ...(o.body ? { 'Content-Type': 'application/json' } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined, credentials: 'same-origin' }); let j = null; try { j = await r.json(); } catch (e) { } return { status: r.status, ...(j || {}), data: j }; };
  const httpsOnly = u => { try { const x = new URL(String(u || '')); return x.protocol === 'https:' ? x.href : '#'; } catch (e) { return '#'; } };
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  async function draw() {
    const me = await api('/api/me');
    if (!me.user) { root.innerHTML = '<h1>Data desk</h1><p>Sign in to Hoggy first (<a href="/" style="text-decoration:underline">home</a>), then come back.</p>'; return; }
    if (!me.user.admin) { root.innerHTML = '<h1>Data desk</h1><p>Your account is not an admin. Set HOGGY_ADMINS to your email and restart the server.</p>'; return; }
    if (!sessionStorage.getItem('hoggyAdminKey')) { const k = prompt('Admin key (HOGGY_ADMIN_KEY)'); if (!k) { root.innerHTML = '<h1>Data desk</h1><p>The admin key is needed for every admin action. Reload to enter it.</p>'; return; } sessionStorage.setItem('hoggyAdminKey', k); }
    const [cand, runs, chg, rep, pf] = await Promise.all([api('/api/admin/candidates'), api('/api/admin/runs'), api('/api/admin/changes'), api('/api/admin/reported'), api('/api/admin/proofs')]);
    if (cand.status === 403 && /key/i.test(cand.error || '')) { sessionStorage.removeItem('hoggyAdminKey'); const k = prompt('That admin key was not accepted. Admin key (HOGGY_ADMIN_KEY)'); if (k) { sessionStorage.setItem('hoggyAdminKey', k); return draw(); } }
    if (cand.status === 403) { root.innerHTML = '<h1>Data desk</h1><p>Your account is not an admin. Set HOGGY_ADMINS to your email and restart the server.</p>'; return; }
    const list = cand.data || [], rs = runs.data || [], changes = chg.data || [], reported = rep.data || [], proofs = Array.isArray(pf.data) ? pf.data : [];
    root.innerHTML = `<div class="page-head"><div><h1>Data desk</h1><p>Review what the updater found. Nothing external is published until you approve it.</p></div><button class="btn primary" id="run">Run updater now</button></div>
    <div class="panel" id="proofs"><h3>${proofs.length} proof${proofs.length === 1 ? '' : 's'} of attendance to check</h3><p class="note" style="margin:-6px 0 8px">Approve only if the name and the year match the review. The file is deleted after you decide.</p>${proofs.map(p => `<div class="li pf" data-pf="${esc(p.id)}" style="flex-wrap:wrap;align-items:flex-start"><div class="grow"><div class="t">${esc(p.author)} · ${esc(p.email)}</div><div class="s">${esc(p.title)} · Attended ${esc(p.editionYear)}${p.city ? ' · ' + esc(p.city) : ''}</div><div class="s">${esc(p.kindLabel)} · ${esc(p.name)} · ${Math.max(1, Math.round(p.size / 1024))} KB · sent ${esc(new Date(p.created).toLocaleString('en-AU'))}</div><div class="s" style="margin-top:4px">“${esc(p.text)}”</div><div class="pv" style="margin-top:8px"></div></div><div class="row"><button class="btn sm" data-pa="view">View file</button><button class="btn sm primary" data-pa="approve">Approve</button><button class="btn sm danger" data-pa="reject">Reject</button></div></div>`).join('') || '<p class="note">Nothing waiting.</p>'}</div>
    <div class="panel"><h3>Last runs</h3>${rs.length ? rs.map(r => `<div class="li"><div class="grow"><div class="t">${new Date(r.started).toLocaleString()}</div><div class="s">Refresh: ${esc(JSON.stringify(r.summary.refresh))} · Discover: ${esc(JSON.stringify(r.summary.discover))}</div>${(r.summary.changes || []).slice(0, 6).map(x => `<div class="s">${esc(x)}</div>`).join('')}</div></div>`).join('') : '<p class="note">No runs yet. Start the server with HOGGY_INGEST=1 or press Run.</p>'}</div>
    <div class="panel"><h3>${reported.length} reported review${reported.length === 1 ? '' : 's'}</h3>${reported.map(r => `<div class="li" data-rv="${r.id}"><div class="grow"><div class="t">${esc(r.author)} · ${esc(r.title)} · Attended ${esc(r.editionYear)} · ${r.reports} report${r.reports > 1 ? 's' : ''} ${r.reports >= 3 ? '(hidden)' : ''}</div><div class="s">${esc(r.text)}</div></div><button class="btn sm" data-ra="restore">Restore</button><button class="btn sm danger" data-ra="delete">Delete</button></div>`).join('') || '<p class="note">None.</p>'}</div>
    <div class="panel"><h3>${changes.length} date change${changes.length === 1 ? '' : 's'} proposed by the updater</h3>${changes.map(c => `<div class="li" data-chg="${c.id}"><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">Now ${esc(c.current.start)}..${esc(c.current.end)} (${esc(c.current.city)}) → organiser page says ${esc(c.proposed.start)}..${esc(c.proposed.end)}${c.proposed.city ? ' in ' + esc(c.proposed.city) : ''} · <a target="_blank" rel="noopener noreferrer" style="text-decoration:underline" href="${esc(httpsOnly(c.proposed.evidenceUrl))}">evidence</a></div></div><button class="btn sm primary" data-ca="approve">Apply</button><button class="btn sm danger" data-ca="reject">Ignore</button></div>`).join('') || '<p class="note">None waiting.</p>'}</div>
    <div class="panel"><h3>${list.length} candidate${list.length === 1 ? '' : 's'} to review</h3>${list.map(c => `<form class="cand" data-id="${esc(c.id)}" style="border-top:1px solid var(--line);padding:14px 0"><div class="note">Source ${esc(c.source)} · <a style="text-decoration:underline" target="_blank" rel="noopener noreferrer" href="${esc(httpsOnly(c.json.url || c.json.sourceUrl))}">open</a></div>
      <div class="two"><div class="field"><label>Name</label><input name="name" value="${esc(c.json.name)}"></div><div class="field"><label>Organiser</label><input name="organiser"></div></div>
      <div class="two"><div class="field"><label>Specialty</label><input name="specialty" value="${esc(c.json.specialty)}"></div><div class="field"><label>Region</label><input name="region" value="${esc(c.json.region)}" placeholder="Europe / North America / Asia-Pacific / Middle East / Africa / Latin America"></div></div>
      <div class="two"><div class="field"><label>City</label><input name="city" value="${esc(c.json.location)}"></div><div class="field"><label>Country · ISO2</label><input name="country" placeholder="Country"><input name="countryCode" maxlength="2" placeholder="AU" style="margin-top:6px"></div></div>
      <div class="two"><div class="field"><label>Start</label><input name="start" type="date" value="${esc(c.json.start)}"></div><div class="field"><label>End</label><input name="end" type="date" value="${esc(c.json.end)}"></div></div>
      <div class="two"><div class="field"><label>Organiser URL (https)</label><input name="url" value="${esc(c.json.url)}"></div><div class="field"><label>CPD hours · accreditation body</label><input name="cpdHours" type="number" step="0.5" value="0"><input name="cpdBody" style="margin-top:6px"></div></div>
      <div class="field"><label>One-line description</label><input name="blurb"></div>
      <div class="row"><label class="row" style="gap:6px"><input type="checkbox" name="datesConfirmed"> dates confirmed on organiser site</label><button class="btn sm primary" data-a="approve">Approve</button><button type="button" class="btn sm danger" data-a="reject">Reject</button><span class="note err"></span></div></form>`).join('') || '<p class="note">Nothing pending.</p>'}</div>`;
    root.querySelectorAll('[data-rv]').forEach(el => el.addEventListener('click', async e => { const a = e.target.dataset.ra; if (!a) return; const r = await api('/api/admin/reviews/' + el.dataset.rv, { method: 'POST', body: { action: a } }); if (r.error) alert(r.error); else el.remove(); }));
    root.querySelectorAll('[data-pf]').forEach(el => el.addEventListener('click', async e => {
      const a = e.target.dataset.pa; if (!a) return; const id = el.dataset.pf;
      if (a === 'view') { /* fetched with the admin key; never a public URL */
        const r = await fetch('/api/admin/proofs/' + id + '/file', { headers: { 'X-Requested-With': 'hoggy', 'X-Admin-Key': sessionStorage.getItem('hoggyAdminKey') || '' }, credentials: 'same-origin' });
        if (!r.ok) return alert('Could not open the file (' + r.status + ')');
        const b = await r.blob(), u = URL.createObjectURL(b), pv = el.querySelector('.pv');
        if (/^image\//.test(b.type)) { pv.innerHTML = ''; const img = new Image(); img.alt = 'Proof of attendance'; img.style.cssText = 'max-width:100%;max-height:420px;border-radius:10px;border:1px solid var(--line)'; img.src = u; pv.appendChild(img); }
        else { const l = document.createElement('a'); l.href = u; l.download = 'proof-' + id + '.pdf'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000); }
        return;
      }
      const note = a === 'reject' ? prompt('Reason (optional, kept with the decision)') : '';
      if (note === null) return;
      const r = await api('/api/admin/proofs/' + id, { method: 'POST', body: { action: a, note } }); if (r.error) return alert(r.error);
      el.remove(); const h = $('#proofs h3'), n = root.querySelectorAll('[data-pf]').length; h.textContent = n + ' proof' + (n === 1 ? '' : 's') + ' of attendance to check';
    }));
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
