import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatDateRange, formatMoney } from "@/lib/format";
import { listTripsForViewer, TRIP_STATUS_LABELS, tripEstimateTotal } from "@/lib/trips";

export const metadata = { title: "Trips · StudyLeave" };

export default async function TripsPage() {
  const user = await requireRole([], "/trips");
  const trips = listTripsForViewer(user);
  const isDoctor = user.role === "doctor";

  return (
    <main>
      <h1>{isDoctor ? "My trips" : "Trips"}</h1>
      {!isDoctor && <p className="muted">All trips in your hospital.</p>}
      {trips.length === 0 ? (
        <p className="empty">
          No trips yet. <Link href="/conferences">Find a conference</Link> and click “Plan trip”.
        </p>
      ) : (
        <ul className="conf-list" data-testid="trip-list">
          {trips.map((t) => (
            <li key={t.id} className="conf-card">
              <h2>
                <Link href={`/trips/${t.id}`}>{t.conference_name}</Link>{" "}
                <span className={`badge badge-${t.status}`}>{TRIP_STATUS_LABELS[t.status]}</span>
              </h2>
              <p className="conf-meta">
                <span>{formatDateRange(t.conference_start, t.conference_end)}</span>
                <span>{[t.conference_city, t.conference_country].filter(Boolean).join(", ")}</span>
                <span>Est. {formatMoney(tripEstimateTotal(t), t.currency)}</span>
                {!isDoctor && <span>{t.owner_name}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
