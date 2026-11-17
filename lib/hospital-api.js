'use strict';
/* Hospital routes: organisations, roles, trip approval, study budgets, claims to finance, in-app notifications.
   Mounted by server.js after the session check, so every handler has a signed-in user `u`.
   Rules, all enforced here and never taken from the request or the synced state blob:
   - every query is filtered by the caller's own membership (org_id comes from memberships, never from the body or URL);
     a record in another hospital is "not found" (404), a page your role cannot use is 403;
   - doctors only see their own requests and claims; nobody decides their own request or marks their own claim paid;
   - join codes are rate-limited per user and per IP (rate_hits), and a wrong code gives no hint. */
const H = require('./hospital.js');

function makeHospitalApi({ db, now, clean, emailOk, limited, readJson, json, err, getConfs, isUnique }) {
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const parse = s => { try { return JSON.parse(s); } catch (e) { return {}; } };

  /* the caller's hospital and role, or null */
  const membership = uid => db.get('SELECT m.role, m.created joined, o.id, o.name, o.join_code, o.claims_email, o.default_allowance_cents, o.currency, o.created FROM memberships m JOIN orgs o ON o.id=m.org_id WHERE m.user_id=?', uid);
  const orgOut = m => ({ id: m.id, name: m.name, claimsEmail: m.claims_email || '', defaultAllowanceCents: m.default_allowance_cents, currency: m.currency, created: m.created, role: m.role, roleLabel: H.ROLE_LABEL[m.role], ...(H.can(m.role, 'admin') ? { joinCode: H.showCode(m.join_code) } : {}) });
  /* TODO(D3): also email these once an outbound mail provider is chosen (backlog B52); in-app only until then */
  const notify = async (t, users, orgId, kind, text, link) => { for (const id of users) await t.run('INSERT INTO notifications(user_id,org_id,kind,text,link,created) VALUES(?,?,?,?,?,?)', id, orgId, kind, clean(text, 300), link || null, now()); };
  const roleUsers = async (orgId, roles, except) => (await db.all(`SELECT user_id FROM memberships WHERE org_id=? AND role IN (${roles.map(() => '?').join(',')}) AND user_id!=?`, orgId, ...roles, except)).map(r => r.user_id);
  const nameOf = async uid => { const r = await db.get('SELECT name, email FROM users WHERE id=?', uid); return r ? (r.name || r.email) : 'A member'; };

  /* a person's budget for a year, in their current hospital */
  async function budgetFor(m, userId, year) {
    const own = await db.get('SELECT allowance_cents FROM allowances WHERE user_id=? AND org_id=? AND year=?', userId, m.id, year);
    const approvals = await db.all('SELECT trip_ref, year, status, estimate_cents FROM approvals WHERE org_id=? AND user_id=? AND year=?', m.id, userId, year);
    const claims = await db.all('SELECT trip_ref, year, status, total_cents FROM claims WHERE org_id=? AND user_id=? AND year=?', m.id, userId, year);
    return { ...H.budget({ year, allowance: own ? own.allowance_cents : m.default_allowance_cents, approvals, claims }), currency: m.currency, ownAllowance: !!own };
  }
  /* the event a request or claim is about: the server's own conference row when it has one, else (courses, which live in
     static files) the client's description, cleaned. Its start date decides the budget year. */
  async function eventOf(confId, ev) {
    const id = clean(confId, 80), c = id ? (await getConfs()).list.find(x => x.id === id) : null;
    if (c) return { id: c.id, name: c.name, city: c.city || '', country: c.country || '', start: c.start, end: c.end, kind: 'conference' };
    const e = ev && typeof ev === 'object' ? ev : {}, name = clean(e.name, 200), start = String(e.start || ''), end = String(e.end || e.start || '');
    if (!name || !DATE.test(start) || !DATE.test(end) || end < start) return null;
    return { id: id || null, name, city: clean(e.city, 80), country: clean(e.country, 80), start, end, kind: e.kind === 'course' ? 'course' : 'event' };
  }
  const approvalOut = (r, extra = {}) => { const s = parse(r.snapshot); return { id: r.id, tripRef: r.trip_ref, confId: r.conf_id, event: s.event || {}, costs: s.costs || {}, note: s.note || '', year: r.year, estimateCents: r.estimate_cents, currency: r.currency, status: r.status, comment: r.manager_comment || '', decidedBy: r.decider || null, created: r.created, updated: r.updated, decided: r.decided, ...extra }; };
  const claimOut = (r, extra = {}) => { const s = parse(r.snapshot); return { id: r.id, tripRef: r.trip_ref, confId: r.conf_id, event: s.event || {}, year: r.year, totalCents: r.total_cents, currency: r.currency, receipts: r.receipts, status: r.status, submitted: r.submitted, paid: r.paid, approvalId: r.approval_id, ...extra }; };
  const yearParam = url => { const y = Math.floor(+url.searchParams.get('year')); return y >= 2000 && y <= 2100 ? y : new Date().getUTCFullYear(); };

  /* returns true when it handled the request */
  async function handle(req, res, url, u, ip) {
    const p = url.pathname, m = req.method;
    if (!/^\/api\/(org|approvals|budget|claims|notifications)(\/|$)/.test(p)) return false;
    let mm;
    const me = await membership(u.id);
    const need = what => { if (!me) { err(res, 403, 'Join or create a hospital first.'); return false; } if (what && !H.can(me.role, what)) { err(res, 403, { approve: 'Only managers and admins can decide requests.', team: 'Only managers and admins can see the team.', finance: 'Only finance and admins can see hospital claims.', admin: 'Only a hospital admin can do that.' }[what]); return false; } return true; };

    /* ---------- the hospital ---------- */
    if (p === '/api/org' && m === 'GET') {
      if (!me) { json(res, 200, { org: null }); return true; }
      const counts = { unread: (await db.get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND seen IS NULL', u.id)).n };
      if (H.can(me.role, 'approve')) counts.approvals = (await db.get("SELECT COUNT(*) n FROM approvals a JOIN memberships x ON x.user_id=a.user_id AND x.org_id=a.org_id WHERE a.org_id=? AND a.status='pending' AND a.user_id!=?", me.id, u.id)).n;
      if (H.can(me.role, 'finance')) counts.claims = (await db.get("SELECT COUNT(*) n FROM claims WHERE org_id=? AND status='submitted' AND user_id!=?", me.id, u.id)).n;
      if (H.can(me.role, 'team')) counts.members = (await db.get('SELECT COUNT(*) n FROM memberships WHERE org_id=?', me.id)).n;
      json(res, 200, { org: orgOut(me), counts }); return true;
    }
    if (p === '/api/org' && m === 'POST') { /* create: the creator becomes admin */
      if (me) { err(res, 409, 'You are already in a hospital. Leave it first.'); return true; }
      if (await limited('orgnew:' + u.id, 5, 3600e3)) { err(res, 429, 'Too many hospitals created. Try again in an hour.'); return true; }
      const b = await readJson(req, 4e3), name = clean(b.name, 120), mail = clean(b.claimsEmail, 254).toLowerCase(), allow = H.cents(b.defaultAllowanceCents ?? 0), cur = /^[A-Z]{3}$/.test(String(b.currency || '')) ? b.currency : 'AUD';
      if (name.length < 2) { err(res, 400, 'Enter the hospital or health service name.'); return true; }
      if (mail && !emailOk(mail)) { err(res, 400, 'Enter a valid claims email, or leave it blank.'); return true; }
      if (allow === null) { err(res, 400, 'Enter the yearly allowance as an amount from 0 to 1,000,000.'); return true; }
      let org = null;
      for (let i = 0; i < 5 && !org; i++) {
        try {
          org = await db.tx(async t => {
            const o = await t.get('INSERT INTO orgs(name,join_code,claims_email,default_allowance_cents,currency,created) VALUES(?,?,?,?,?,?) RETURNING id', name, H.newCode(), mail || null, allow, cur, now());
            await t.run("INSERT INTO memberships(user_id,org_id,role,created) VALUES(?,?,'admin',?)", u.id, o.id, now());
            return o;
          });
        } catch (e) { if (!isUnique(e)) throw e; if (await membership(u.id)) { err(res, 409, 'You are already in a hospital. Leave it first.'); return true; } }
      }
      if (!org) { err(res, 500, 'Could not create the hospital. Try again.'); return true; }
      json(res, 201, { org: orgOut(await membership(u.id)) }); return true;
    }
    if (p === '/api/org/settings' && m === 'POST') {
      if (!need('admin')) return true;
      const b = await readJson(req, 4e3), name = b.name === undefined ? me.name : clean(b.name, 120), mail = b.claimsEmail === undefined ? (me.claims_email || '') : clean(b.claimsEmail, 254).toLowerCase(), allow = b.defaultAllowanceCents === undefined ? me.default_allowance_cents : H.cents(b.defaultAllowanceCents);
      if (name.length < 2) { err(res, 400, 'Enter the hospital or health service name.'); return true; }
      if (mail && !emailOk(mail)) { err(res, 400, 'Enter a valid claims email, or leave it blank.'); return true; }
      if (allow === null) { err(res, 400, 'Enter the yearly allowance as an amount from 0 to 1,000,000.'); return true; }
      await db.run('UPDATE orgs SET name=?, claims_email=?, default_allowance_cents=? WHERE id=?', name, mail || null, allow, me.id);
      json(res, 200, { org: orgOut(await membership(u.id)) }); return true;
    }
    if (p === '/api/org/code' && m === 'POST') { /* new join code; the old one stops working at once */
      if (!need('admin')) return true;
      for (let i = 0; i < 5; i++) { try { await db.run('UPDATE orgs SET join_code=? WHERE id=?', H.newCode(), me.id); break; } catch (e) { if (!isUnique(e)) throw e; } }
      json(res, 200, { org: orgOut(await membership(u.id)) }); return true;
    }
    if (p === '/api/org/join' && m === 'POST') {
      if (me) { err(res, 409, 'You are already in a hospital. Leave it first.'); return true; }
      /* brute force: 10 tries per account and 30 per network per hour; the counter is the shared rate_hits table */
      if ((await limited('join:' + u.id, 10, 3600e3)) || (await limited('joinip:' + ip, 30, 3600e3))) { err(res, 429, 'Too many join attempts. Try again in an hour.'); return true; }
      const b = await readJson(req, 1e3), code = H.normCode(b.code), o = code ? await db.get('SELECT id, name FROM orgs WHERE join_code=?', code) : null;
      if (!o) { err(res, 404, 'No hospital has that code. Check it with your hospital admin.'); return true; }
      try { await db.run("INSERT INTO memberships(user_id,org_id,role,created) VALUES(?,?,'doctor',?)", u.id, o.id, now()); } catch (e) { if (isUnique(e)) { err(res, 409, 'You are already in a hospital. Leave it first.'); return true; } throw e; }
      const admins = await roleUsers(o.id, ['admin'], u.id), who = await nameOf(u.id);
      await db.tx(t => notify(t, admins, o.id, 'joined', `${who} joined ${o.name}.`, '#/team'));
      json(res, 200, { org: orgOut(await membership(u.id)) }); return true;
    }
    if (p === '/api/org/leave' && m === 'POST') {
      if (!need()) return true;
      const others = (await db.get('SELECT COUNT(*) n FROM memberships WHERE org_id=? AND user_id!=?', me.id, u.id)).n;
      const admins = (await db.get("SELECT COUNT(*) n FROM memberships WHERE org_id=? AND role='admin' AND user_id!=?", me.id, u.id)).n;
      if (me.role === 'admin' && others > 0 && admins === 0) { err(res, 409, 'Make another member an admin before you leave.'); return true; }
      if (others === 0) await db.run('DELETE FROM orgs WHERE id=?', me.id); /* last member: the hospital goes with them */
      else await db.run('DELETE FROM memberships WHERE user_id=?', u.id);
      json(res, 200, { ok: true, deleted: others === 0 }); return true;
    }
    /* team: every member with their budget for the year; managers set allowances, admins also change roles */
    if (p === '/api/org/team' && m === 'GET') {
      if (!need('team')) return true;
      const year = yearParam(url), rows = await db.all('SELECT m.user_id, m.role, m.created, us.name, us.email FROM memberships m JOIN users us ON us.id=m.user_id WHERE m.org_id=? ORDER BY us.name, us.email', me.id), out = [];
      for (const r of rows) out.push({ userId: r.user_id, name: r.name || '', email: r.email, role: r.role, roleLabel: H.ROLE_LABEL[r.role], joined: r.created, me: r.user_id === u.id, budget: await budgetFor(me, r.user_id, year) });
      json(res, 200, { year, currency: me.currency, defaultAllowanceCents: me.default_allowance_cents, canAdmin: H.can(me.role, 'admin'), members: out }); return true;
    }
    if (p === '/api/org/allowance' && m === 'POST') {
      if (!need('team')) return true;
      const b = await readJson(req, 1e3), uid = Number(b.userId), year = Number(b.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) { err(res, 400, 'Pick a year.'); return true; }
      if (!(await db.get('SELECT 1 FROM memberships WHERE user_id=? AND org_id=?', uid, me.id))) { err(res, 404, 'not found'); return true; }
      if (b.allowanceCents === null || b.allowanceCents === '') await db.run('DELETE FROM allowances WHERE user_id=? AND org_id=? AND year=?', uid, me.id, year);
      else {
        const c = H.cents(b.allowanceCents); if (c === null) { err(res, 400, 'Enter an allowance from 0 to 1,000,000.'); return true; }
        await db.run('INSERT INTO allowances(user_id,org_id,year,allowance_cents,set_by,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,org_id,year) DO UPDATE SET allowance_cents=excluded.allowance_cents, set_by=excluded.set_by, updated=excluded.updated', uid, me.id, year, c, u.id, now());
      }
      json(res, 200, { ok: true, budget: await budgetFor(me, uid, year) }); return true;
    }
    if ((mm = p.match(/^\/api\/org\/members\/(\d{1,12})$/)) && m === 'POST') {
      if (!need('admin')) return true;
      const uid = +mm[1], b = await readJson(req, 1e3), t = await db.get('SELECT role FROM memberships WHERE user_id=? AND org_id=?', uid, me.id);
      if (!t) { err(res, 404, 'not found'); return true; }
      const otherAdmins = (await db.get("SELECT COUNT(*) n FROM memberships WHERE org_id=? AND role='admin' AND user_id!=?", me.id, uid)).n;
      if (b.action === 'remove') {
        if (uid === u.id) { err(res, 400, 'Use "Leave hospital" to remove yourself.'); return true; }
        await db.run('DELETE FROM memberships WHERE user_id=? AND org_id=?', uid, me.id);
        json(res, 200, { ok: true }); return true;
      }
      if (!H.ROLES.includes(b.role)) { err(res, 400, 'role: doctor, manager, finance or admin'); return true; }
      if (t.role === 'admin' && b.role !== 'admin' && otherAdmins === 0) { err(res, 409, 'A hospital needs at least one admin. Make someone else admin first.'); return true; }
      await db.run('UPDATE memberships SET role=? WHERE user_id=? AND org_id=?', b.role, uid, me.id);
      if (uid !== u.id) await db.tx(tx => notify(tx, [uid], me.id, 'role', `Your role at ${me.name} is now ${H.ROLE_LABEL[b.role]}.`, '#/settings'));
      json(res, 200, { ok: true }); return true;
    }

    /* ---------- budget ---------- */
    if (p === '/api/budget' && m === 'GET') { if (!need()) return true; json(res, 200, await budgetFor(me, u.id, yearParam(url))); return true; }

    /* ---------- approvals ---------- */
    if (p === '/api/approvals/mine' && m === 'GET') {
      if (!me) { json(res, 200, []); return true; }
      json(res, 200, (await db.all('SELECT a.*, d.name decider FROM approvals a LEFT JOIN users d ON d.id=a.decided_by WHERE a.org_id=? AND a.user_id=? ORDER BY a.created DESC LIMIT 200', me.id, u.id)).map(r => approvalOut(r))); return true;
    }
    if (p === '/api/approvals' && m === 'POST') { /* request (or resubmit after a rejection) */
      if (!need()) return true;
      const b = await readJson(req, 6e3), ref = String(b.tripRef || '');
      if (!/^[\w-]{3,40}$/.test(ref)) { err(res, 400, 'bad trip'); return true; }
      const ev = await eventOf(b.confId, b.event); if (!ev) { err(res, 400, 'Unknown event: it needs a name and dates.'); return true; }
      const pc = H.parseCosts(b.costs); if (!pc.ok) { err(res, 400, pc.error.charAt(0).toUpperCase() + pc.error.slice(1) + '.'); return true; }
      if (await limited('ap:' + u.id, 30, 3600e3)) { err(res, 429, 'Too many requests. Try again later.'); return true; }
      const snap = JSON.stringify({ event: ev, costs: pc.costs, note: clean(b.note, 500) }), year = +ev.start.slice(0, 4);
      const cur = await db.get('SELECT id, status FROM approvals WHERE org_id=? AND user_id=? AND trip_ref=?', me.id, u.id, ref);
      if (cur && cur.status === 'pending') { err(res, 409, 'This trip is already waiting for a decision.'); return true; }
      if (cur && cur.status === 'approved') { err(res, 409, 'This trip is already approved.'); return true; }
      let id;
      if (cur) { /* rejected: edited and resubmitted; the old decision is cleared */
        const r = await db.run("UPDATE approvals SET conf_id=?, snapshot=?, year=?, estimate_cents=?, currency=?, status='pending', manager_comment=NULL, decided_by=NULL, decided=NULL, updated=? WHERE id=? AND status='rejected'", ev.id, snap, year, pc.total, me.currency, now(), cur.id);
        if (!r.changes) { err(res, 409, 'This trip is already waiting for a decision.'); return true; }
        id = cur.id;
      } else {
        try { id = (await db.get("INSERT INTO approvals(org_id,user_id,trip_ref,conf_id,snapshot,year,estimate_cents,currency,status,created,updated) VALUES(?,?,?,?,?,?,?,?,'pending',?,?) RETURNING id", me.id, u.id, ref, ev.id, snap, year, pc.total, me.currency, now(), now())).id; }
        catch (e) { if (isUnique(e)) { err(res, 409, 'This trip is already waiting for a decision.'); return true; } throw e; }
      }
      const who = await nameOf(u.id), to = await roleUsers(me.id, H.CAN.approve, u.id);
      await db.tx(t => notify(t, to, me.id, 'request', `${who} asked for approval: ${ev.name}${cur ? ' (resubmitted)' : ''}.`, '#/approvals'));
      json(res, cur ? 200 : 201, approvalOut(await db.get('SELECT * FROM approvals WHERE id=?', id), { approvers: to.length })); return true;
    }
    if (p === '/api/approvals' && m === 'GET') {
      if (!need('approve')) return true;
      const decided = url.searchParams.get('status') === 'decided';
      const rows = await db.all(`SELECT a.*, us.name doctor, us.email, d.name decider FROM approvals a JOIN memberships x ON x.user_id=a.user_id AND x.org_id=a.org_id JOIN users us ON us.id=a.user_id LEFT JOIN users d ON d.id=a.decided_by
        WHERE a.org_id=? AND ${decided ? "a.status!='pending' ORDER BY a.decided DESC LIMIT 30" : "a.status='pending' ORDER BY a.updated LIMIT 200"}`, me.id);
      const out = [];
      for (const r of rows) out.push(approvalOut(r, { doctor: r.doctor || r.email, email: r.email, mine: r.user_id === u.id, ...(decided ? {} : { budget: await budgetFor(me, r.user_id, r.year) }) }));
      json(res, 200, out); return true;
    }
    if ((mm = p.match(/^\/api\/approvals\/(\d{1,12})$/)) && m === 'POST') {
      if (!need('approve')) return true;
      const b = await readJson(req, 3e3), a = await db.get('SELECT a.id, a.user_id, a.status, a.snapshot FROM approvals a JOIN memberships x ON x.user_id=a.user_id AND x.org_id=a.org_id WHERE a.id=? AND a.org_id=?', +mm[1], me.id);
      if (!a) { err(res, 404, 'not found'); return true; }
      if (a.user_id === u.id) { err(res, 403, 'You cannot decide your own request. Another manager or admin has to.'); return true; }
      if (b.action !== 'approve' && b.action !== 'reject') { err(res, 400, 'approve|reject'); return true; }
      const comment = clean(b.comment, 1000);
      if (b.action === 'reject' && !comment) { err(res, 400, 'Say why you are rejecting it, so the doctor can change the plan.'); return true; }
      const st = b.action === 'approve' ? 'approved' : 'rejected';
      const r = await db.run("UPDATE approvals SET status=?, manager_comment=?, decided_by=?, decided=?, updated=? WHERE id=? AND status='pending'", st, comment || null, u.id, now(), now(), a.id);
      if (!r.changes) { err(res, 409, 'This request is no longer waiting for a decision.'); return true; }
      const ev = (parse(a.snapshot).event || {}).name || 'your trip', who = await nameOf(u.id);
      await db.tx(t => notify(t, [a.user_id], me.id, st, `${ev}: ${st === 'approved' ? 'approved' : 'not approved'} by ${who}${comment ? ' ("' + comment.slice(0, 120) + '")' : ''}.`, '#/trips'));
      json(res, 200, { ok: true, status: st }); return true;
    }

    /* ---------- claims ---------- */
    if (p === '/api/claims/mine' && m === 'GET') {
      if (!me) { json(res, 200, []); return true; }
      json(res, 200, (await db.all('SELECT * FROM claims WHERE org_id=? AND user_id=? ORDER BY submitted DESC LIMIT 200', me.id, u.id)).map(r => claimOut(r))); return true;
    }
    if (p === '/api/claims' && m === 'POST') { /* the doctor marks the claim pack as submitted */
      if (!need()) return true;
      const b = await readJson(req, 4e3), ref = String(b.tripRef || ''), total = H.cents(b.totalCents), n = Math.max(0, Math.min(500, Math.floor(+b.receipts) || 0));
      if (!/^[\w-]{3,40}$/.test(ref)) { err(res, 400, 'bad trip'); return true; }
      if (!total) { err(res, 400, 'The claim total must be more than zero.'); return true; }
      if (String(b.currency || '') !== me.currency) { err(res, 400, `${me.name} claims in ${me.currency}. Set your currency to ${me.currency} in Settings, then mark it submitted again.`); return true; }
      if (await limited('cl:' + u.id, 30, 3600e3)) { err(res, 429, 'Too many requests. Try again later.'); return true; }
      const ap = await db.get("SELECT id, year, snapshot FROM approvals WHERE org_id=? AND user_id=? AND trip_ref=? AND status='approved'", me.id, u.id, ref);
      const ev = ap ? parse(ap.snapshot).event : await eventOf(b.confId, b.event); if (!ev) { err(res, 400, 'Unknown event: it needs a name and dates.'); return true; }
      const year = ap ? ap.year : +ev.start.slice(0, 4), snap = JSON.stringify({ event: ev });
      const cur = await db.get('SELECT id, status FROM claims WHERE org_id=? AND user_id=? AND trip_ref=?', me.id, u.id, ref);
      if (cur && cur.status === 'paid') { err(res, 409, 'This claim has already been paid.'); return true; }
      let id;
      if (cur) { await db.run("UPDATE claims SET total_cents=?, receipts=?, approval_id=?, snapshot=?, year=? WHERE id=? AND status='submitted'", total, n, ap ? ap.id : null, snap, year, cur.id); id = cur.id; }
      else {
        try { id = (await db.get("INSERT INTO claims(org_id,user_id,approval_id,trip_ref,conf_id,snapshot,year,total_cents,currency,receipts,status,submitted) VALUES(?,?,?,?,?,?,?,?,?,?,'submitted',?) RETURNING id", me.id, u.id, ap ? ap.id : null, ref, ev.id || null, snap, year, total, me.currency, n, now())).id; }
        catch (e) { if (isUnique(e)) { err(res, 409, 'This claim is already submitted.'); return true; } throw e; }
        const who = await nameOf(u.id), to = await roleUsers(me.id, H.CAN.finance, u.id);
        await db.tx(t => notify(t, to, me.id, 'claim', `${who} submitted a claim: ${ev.name}.`, '#/finance'));
      }
      json(res, cur ? 200 : 201, claimOut(await db.get('SELECT * FROM claims WHERE id=?', id))); return true;
    }
    if (p === '/api/claims' && m === 'GET') {
      if (!need('finance')) return true;
      const rows = await db.all("SELECT c.*, us.name doctor, us.email, a.status approval FROM claims c JOIN users us ON us.id=c.user_id LEFT JOIN approvals a ON a.id=c.approval_id WHERE c.org_id=? ORDER BY CASE c.status WHEN 'submitted' THEN 0 ELSE 1 END, c.submitted LIMIT 300", me.id);
      json(res, 200, rows.map(r => claimOut(r, { doctor: r.doctor || r.email, email: r.email, approval: r.approval || null, mine: r.user_id === u.id }))); return true;
    }
    if ((mm = p.match(/^\/api\/claims\/(\d{1,12})\/paid$/)) && m === 'POST') {
      if (!need('finance')) return true;
      const c = await db.get('SELECT id, user_id, status, snapshot, total_cents, currency FROM claims WHERE id=? AND org_id=?', +mm[1], me.id);
      if (!c) { err(res, 404, 'not found'); return true; }
      if (c.user_id === u.id) { err(res, 403, 'You cannot mark your own claim paid. Another finance member or admin has to.'); return true; }
      const r = await db.run("UPDATE claims SET status='paid', paid=?, paid_by=? WHERE id=? AND status='submitted'", now(), u.id, c.id);
      if (!r.changes) { err(res, 409, 'This claim is already marked paid.'); return true; }
      await db.tx(t => notify(t, [c.user_id], me.id, 'paid', `${(parse(c.snapshot).event || {}).name || 'Your claim'}: paid by ${me.name}.`, '#/claims'));
      json(res, 200, { ok: true }); return true;
    }

    /* ---------- in-app notifications (email needs decision D3) ---------- */
    if (p === '/api/notifications' && m === 'GET') {
      const items = await db.all('SELECT id, kind, text, link, created, seen FROM notifications WHERE user_id=? ORDER BY created DESC, id DESC LIMIT 30', u.id);
      json(res, 200, { unread: items.filter(x => !x.seen).length, items }); return true;
    }
    if (p === '/api/notifications/read' && m === 'POST') { await db.run('UPDATE notifications SET seen=? WHERE user_id=? AND seen IS NULL', now(), u.id); json(res, 200, { ok: true }); return true; }
    err(res, 404, 'not found'); return true;
  }

  /* account deletion: the hospital keeps an admin (the longest-standing manager, else member), or goes if nobody is left */
  async function beforeAccountDelete(uid) {
    const me = await membership(uid); if (!me) return;
    const others = await db.all('SELECT user_id, role FROM memberships WHERE org_id=? AND user_id!=? ORDER BY created, user_id', me.id, uid);
    if (!others.length) return db.run('DELETE FROM orgs WHERE id=?', me.id);
    if (me.role === 'admin' && !others.some(o => o.role === 'admin')) { const next = others.find(o => o.role === 'manager') || others[0]; await db.run("UPDATE memberships SET role='admin' WHERE user_id=? AND org_id=?", next.user_id, me.id); }
  }
  return { handle, beforeAccountDelete, membership };
}
module.exports = { makeHospitalApi };
