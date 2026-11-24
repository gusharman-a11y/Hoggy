'use strict';
/* Helpers for the resus/emergency x10 parsers (no network). */
const NZ = {
  auckland: 'Auckland', albany: 'Auckland', 'north shore': 'Auckland', pukekohe: 'Auckland', rosedale: 'Auckland',
  hamilton: 'Waikato', cambridge: 'Waikato', thames: 'Waikato', 'te rapa': 'Waikato',
  tauranga: 'Bay of Plenty', rotorua: 'Bay of Plenty', whangarei: 'Northland', kerikeri: 'Northland',
  'palmerston north': 'Manawatu-Whanganui', whanganui: 'Manawatu-Whanganui', 'new plymouth': 'Taranaki',
  napier: 'Hawkes Bay', hastings: 'Hawkes Bay', gisborne: 'Gisborne',
  wellington: 'Wellington', 'lower hutt': 'Wellington', 'upper hutt': 'Wellington', porirua: 'Wellington', masterton: 'Wellington',
  nelson: 'Nelson', richmond: 'Nelson', blenheim: 'Marlborough', greymouth: 'West Coast',
  christchurch: 'Canterbury', timaru: 'Canterbury', ashburton: 'Canterbury',
  dunedin: 'Otago', queenstown: 'Otago', invercargill: 'Southland',
  'mangawhai heads': 'Northland', fairlie: 'Canterbury', rangiora: 'Canterbury', kaikoura: 'Canterbury', motueka: 'Nelson',
  wanaka: 'Otago', kinloch: 'Waikato', taupo: 'Waikato', cromwell: 'Otago', alexandra: 'Otago', 'te anau': 'Southland'
};
const nzRegion = city => NZ[String(city || '').trim().toLowerCase()] || null;

/* "23.11.2026" -> "2026-11-23" */
function dotDate(s) {
  const m = String(s || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const t = new Date(iso + 'T00:00:00Z');
  return !isNaN(t) && t.toISOString().slice(0, 10) === iso ? iso : null;
}

module.exports = { nzRegion, dotDate };
