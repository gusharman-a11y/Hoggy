import Link from "next/link";
import { listPendingApprovals } from "@/lib/approvals";
import { getTripForViewer } from "@/lib/trips";
import { requireRole } from "@/lib/auth";
import { formatDateRange, formatMoney } from "@/lib/format";
import DecisionForm from "./DecisionForm";

export const metadata = { title: "Approvals · StudyLeave" };

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["manager", "admin"], "/approvals");
  const pending = listPendingApprovals(user);
  const params = await searchParams;
  const decidedId = Number(params.trip);
  const decided =
    (params.decided === "approved" || params.decided === "rejected") && Number.isInteger(decidedId)
      ? getTripForViewer(decidedId, user)
      : undefined;

  return (
    <main>
      <h1>Approvals</h1>
      {decided && decided.status === params.decided && (
        <p className="notice" role="status">
          {params.decided === "approved" ? "Approved" : "Rejected"}: {decided.owner_name}’s trip to{" "}
          {decided.conference_name}. They’ve been emailed.
        </p>
      )}
      <p className="muted">Trips in your hospital waiting for a decision. Budgets are for the year each conference starts.</p>
      {pending.length === 0 ? (
        <p className="empty">Nothing waiting for approval.</p>
      ) : (
        <ul className="conf-list" data-testid="approval-list">
          {pending.map(({ trip, estimateCents, year, remainingCents, remainingAfterCents }) => (
            <li key={trip.id} className="conf-card" data-testid={`approval-${trip.id}`}>
              <h2>
                <Link href={`/trips/${trip.id}`}>{trip.conference_name}</Link>
              </h2>
              <p className="conf-meta">
                <span>{trip.owner_name}</span>
                <span>{formatDateRange(trip.conference_start, trip.conference_end)}</span>
                <span>{[trip.conference_city, trip.conference_country].filter(Boolean).join(", ")}</span>
              </p>
              <dl className="facts">
                <dt>Estimated cost</dt>
                <dd data-testid="approval-cost">{formatMoney(estimateCents, trip.currency)}</dd>
                <dt>{year} budget remaining</dt>
                <dd data-testid="approval-remaining">{formatMoney(remainingCents, trip.currency)}</dd>
                <dt>Left if approved</dt>
                <dd data-testid="approval-after" className={remainingAfterCents < 0 ? "error" : undefined}>
                  {formatMoney(remainingAfterCents, trip.currency)}
                </dd>
                {trip.notes && (
                  <>
                    <dt>Notes</dt>
                    <dd>{trip.notes}</dd>
                  </>
                )}
              </dl>
              {trip.manager_comment && (
                <p className="muted small">Earlier comment: {trip.manager_comment}</p>
              )}
              <DecisionForm tripId={trip.id} label={trip.owner_name} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
