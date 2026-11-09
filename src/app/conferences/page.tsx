import Link from "next/link";
import { conferenceFacets, searchConferences } from "@/lib/conferences";
import { filtersFromParams, type SearchParams } from "@/lib/conference-query";
import { formatDateRange, todayIso } from "@/lib/format";

export const metadata = { title: "Conferences · StudyLeave" };

export default async function ConferencesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = filtersFromParams(await searchParams, todayIso());
  const results = searchConferences(filters);
  const { specialties, countries } = conferenceFacets();
  const filtered = Boolean(filters.q || filters.specialty || filters.country || filters.month);

  return (
    <main>
      <h1>Conferences</h1>
      <form method="get" action="/conferences" className="filters" role="search">
        <label>
          Search
          <input type="search" name="q" defaultValue={filters.q} placeholder="Name, city, topic…" />
        </label>
        <label>
          Specialty
          <select name="specialty" defaultValue={filters.specialty}>
            <option value="">Any specialty</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Country
          <select name="country" defaultValue={filters.country}>
            <option value="">Any country</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Month
          <input type="month" name="month" defaultValue={filters.month} />
        </label>
        <div className="filter-actions">
          <button type="submit">Search</button>
          {filtered && <Link href="/conferences">Clear</Link>}
        </div>
      </form>

      <p className="muted" data-testid="result-count">
        {results.length} upcoming conference{results.length === 1 ? "" : "s"}
      </p>

      {results.length === 0 ? (
        <p className="empty">No conferences match your search. Try fewer filters.</p>
      ) : (
        <ul className="conf-list">
          {results.map((c) => (
            <li key={c.id} className="conf-card">
              <h2>
                <Link href={`/conferences/${c.slug}`}>{c.name}</Link>
              </h2>
              <p className="conf-meta">
                <span>{formatDateRange(c.start_date, c.end_date)}</span>
                <span>{[c.city, c.country].filter(Boolean).join(", ") || "Location TBC"}</span>
                <span>{c.specialty}</span>
                <span>{c.cpd_points != null ? `${c.cpd_points} CPD points` : "CPD points TBC"}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
