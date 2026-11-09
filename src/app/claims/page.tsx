import Link from "next/link";
import { getClaimForFinance, listClaims } from "@/claims/finance";
import { requireRole } from "@/lib/auth";
import { formatDate, formatDateRange, formatMoney } from "@/lib/format";
import { TRIP_STATUS_LABELS } from "@/lib/trips";
import MarkPaidForm from "./MarkPaidForm";

export const metadata = { title: "Claims · StudyLeave" };

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["finance", "admin"], "/claims");
  const claims = listClaims(user);
  const params = await searchParams;
  const paidId = Number(params.paid);
  const justPaid = Number.isInteger(paidId) && paidId > 0 ? getClaimForFinance(paidId, user) : undefined;
  const unpaid = claims.filter((c) => c.status === "claimed");
  const owing = unpaid.reduce((sum, c) => sum + c.total_cents, 0);

  return (
    <main>
      <h1>Claims</h1>
      {justPaid && justPaid.status === "paid" && (
        <p className="notice" role="status">
          Marked paid: {justPaid.doctor_name}’s claim for {justPaid.conference_name}. They’ve been emailed.
        </p>
      )}
      <p className="muted">
        Study-leave claims sent to your hospital. {unpaid.length} waiting to be paid
        {unpaid.length > 0 && <> ({formatMoney(owing, "AUD")})</>}.
      </p>
      {claims.length === 0 ? (
        <p className="empty">No claims yet.</p>
      ) : (
        <ul className="conf-list" data-testid="claim-list">
          {claims.map((c) => (
            <li key={c.id} className="conf-card" data-testid={`claim-${c.trip_id}`}>
              <h2>
                <Link href={`/trips/${c.trip_id}`}>{c.conference_name}</Link>{" "}
                <span className={`badge badge-${c.status}`} data-testid="claim-status">
                  {TRIP_STATUS_LABELS[c.status]}
                </span>
              </h2>
              <p className="conf-meta">
                <span>{formatDateRange(c.conference_start, c.conference_end)}</span>
              </p>
              <dl className="facts">
                <dt>Doctor</dt>
                <dd data-testid="claim-doctor">{c.doctor_name}</dd>
                <dt>Total</dt>
                <dd data-testid="claim-total">{formatMoney(c.total_cents, c.currency)}</dd>
                <dt>Sent</dt>
                <dd data-testid="claim-sent-date">{formatDate(c.sent_at)}</dd>
                {c.paid_at && (
                  <>
                    <dt>Paid</dt>
                    <dd data-testid="claim-paid-date">{formatDate(c.paid_at)}</dd>
                  </>
                )}
              </dl>
              <div className="claim-actions">
                <a className="button secondary" href={`/claims/${c.trip_id}/pack`} download data-testid="claim-pack">
                  Download pack
                </a>
                {c.status === "claimed" && <MarkPaidForm tripId={c.trip_id} label={c.doctor_name} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
