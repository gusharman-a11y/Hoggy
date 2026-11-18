'use strict';
/* Generic parser for a provider's own Arlo platform (public event API, same shape as tools/courses/arlo.js):
   https://<account>.arlo.co/api/2012-02-01/pub/resources/eventsearch/?fields=...&top=200
   parse(json, source, { today, verifiedOn }) -> { sessions, skipped }.
   source = { account, provider, country, sourceKind, rules: [{ re, courseId, variant }], region?(L, e) }
   Only events whose Name matches a rule become sessions; everything else is reported in skipped. */
const { slug } = require('../util');
const { nzRegion } = require('./resus-util');

const FIELDS = 'EventID,EventTemplateID,Name,Code,StartDateTime,EndDateTime,Location,IsFull,PlacesRemaining,AdvertisedOffers,RegistrationInfo,ViewUri,Summary';
const apiUrl = account => `https://${account}.arlo.co/api/2012-02-01/pub/resources/eventsearch/?fields=${FIELDS}&top=200`;

function parse(json, source, { today, verifiedOn = today } = {}) {
  const items = (json && json.Items) || [], sessions = [], skipped = [];
  for (const e of items) {
    const rule = source.rules.find(r => r.re.test(String(e.Name || '')));
    if (!rule) { skipped.push({ reason: 'not in scope', name: e.Name }); continue; }
    const start = String(e.StartDateTime || '').slice(0, 10), end = String(e.EndDateTime || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) { skipped.push({ reason: 'no dates', name: e.Name }); continue; }
    if (end < today) { skipped.push({ reason: 'finished', name: e.Name }); continue; }
    const L = e.Location || {};
    if (L.IsOnline || !(L.City || L.Name)) { skipped.push({ reason: 'online or no venue', name: e.Name, start }); continue; }
    const cityRaw = String(L.City || L.Name).trim().replace(/,\s*(WA|SA|QLD|NSW|VIC|TAS|ACT|NT)$/i, '');
    const city = cityRaw.replace(/^North Shore,\s*/i, '');
    const region = source.country === 'NZ' ? nzRegion(city) : String(L.State || '').toUpperCase();
    if (!region) { skipped.push({ reason: 'region unknown', name: e.Name, city }); continue; }
    const ri = e.RegistrationInfo || {};
    const seatsStatus = /waiting/i.test(ri.RegisterMessage || '') ? 'waitlist' : e.IsFull ? 'full' : 'open';
    const offers = (e.AdvertisedOffers || []).map(o => o.OfferAmount).filter(Boolean);
    const venue = [String(L.VenueName || '').trim(), String(L.StreetLine1 || '').trim(), L.Suburb, L.State, L.PostCode].filter(Boolean).join(', ');
    const bookingUrl = /^https:\/\//.test(ri.RegisterUri || '') ? ri.RegisterUri : /^https:\/\//.test(e.ViewUri || '') ? e.ViewUri : apiUrl(source.account);
    sessions.push({
      id: slug(rule.courseId, rule.variant === 'full' ? null : rule.variant, region, city, start, source.idTag || source.provider),
      courseId: rule.courseId, variant: rule.variant, provider: source.provider,
      city, region, country: source.country, venue: venue || null, start, end, endInferred: false,
      priceFrom: offers.length ? Math.min(...offers.map(o => o.AmountTaxInclusive)) : null,
      currency: offers.length ? offers[0].CurrencyCode : null,
      ...(offers.length ? { priceNote: 'lowest advertised offer on the event, tax inclusive' } : {}),
      seatsStatus, placesRemaining: e.PlacesRemaining == null ? null : e.PlacesRemaining,
      bookingUrl, sourceUrl: apiUrl(source.account), ...(/^https:\/\//.test(e.ViewUri || '') ? { coursePage: e.ViewUri } : {}),
      datesQuote: `${e.Name} | StartDateTime ${String(e.StartDateTime).slice(0, 16)} | EndDateTime ${String(e.EndDateTime).slice(0, 16)}`.slice(0, 200),
      lastVerified: verifiedOn, datesConfirmed: true, sourceKind: source.sourceKind, sourceRef: `arlo:${source.account}:${e.EventID}`,
      ...(rule.note ? { note: rule.note } : {})
    });
  }
  return { sessions, skipped, total: items.length, count: json && json.Count };
}

module.exports = { parse, apiUrl, FIELDS };
