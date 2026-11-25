'use strict';
/* Data desk: check organiser listings ("List your event") and listing problem reports, check emailed registration receipts and proof of attendance, approve "Covered in" links, moderate reported reviews, approve discovered conference candidates, trigger ingest, see runs.
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
    if (!sessionStorage.getItem('hoggyAdminKey')) { const k = prompt('Admin key (HOGGY_ADMIN_KEY)'); if (!k) { root.innerHTML = '<h1>Data desk</h1><p>Admin key required. Reload to enter it.</p>'; return; } sessionStorage.setItem('hoggyAdminKey', k); }
    const [cand, runs, chg, rep, pf, rc, cv, sb, lr] = await Promise.all([api('/api/admin/candidates'), api('/api/admin/runs'), api('/api/admin/changes'), api('/api/admin/reported'), api('/api/admin/proofs'), api('/api/admin/receipts'), api('/api/admin/coverage'), api('/api/admin/submissions'), api('/api/admin/reports')]);
    if (cand.status === 403 && /key/i.test(cand.error || '')) { sessionStorage.removeItem('hoggyAdminKey'); const k = prompt('That admin key was not accepted. Admin key (HOGGY_ADMIN_KEY)'); if (k) { sessionStorage.setItem('hoggyAdminKey', k); return draw(); } }
    if (cand.status === 403) { root.innerHTML = '<h1>Data desk</h1><p>Your account is not an admin. Set HOGGY_ADMINS to your email and restart the server.</p>'; return; }
    const list = cand.data || [], rs = runs.data || [], changes = chg.data || [], reported = rep.data || [], proofs = Array.isArray(pf.data) ? pf.data : [], receipts = Array.isArray(rc.data) ? rc.data : [], cover = Array.isArray(cv.data) ? cv.data : [], subs = Array.isArray(sb.data) ? sb.data : [], lreports = Array.isArray(lr.data) ? lr.data : [];
    const n = (k, one, many) => k + ' ' + (k === 1 ? one : many), money = (a, c) => a == null ? 'amount not read' : (c || '') + ' ' + Number(a).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const d = t => new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    const subForm = x => { const v = x.listing, inp = (k, l, t = 'text', extra = '') => `<div class="field"><label for="s-${x.id}-${k}">${l}</label><input id="s-${x.id}-${k}" name="${k}" type="${t}" value="${esc(v[k] == null ? '' : v[k])}" ${extra}></div>`;
      return `<form class="sub" data-sub="${esc(x.id)}" style="border-top:1px solid var(--line);padding:14px 0" novalidate>
      <div class="t" style="font-weight:700">${esc(v.name)} <span class="pill">${v.kind === 'course' ? 'Course session' : 'Conference'}</span></div>
      <div class="s" style="margin:4px 0 8px">Official page: <a class="u" target="_blank" rel="noopener noreferrer" href="${esc(httpsOnly(v.url))}">${esc(v.url)}</a> · sent ${esc(d(x.created))} · contact <a class="u" href="mailto:${esc(x.contactEmail)}">${esc(x.contactEmail)}</a> (private) · ${x.signedIn ? 'signed-in account' : 'no account'}</div>
      ${x.siteRoot ? '<p class="check warn">! This link is the site’s home page. Change it to the event’s own page before approving (the evidence rule needs the event page).</p>' : ''}
      <div class="two">${inp('name', 'Name')}${inp('organiser', 'Organiser')}</div>
      <div class="field"><label for="s-${x.id}-url">Official event page (https)</label><input id="s-${x.id}-url" name="url" type="url" value="${esc(v.url)}"></div>
      <div class="two">${inp('start', 'Start', 'date')}${inp('end', 'End', 'date')}</div>
      <div class="two">${inp('city', 'City')}${inp('countryCode', 'Country code (' + esc(x.country) + ')', 'text', 'maxlength="2"')}</div>
      <div class="two">${inp('specialty', 'Specialty')}<div class="field"><label for="s-${x.id}-format">Format</label><select id="s-${x.id}-format" name="format">${['In-person', 'Hybrid'].map(f => `<option ${f === v.format ? 'selected' : ''}>${f}</option>`).join('')}</select></div></div>
      <div class="two">${inp('cpdHours', 'CPD hours (as sent)', 'number', 'step="0.25" min="0" max="100"')}${inp('cpdBody', 'CPD body')}</div>
      ${inp('blurb', 'One-line description')}
      <div class="field"><label for="s-${x.id}-q">Date line (paste exactly)</label><textarea id="s-${x.id}-q" name="datesQuote" maxlength="200" rows="2" placeholder="e.g. 12–14 May 2027, Brisbane Convention Centre"></textarea></div>
      <label class="tick"><input type="checkbox" name="cpdConfirmed"> The CPD hours are stated on the official page</label>
      <div class="row"><button type="button" class="btn sm" data-sa="edit">Save edits</button><button type="button" class="btn sm primary" data-sa="approve">Approve and list</button><button type="button" class="btn sm danger" data-sa="reject">Reject</button><span class="note err" role="alert"></span></div></form>`; };
    const repHref = r => r.kind === 'course' ? '/courses/' + encodeURIComponent(r.refId) : '/conferences/' + encodeURIComponent(r.refId);
    root.innerHTML = `<div class="page-head"><div><h1>Data desk</h1><p>Nothing publishes until you approve.</p></div><button class="btn primary" id="run">Run updater now</button></div>
    <div class="panel" id="subs"><h3>${n(subs.length, 'submitted event', 'submitted events')} to check</h3><p class="note" style="margin:-6px 0 8px">Open the official page. Approve only if name, dates and city match; paste its date line.</p>${subs.map(subForm).join('') || '<p class="note">Nothing waiting.</p>'}</div>
    <div class="panel" id="lreports"><h3>${n(lreports.length, 'listing problem report', 'listing problem reports')} to check</h3>${lreports.map(r => `<div class="li" data-lr="${esc(r.id)}" style="flex-wrap:wrap"><div class="grow"><div class="t"><a class="u" target="_blank" rel="noopener noreferrer" href="${esc(repHref(r))}">${esc(r.name)}</a> · ${esc(r.reasonLabel)}</div><div class="s">${esc(r.kind)} ${esc(r.refId)} · ${esc(d(r.created))} · ${r.signedIn ? 'signed-in user' : 'visitor'}</div>${r.note ? `<div class="s">“${esc(r.note)}”</div>` : ''}</div><button class="btn sm primary" data-la="resolve">Fixed</button><button class="btn sm" data-la="dismiss">Dismiss</button></div>`).join('') || '<p class="note">Nothing waiting.</p>'}</div>
    <div class="panel" id="receipts"><h3>${n(receipts.length, 'emailed registration receipt', 'emailed registration receipts')} to check</h3><p class="note" style="margin:-6px 0 8px">Approve only if it’s a registration for that meeting and year, in the reviewer’s name. File deleted after you decide.</p>${receipts.map(k => `<div class="li rc" data-rc="${esc(k.id)}" style="flex-wrap:wrap;align-items:flex-start"><div class="grow" style="min-width:0"><div class="t">${esc(k.name || k.email)} · ${esc(k.email)}</div><div class="s">${esc(k.title)} · ${esc(k.editionYear)}</div><div class="s">Receipt: ${esc(k.vendor || 'vendor not read')} · ${esc(k.receiptDate || 'no date')} · ${esc(money(k.amount, k.currency))}</div><div class="s">Subject: ${esc(k.subject || '(none)')}${k.fileName ? ' · ' + esc(k.fileName) : ''}</div>${k.review ? `<div class="s" style="margin-top:4px">Review by ${esc(k.review.author)}${k.review.city ? ' · ' + esc(k.review.city) : ''} · ${esc(Number(k.review.rating).toFixed(1))}/5: “${esc(k.review.text)}”</div>` : '<div class="s" style="margin-top:4px">No review for this year yet.</div>'}<div class="pv" style="margin-top:8px"></div></div><div class="row">${k.hasFile ? '<button class="btn sm" data-ka="view">View receipt</button>' : ''}<button class="btn sm primary" data-ka="approve">Approve</button><button class="btn sm danger" data-ka="reject">Reject</button></div></div>`).join('') || '<p class="note">Nothing waiting.</p>'}</div>
    <div class="panel" id="proofs"><h3>${proofs.length} proof${proofs.length === 1 ? '' : 's'} of attendance to check</h3><p class="note" style="margin:-6px 0 8px">Approve only if name and year match. File deleted after you decide.</p>${proofs.map(p => `<div class="li pf" data-pf="${esc(p.id)}" style="flex-wrap:wrap;align-items:flex-start"><div class="grow"><div class="t">${esc(p.author)} · ${esc(p.email)}</div><div class="s">${esc(p.title)} · Attended ${esc(p.editionYear)}${p.city ? ' · ' + esc(p.city) : ''}</div><div class="s">${esc(p.kindLabel)} · ${esc(p.name)} · ${Math.max(1, Math.round(p.size / 1024))} KB · sent ${esc(new Date(p.created).toLocaleString('en-AU'))}</div><div class="s" style="margin-top:4px">“${esc(p.text)}”</div><div class="pv" style="margin-top:8px"></div></div><div class="row"><button class="btn sm" data-pa="view">View file</button><button class="btn sm primary" data-pa="approve">Approve</button><button class="btn sm danger" data-pa="reject">Reject</button></div></div>`).join('') || '<p class="note">Nothing waiting.</p>'}</div>
    <div class="panel" id="coverage"><h3>${n(cover.length, '“Covered in” link', '“Covered in” links')} suggested</h3><p class="note" style="margin:-6px 0 8px">Check it’s the publisher’s own page. Links only.</p>${cover.map(l => `<div class="li cv" data-cv="${esc(l.id)}" style="flex-wrap:wrap;align-items:flex-start"><div class="grow" style="min-width:0"><div class="t">${esc(l.seriesTitle)}</div><div class="s">${esc(l.typeLabel)} · ${esc(l.publication)}${l.year ? ' · ' + esc(l.year) : ''}${l.title ? ' · ' + esc(l.title) : ''}</div><div class="s" style="overflow-wrap:anywhere"><a target="_blank" rel="noopener noreferrer" style="text-decoration:underline" href="${esc(httpsOnly(l.url))}">${esc(l.url)}</a></div><div class="s">Suggested by ${esc(l.addedBy || 'a deleted account')} · ${esc(new Date(l.addedOn).toLocaleString('en-AU'))}</div></div><div class="row"><button class="btn sm primary" data-va="approve">Approve</button><button class="btn sm danger" data-va="reject">Reject</button></div></div>`).join('') || '<p class="note">Nothing waiting.</p>'}
      <form id="covadd" style="border-top:1px solid var(--line);margin-top:10px;padding-top:12px"><h4 style="margin:0 0 8px">Add a link (publishes now)</h4>
      <div class="two"><div class="field"><label for="ca1">Conference id or series key</label><input id="ca1" name="conf" required placeholder="e.g. jsca-46th-2026"></div><div class="field"><label for="ca2">Type</label><select id="ca2" name="type"><option value="meeting-report">Meeting report</option><option value="abstract-supplement">Abstract supplement</option><option value="society-journal">Society journal</option><option value="news">News</option></select></div></div>
      <div class="two"><div class="field"><label for="ca3">Publication</label><input id="ca3" name="publication" required maxlength="120"></div><div class="field"><label for="ca4">Year</label><input id="ca4" name="year" type="number" min="1950" step="1"></div></div>
      <div class="field"><label for="ca5">Link (https)</label><input id="ca5" name="url" type="url" required maxlength="500" placeholder="https://"></div><div class="field"><label for="ca6">Title (optional)</label><input id="ca6" name="title" maxlength="200"></div>
      <div class="row"><button class="btn sm primary" type="submit">Add link</button><span class="note err" id="caerr" role="alert"></span></div></form></div>
    <div class="panel"><h3>Last runs</h3>${rs.length ? rs.map(r => `<div class="li"><div class="grow"><div class="t">${new Date(r.started).toLocaleString()}</div><div class="s">Refresh: ${esc(JSON.stringify(r.summary.refresh))} · Discover: ${esc(JSON.stringify(r.summary.discover))}</div>${(r.summary.changes || []).slice(0, 6).map(x => `<div class="s">${esc(x)}</div>`).join('')}</div></div>`).join('') : '<p class="note">No runs yet.</p>'}</div>
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
    root.querySelectorAll('form.sub').forEach(f => f.addEventListener('click', async e => {
      const a = e.target.dataset.sa; if (!a) return; e.preventDefault();
      const fd = Object.fromEntries(new FormData(f)), out = f.querySelector('.err'); out.textContent = '';
      let body;
      if (a === 'reject') { const note = prompt('Reason (optional)'); if (note === null) return; body = { action: 'reject', note }; }
      else {
        const listing = { name: fd.name, organiser: fd.organiser, url: fd.url, start: fd.start, end: fd.end, city: fd.city, countryCode: String(fd.countryCode || '').toUpperCase(), specialty: fd.specialty, format: fd.format, cpdHours: fd.cpdHours === '' ? null : +fd.cpdHours, cpdBody: fd.cpdBody, blurb: fd.blurb };
        body = { action: a, listing, datesQuote: fd.datesQuote || '', cpdConfirmed: fd.cpdConfirmed === 'on' };
        if (a === 'approve' && String(fd.datesQuote || '').trim().length < 6) { out.textContent = 'Paste the date line from the official page first.'; f.querySelector('textarea').focus(); return; }
      }
      const r = await api('/api/admin/submissions/' + f.dataset.sub, { method: 'POST', body });
      if (r.error) { out.textContent = r.error; return; }
      if (a === 'edit') { out.textContent = 'Saved.'; return; }
      f.remove(); const k = root.querySelectorAll('form.sub').length; $('#subs h3').textContent = n(k, 'submitted event', 'submitted events') + ' to check';
      if (a === 'approve') alert('Listed: /conferences/' + r.data.id);
    }));
    root.querySelectorAll('[data-lr]').forEach(el => el.addEventListener('click', async e => {
      const a = e.target.dataset.la; if (!a) return;
      const r = await api('/api/admin/reports/' + el.dataset.lr, { method: 'POST', body: { action: a } }); if (r.error) return alert(r.error);
      el.remove(); const k = root.querySelectorAll('[data-lr]').length; $('#lreports h3').textContent = n(k, 'listing problem report', 'listing problem reports') + ' to check';
    }));
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
      const note = a === 'reject' ? prompt('Reason (optional)') : '';
      if (note === null) return;
      const r = await api('/api/admin/proofs/' + id, { method: 'POST', body: { action: a, note } }); if (r.error) return alert(r.error);
      el.remove(); const h = $('#proofs h3'), n = root.querySelectorAll('[data-pf]').length; h.textContent = n + ' proof' + (n === 1 ? '' : 's') + ' of attendance to check';
    }));
    const viewFile = async (url, el, alt) => { /* fetched with the admin key; never a public URL */
      const r = await fetch(url, { headers: { 'X-Requested-With': 'hoggy', 'X-Admin-Key': sessionStorage.getItem('hoggyAdminKey') || '' }, credentials: 'same-origin' });
      if (!r.ok) return alert('Could not open the file (' + r.status + ')');
      const b = await r.blob(), u = URL.createObjectURL(b), pv = el.querySelector('.pv');
      if (/^image\//.test(b.type)) { pv.innerHTML = ''; const img = new Image(); img.alt = alt; img.style.cssText = 'max-width:100%;max-height:420px;border-radius:10px;border:1px solid var(--line)'; img.src = u; pv.appendChild(img); }
      else if (b.type === 'text/plain') { pv.innerHTML = ''; const pre = document.createElement('pre'); pre.style.cssText = 'white-space:pre-wrap;max-height:300px;overflow:auto;font-size:12px;border:1px solid var(--line);border-radius:10px;padding:10px'; pre.textContent = (await b.text()).slice(0, 20000); pv.appendChild(pre); URL.revokeObjectURL(u); }
      else { const l = document.createElement('a'); l.href = u; l.download = 'receipt-' + Date.now() + '.pdf'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000); }
    };
    const recount = (sel, id, one, many) => { const k = root.querySelectorAll(sel).length; $(id + ' h3').textContent = n(k, one, many) + (id === '#coverage' ? ' suggested' : ' to check'); };
    root.querySelectorAll('[data-rc]').forEach(el => el.addEventListener('click', async e => {
      const a = e.target.dataset.ka; if (!a) return; const id = el.dataset.rc;
      if (a === 'view') return viewFile('/api/admin/receipts/' + id + '/file', el, 'Emailed registration receipt');
      const note = a === 'reject' ? prompt('Reason (optional)') : '';
      if (note === null) return;
      const r = await api('/api/admin/receipts/' + id, { method: 'POST', body: { action: a, note } }); if (r.error) return alert(r.error);
      el.remove(); recount('[data-rc]', '#receipts', 'emailed registration receipt', 'emailed registration receipts');
    }));
    root.querySelectorAll('[data-cv]').forEach(el => el.addEventListener('click', async e => {
      const a = e.target.dataset.va; if (!a) return;
      const r = await api('/api/admin/coverage/' + el.dataset.cv, { method: 'POST', body: { action: a } }); if (r.error) return alert(r.error);
      el.remove(); recount('[data-cv]', '#coverage', '“Covered in” link', '“Covered in” links');
    }));
    $('#covadd').addEventListener('submit', async e => {
      e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
      if (httpsOnly(fd.url) === '#') { $('#caerr').textContent = 'Use a full https:// link.'; return; }
      if (!String(fd.publication || '').trim()) { $('#caerr').textContent = 'Add the publication.'; return; }
      const r = await api('/api/admin/coverage', { method: 'POST', body: { ...fd, year: fd.year ? +fd.year : null } });
      if (r.error) { $('#caerr').textContent = r.error; return; }
      e.target.reset(); $('#caerr').textContent = 'Added';
    });
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
