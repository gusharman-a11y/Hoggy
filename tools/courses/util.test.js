'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { parseDate, addDays, cleanUrl, slug, text } = require('./util');

test('parseDate: the date shapes the sources print', () => {
  assert.equal(parseDate('November 3, 2026'), '2026-11-03');
  assert.equal(parseDate('13 February 2027'), '2027-02-13');
  assert.equal(parseDate('Saturday 21st Nov 2026'), '2026-11-21');
  assert.equal(parseDate('Wed, 25 Nov 2026'), '2026-11-25');
  assert.equal(parseDate('Sunday 1 Nov'), null, 'no year: not a date');
  assert.equal(parseDate('31 February 2027'), null, 'not a real day');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('cleanUrl: safelinks unwrapped, ad tracking dropped, http refused', () => {
  const s = cleanUrl('https://aus01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fadvancedlifesupport.com.au%2Fbook-now%2F&amp;data=05');
  assert.equal(s.url, 'https://advancedlifesupport.com.au/book-now/'); assert.match(s.note, /safelinks/);
  const t = cleanUrl('https://www.stjohnwa.com.au/als1-course?gad_source=1&amp;gclid=abcinfo@resus.org.au');
  assert.equal(t.url, 'https://www.stjohnwa.com.au/als1-course'); assert.match(t.note, /tracking/);
  assert.equal(cleanUrl('http://example.com/x').url, null);
  assert.equal(cleanUrl('mailto:a@b.c').url, null);
  assert.equal(cleanUrl('https://a.example/x?id=5').url, 'https://a.example/x?id=5');
});

test('slug and text', () => {
  assert.equal(slug('als2', 'NSW', 'Coffs Harbour', '2027-04-17'), 'als2-nsw-coffs-harbour-2027-04-17');
  assert.equal(text('<p>Starts: May 1, 2027<br>Ends:&nbsp;May 2, 2027</p>'), 'Starts: May 1, 2027\nEnds: May 2, 2027');
});
