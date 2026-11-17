'use strict';
/* Merge freshly parsed sessions into the existing list.
   - match: same sourceRef (provider event id), else same id, else same course/variant/region/provider/start
   - matched: id and city kept (city is a display label); everything else refreshed; venue kept unless the venue name changed
   - unmatched fresh rows: added (id made unique)
   - existing rows: finished -> removed ('finished'); from a source read in full this run but no longer listed -> removed
     ('no longer listed'); from a source that failed this run -> kept as they were
   merge(old, fresh, { today, readSources, sourceKeyOf }) -> { sessions, added, updated, removed, kept, unchanged } */

const META = new Set(['lastVerified', 'sourceRef']);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const natKey = s => [s.courseId, s.variant, s.region, norm(s.provider), s.start].join('|');
const venueName = v => norm(String(v || '').split(',')[0]);

function diff(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (META.has(k)) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out[k] = [a[k] === undefined ? null : a[k], b[k] === undefined ? null : b[k]];
  }
  return out;
}

function merge(oldList, fresh, { today, readSources, sourceKeyOf }) {
  const byRef = new Map(), byId = new Map(), byKey = new Map();
  for (const s of oldList) {
    if (s.sourceRef) byRef.set(s.sourceRef, s);
    byId.set(s.id, s);
    const k = natKey(s); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(s);
  }
  const used = new Set(), out = [], added = [], updated = [], unchanged = [];
  const ids = new Set(oldList.map(s => s.id));
  for (const n of fresh) {
    let o = (n.sourceRef && byRef.get(n.sourceRef)) || null;
    if (o && used.has(o.id)) o = null;
    if (!o && byId.has(n.id) && !used.has(n.id) && byId.get(n.id).courseId === n.courseId) o = byId.get(n.id);
    if (!o) {
      const c = (byKey.get(natKey(n)) || []).filter(x => !used.has(x.id));
      o = c.find(x => venueName(x.venue) === venueName(n.venue)) || c[0] || null;
    }
    if (o) {
      used.add(o.id);
      const m = { ...n, id: o.id, city: o.city };
      if (o.venue && n.venue && venueName(o.venue) === venueName(n.venue)) m.venue = o.venue;
      const d = diff(o, m);
      (Object.keys(d).length ? updated : unchanged).push({ id: m.id, changes: d });
      out.push(m);
    } else {
      let id = n.id, i = 2;
      while (ids.has(id)) id = `${n.id}-${i++}`;
      ids.add(id);
      const m = { ...n, id };
      added.push(m); out.push(m);
    }
  }
  const removed = [], kept = [];
  for (const o of oldList) {
    if (used.has(o.id)) continue;
    if (o.end < today) removed.push({ ...o, reason: 'finished' });
    else if (readSources.has(sourceKeyOf(o))) removed.push({ ...o, reason: 'no longer listed on the source page (cancelled, moved or unlisted)' });
    else { kept.push(o); out.push(o); }
  }
  out.sort((a, b) => (a.start + a.courseId + a.region + a.city + a.id).localeCompare(b.start + b.courseId + b.region + b.city + b.id));
  return { sessions: out, added, updated, removed, kept, unchanged };
}

module.exports = { merge, diff, natKey };
