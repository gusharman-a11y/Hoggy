'use strict';
/* APLS Australia: the provider's own Arlo platform (behind apls.org.au/courses/calendar) exposes a public JSON event API.
   parse(json, { today, verifiedOn }) -> { sessions, skipped }. One request; page with &skip= if Count > top. */
const { slug } = require('./util');

const FIELDS = 'EventID,EventTemplateID,Name,Code,StartDateTime,EndDateTime,Location,IsFull,PlacesRemaining,AdvertisedOffers,RegistrationInfo,ViewUri,Summary';
const SOURCE_URL = `https://apls.arlo.co/api/2012-02-01/pub/resources/eventsearch/?fields=${FIELDS}&top=200`;
const SOURCE_KIND = 'APLS Arlo public event API (provider platform behind apls.org.au/courses/calendar)';

/* Arlo template ids -> course/variant. Names are checked too, so a new year's template still maps. */
function classify(e) {
  const n = String(e.Name || '');
  if (/^\s*refresher\b/i.test(n)) return { courseId: 'apls', variant: 'refresher' };
  if (/^\s*APLS\b/.test(n)) return { courseId: 'apls', variant: 'full' };
  if (/^\s*PLS\b/.test(n)) return { courseId: 'pls', variant: 'full' };
  return null;
}

function parse(json, { today, verifiedOn = today } = {}) {
  const items = (json && json.Items) || [], sessions = [], skipped = [];
  for (const e of items) {
    const kind = classify(e);
    if (!kind) { skipped.push({ reason: 'unknown course', name: e.Name }); continue; }
    const start = String(e.StartDateTime || '').slice(0, 10), end = String(e.EndDateTime || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) { skipped.push({ reason: 'no dates', name: e.Name }); continue; }
    if (end < today) { skipped.push({ reason: 'finished', name: e.Name }); continue; }
    const m = String(e.Name).match(/^\s*(?:APLS|REFRESHER|Refresher|PLS)\s*-\s*(.+?)\s+\d/);
    const L = e.Location || {}, region = String(L.State || '').toUpperCase();
    const city = m ? m[1].trim() : (L.City || L.Suburb || '');
    const ri = e.RegistrationInfo || {};
    const seatsStatus = /waiting/i.test(ri.RegisterMessage || '') ? 'waitlist' : e.IsFull ? 'full' : 'open';
    const offers = (e.AdvertisedOffers || []).map(o => o.OfferAmount).filter(Boolean);
    const venue = [L.VenueName, L.StreetLine1, L.Suburb || L.City, region, L.PostCode].filter(Boolean).join(', ');
    sessions.push({
      id: slug(kind.courseId, kind.variant, region, city, start), courseId: kind.courseId, variant: kind.variant,
      provider: 'APLS Australia', city, region, country: 'AU', venue: venue || null, start, end, endInferred: false,
      priceFrom: offers.length ? Math.min(...offers.map(o => o.AmountTaxInclusive)) : null,
      currency: offers.length ? offers[0].CurrencyCode : null,
      ...(offers.length && kind.courseId === 'apls' ? { priceNote: 'lowest advertised offer on the event (APLS course page lists Doctors $3300 / Nurse-Paramedic $1920 for the 3-day course)' } : offers.length ? { priceNote: 'lowest advertised offer on the event' } : {}),
      seatsStatus, placesRemaining: e.PlacesRemaining == null ? null : e.PlacesRemaining,
      bookingUrl: ri.RegisterUri || e.ViewUri, sourceUrl: SOURCE_URL, coursePage: e.ViewUri,
      datesQuote: `${e.Name} | StartDateTime ${String(e.StartDateTime).slice(0, 16)} | EndDateTime ${String(e.EndDateTime).slice(0, 16)}`,
      lastVerified: verifiedOn, datesConfirmed: true, sourceKind: SOURCE_KIND, sourceRef: 'arlo:' + e.EventID
    });
  }
  return { sessions, skipped, total: items.length, count: json && json.Count };
}

module.exports = { parse, SOURCE_URL, FIELDS, SOURCE_KIND, classify };
