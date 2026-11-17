'use strict';
/* Hospitals (organisations): roles, join codes, cost estimates and the study budget. Pure functions, no database.
   Used by server.js; tested in tests/hospital.test.js. The server is the only place a role or status is decided. */
const crypto = require('node:crypto');

const ROLES = ['doctor', 'manager', 'finance', 'admin'];
const ROLE_LABEL = { doctor: 'Doctor', manager: 'Manager', finance: 'Finance', admin: 'Admin' };
/* what each role may do in its own hospital (everyone may request approval for, and claim, their own trips) */
const CAN = {
  approve: ['manager', 'admin'],      /* Approvals page: decide other people's requests */
  team: ['manager', 'admin'],         /* Team page: budgets, per-person allowance */
  finance: ['finance', 'admin'],      /* Finance claims: list and mark paid */
  admin: ['admin'],                   /* roles, remove members, join code, hospital settings */
};
const can = (role, what) => !!(CAN[what] && CAN[what].includes(role));

/* 8 characters, no 0/O/1/I so a code can be read out; shown as ABCD-EFGH. 32^8 = 2^40 codes. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() { const b = crypto.randomBytes(8); let s = ''; for (const x of b) s += CODE_CHARS[x & 31]; return s; }
/* what the user typed -> the stored form, or '' if it cannot be a code */
function normCode(v) { const s = String(v ?? '').toUpperCase().replace(/[\s-]/g, ''); return /^[A-HJ-NP-Z2-9]{8}$/.test(s) ? s : ''; }
const showCode = c => c ? c.slice(0, 4) + '-' + c.slice(4) : '';

const COSTS = ['registration', 'flights', 'accommodation', 'other'];
const COST_LABEL = { registration: 'Registration', flights: 'Flights', accommodation: 'Accommodation', other: 'Other' };
const MAX_ITEM = 10_000_000; /* $100,000 per line, in cents */
/* {registration, flights, accommodation, other} in cents -> { ok, costs, total } */
function parseCosts(o) {
  if (!o || typeof o !== 'object') return { ok: false, error: 'add your estimated costs' };
  const costs = {};
  for (const k of COSTS) {
    const v = o[k] === undefined || o[k] === null || o[k] === '' ? 0 : Number(o[k]);
    if (!Number.isInteger(v) || v < 0 || v > MAX_ITEM) return { ok: false, error: `${COST_LABEL[k]}: enter an amount from 0 to 100,000` };
    costs[k] = v;
  }
  const total = COSTS.reduce((a, k) => a + costs[k], 0);
  if (total <= 0) return { ok: false, error: 'add at least one estimated cost' };
  return { ok: true, costs, total };
}
/* a whole-cents amount from the client (claim totals, allowances) */
const cents = (v, max = 100_000_000) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= max ? n : null; };

/* Study budget for one person and one year (the year the event starts).
   committed = approved requests not yet claimed (their estimates); spent = claims submitted or paid (the claim-pack totals);
   pending requests are shown but not subtracted; remaining = allowance - committed - spent (may go below zero). */
function budget({ year, allowance, approvals = [], claims = [] }) {
  const claimed = new Set(claims.map(c => c.trip_ref));
  let committed = 0, pending = 0, spent = 0, nPending = 0, nCommitted = 0;
  for (const a of approvals) {
    if (a.year !== year) continue;
    if (a.status === 'pending') { pending += a.estimate_cents; nPending++; }
    else if (a.status === 'approved' && !claimed.has(a.trip_ref)) { committed += a.estimate_cents; nCommitted++; }
  }
  for (const c of claims) if (c.year === year && (c.status === 'submitted' || c.status === 'paid')) spent += c.total_cents;
  return { year, allowance, committed, spent, pending, remaining: allowance - committed - spent, counts: { pending: nPending, committed: nCommitted, claims: claims.filter(c => c.year === year).length } };
}

module.exports = { ROLES, ROLE_LABEL, CAN, can, CODE_CHARS, newCode, normCode, showCode, COSTS, COST_LABEL, parseCosts, cents, budget };
