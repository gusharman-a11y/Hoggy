const test = require('node:test'), assert = require('node:assert');
const { evaluate, leaveDays, buildEml } = require('../pack.js');
const home = r => r.amount;
/* Fixture limits only. These are NOT any real employer's policy. */
const emp = { hotelPerNight: 250, mealsPerDay: 80, perReceipt: { Flights: 2000 }, clause: 'Fixture policy s4.2', claimDays: 36500 };
const hotel = (amount, nights, extra) => ({ id: 'h', vendor: 'Hotel', category: 'Accommodation', date: '2027-04-12', amount, nights, ...extra });

test('hotel per-night limit: 3 nights at 300 passes a 350 limit and fails a 250 limit', () => {
  assert.equal(evaluate([hotel(900, 3)], {}, { hotelPerNight: 350 }, home).length, 0);
  const f = evaluate([hotel(900, 3)], {}, { hotelPerNight: 250, clause: 'Policy s1' }, home);
  assert.equal(f.length, 1); assert.equal(f[0].lvl, 'bad'); assert.match(f[0].t, /Policy s1/);
});
test('a justification downgrades an over-limit to a warning', () => {
  assert.equal(evaluate([hotel(900, 3, { excuse: 'Conference hotel, no cheaper option' })], {}, emp, home)[0].lvl, 'warn');
});
test('personal portion is excluded before checking the limit', () => {
  assert.equal(evaluate([hotel(900, 3, { personal: 150 })], {}, emp, home).length, 0);
});
test('missing nights asks for it instead of guessing', () => {
  const f = evaluate([hotel(900, 0)], {}, emp, home); assert.equal(f[0].lvl, 'bad'); assert.match(f[0].t, /number of nights/);
});
test('meals are summed per day', () => {
  const m = (id, amount) => ({ id, vendor: 'Cafe', category: 'Meals', date: '2027-04-12', amount });
  assert.equal(evaluate([m('a', 40), m('b', 39)], {}, emp, home).length, 0);
  const f = evaluate([m('a', 50), m('b', 40)], {}, emp, home); assert.equal(f.length, 1); assert.match(f[0].t, /daily limit/);
});
test('per-receipt category limit', () => {
  assert.equal(evaluate([{ id: 'f', vendor: 'Airline', category: 'Flights', amount: 2500 }], {}, emp, home)[0].lvl, 'bad');
  assert.equal(evaluate([{ id: 'f', vendor: 'Airline', category: 'Flights', amount: 1500 }], {}, emp, home).length, 0);
});
test('no limits entered means no findings (no defaults)', () => {
  assert.deepEqual(evaluate([hotel(9000, 1)], {}, {}, home), []);
});
test('claim deadline warns only when passed', () => {
  assert.equal(evaluate([], { end: '2020-01-02' }, { claimDays: 30 }, home).length, 1);
  assert.equal(evaluate([], { end: '2999-01-02' }, { claimDays: 30 }, home).length, 0);
});
test('leave days: weekdays only, with travel buffer', () => {
  assert.equal(leaveDays('2027-04-14', '2027-04-17', 0, 0), 3, 'Wed to Sat = Wed Thu Fri');
  assert.equal(leaveDays('2027-04-14', '2027-04-17', 1, 1), 4, 'Tue to Sun = Tue Wed Thu Fri');
});
test('.eml draft: headers, unsent flag, attachment round-trips byte-identical', () => {
  const data = new Uint8Array(1000).map((_, i) => i % 251);
  const eml = buildEml({ to: 'claims@hospital.example', subject: 'Expense claim – Dr A – ESC', body: 'Hello\nWorld', attachments: [{ name: 'R1 Hotel.pdf', type: 'application/pdf', data }] });
  assert.match(eml, /^X-Unsent: 1\r\nTo: claims@hospital.example\r\n/); assert.match(eml, /Subject: =\?UTF-8\?B\?/); assert.match(eml, /filename="R1 Hotel.pdf"/);
  const b = eml.split('\r\n').find(l => l.startsWith('Content-Type: multipart/mixed')).match(/boundary="([^"]+)"/)[1];
  const part = eml.split('--' + b)[2], payload = part.split('\r\n\r\n')[1].replace(/\r\n/g, '');
  assert.ok(Buffer.from(payload, 'base64').equals(Buffer.from(data)));
  assert.ok(eml.trimEnd().endsWith('--' + b + '--'));
});
test('a general note does NOT excuse a breach; only a justification does', () => {
  assert.equal(evaluate([hotel(900, 3, { note: 'ref 123' })], {}, emp, home)[0].lvl, 'bad');
});
test('blank nights with a hotel limit blocks (cannot be checked)', () => {
  assert.equal(evaluate([hotel(3000, 0)], {}, emp, home)[0].lvl, 'bad');
});
