import Link from "next/link";
import { getDb } from "@/db";
import BudgetCard from "@/components/BudgetCard";
import HoggyInbox from "@/components/HoggyInbox";
import UnfiledReceipts from "@/components/UnfiledReceipts";
import { requireRole } from "@/lib/auth";
import { defaultBudgetYear, getBudget, tripYearsForUser } from "@/lib/budget";
import { formatDateRange, formatMoney } from "@/lib/format";
import { personalInboxAddress } from "@/lib/inbound-email";
import { listUnfiledReceipts } from "@/lib/unfiled-receipts";
import { getInboxCode } from "@/lib/users";
import { listTripsForViewer, TRIP_STATUS_LABELS, tripEstimateTotal } from "@/lib/trips";
import { yearFromParam } from "@/lib/year-param";

export const metadata = { title: "Dashboard · StudyLeave" };

const RECENT = 5;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole([], "/dashboard");
  const db = getDb();
  const currentYear = new Date().getUTCFullYear();
  const tripYears = tripYearsForUser(db, user.id);
  const year = yearFromParam((await searchParams).year) ?? defaultBudgetYear(tripYears, currentYear);
  const years = Array.from(new Set([currentYear, ...tripYears, year])).sort((a, b) => a - b);
  const budget = getBudget(user, year, db);
  const trips = listTripsForViewer(user, db).slice(0, RECENT);
  const isDoctor = user.role === "doctor";
  const inboxCode = getInboxCode(db, user.id);
  // Always the viewer's own: unfiled receipts are private to the doctor they were sent by.
  const unfiled = listUnfiledReceipts(user.id, db);

  return (
    <main>
      <h1>Dashboard</h1>
      {years.length > 1 && (
        <nav className="year-tabs" aria-label="Budget year">
          {years.map((y) =>
            y === year ? (
              <strong key={y} aria-current="page">
                {y}
              </strong>
            ) : (
              <Link key={y} href={`/dashboard?year=${y}`}>
                {y}
              </Link>
            ),
          )}
        </nav>
      )}
      <BudgetCard budget={budget} />
      {inboxCode && <HoggyInbox address={personalInboxAddress(inboxCode)} />}
      {(isDoctor || unfiled.length > 0) && <UnfiledReceipts receipts={unfiled} />}

      <h2>{isDoctor ? "Recent trips" : "Recent trips in your hospital"}</h2>
      {trips.length === 0 ? (
        <p className="empty">
          No trips yet. <Link href="/conferences">Find a conference</Link> and click “Plan trip”.
        </p>
      ) : (
        <>
          <ul className="conf-list" data-testid="recent-trips">
            {trips.map((t) => (
              <li key={t.id} className="conf-card">
                <h2>
                  <Link href={`/trips/${t.id}`}>{t.conference_name}</Link>{" "}
                  <span className={`badge badge-${t.status}`}>{TRIP_STATUS_LABELS[t.status]}</span>
                </h2>
                <p className="conf-meta">
                  <span>{formatDateRange(t.conference_start, t.conference_end)}</span>
                  <span>Est. {formatMoney(tripEstimateTotal(t), t.currency)}</span>
                  {!isDoctor && <span>{t.owner_name}</span>}
                </p>
              </li>
            ))}
          </ul>
          <p>
            <Link href="/trips">All trips →</Link>
          </p>
        </>
      )}
    </main>
  );
}
