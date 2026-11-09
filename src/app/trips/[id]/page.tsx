import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { centsToInput, formatDateRange, formatDate, formatMoney } from "@/lib/format";
import { canEditTrip, getTripForViewer, TRIP_STATUS_LABELS, tripEstimateTotal } from "@/lib/trips";
import { canDecideTrip, canSubmitTrip } from "@/lib/approvals";
import { canBookTravel } from "@/lib/flight-booking";
import { describeBooking, formatAbn, listBookings, listReceipts, RECEIPT_STATUS_LABELS } from "@/lib/receipts";
import { canDeleteReceipt, canEditReceipt, canUploadReceipt } from "@/lib/receipt-uploads";
import { inboundAddress } from "@/lib/inbound-email";
import { canSendClaim, getClaimForTrip } from "@/claims/send";
import { getDb } from "@/db";
import { getOrg } from "@/lib/users";
import { deleteReceiptAction } from "../../receipt-actions";
import DecisionForm from "../../approvals/DecisionForm";
import SubmitForApproval from "./SubmitForApproval";
import TripForm from "./TripForm";
import SendClaimForm from "./SendClaimForm";
import UploadReceiptForm from "./UploadReceiptForm";
import EditReceiptForm from "./EditReceiptForm";
import SnapReceiptForm from "./SnapReceiptForm";
import CheckReceiptCard from "./CheckReceiptCard";

export const metadata = { title: "Trip · StudyLeave" };

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { booked, receipt: receiptFlag, claim: claimFlag } = await searchParams;
  const user = await requireRole([], `/trips/${id}`);
  const tripId = Number(id);
  // Not found and not allowed look the same, so trip ids from other orgs/doctors don't leak.
  const trip = Number.isInteger(tripId) && tripId > 0 ? getTripForViewer(tripId, user) : undefined;
  if (!trip) notFound();

  const editable = canEditTrip(trip, user);
  const total = tripEstimateTotal(trip);
  const bookings = listBookings(trip.id);
  const receipts = listReceipts(trip.id);
  const canBook = canBookTravel(trip, user);
  const canUpload = canUploadReceipt(trip, user);
  const canEditReceipts = canEditReceipt(trip, user);
  const toCheck = canEditReceipts ? receipts.filter((r) => r.status === "needs_review") : [];
  const canClaim = canSendClaim(trip, user) && receipts.length > 0;
  const claim = getClaimForTrip(trip.id);
  const financeEmail = canClaim ? (getOrg(getDb(), trip.org_id)?.finance_email ?? null) : null;
  const foreignFee = trip.conference_fee_cents != null && trip.conference_currency !== trip.currency;

  return (
    <main className="narrow">
      <p>
        <Link href="/trips">← My trips</Link>
      </p>
      <h1>Trip to {trip.conference_name}</h1>
      <p>
        <span className={`badge badge-${trip.status}`} data-testid="trip-status">
          {TRIP_STATUS_LABELS[trip.status]}
        </span>
        {trip.user_id !== user.id && <span className="muted"> · {trip.owner_name}</span>}
      </p>
      {booked === "flight" && (
        <p role="status" className="notice">
          Flight booked. The receipt has been added to this trip.
        </p>
      )}
      {booked === "hotel" && (
        <p role="status" className="notice">
          Hotel booked. The receipt has been added to this trip.
        </p>
      )}

      {claimFlag === "sent" && claim && (
        <p role="status" className="notice">
          Claim sent to {claim.to_addr}. A copy went to you.
        </p>
      )}

      {receiptFlag === "added" && (
        <p role="status" className="notice">
          Receipt uploaded.
        </p>
      )}
      {receiptFlag === "snapped" && (
        <p role="status" className="notice">
          Receipt saved. Check the details below.
        </p>
      )}
      {receiptFlag === "confirmed" && (
        <p role="status" className="notice">
          Receipt checked and saved.
        </p>
      )}
      {receiptFlag === "deleted" && (
        <p role="status" className="notice">
          Receipt deleted.
        </p>
      )}
      {receiptFlag === "updated" && (
        <p role="status" className="notice">
          Receipt updated.
        </p>
      )}
      {receiptFlag === "denied" && <p className="error">You can only delete receipts you uploaded.</p>}

      <dl className="facts" data-testid="trip-conference">
        <dt>Conference</dt>
        <dd>
          <Link href={`/conferences/${trip.conference_slug}`}>{trip.conference_name}</Link>
        </dd>
        <dt>Dates</dt>
        <dd>{formatDateRange(trip.conference_start, trip.conference_end)}</dd>
        <dt>Where</dt>
        <dd>{[trip.conference_city, trip.conference_country].filter(Boolean).join(", ") || "TBC"}</dd>
        <dt>Conference fee</dt>
        <dd>{formatMoney(trip.conference_fee_cents, trip.conference_currency)}</dd>
      </dl>
      {foreignFee && editable && (
        <p className="muted">
          The registration estimate was converted to {trip.currency} at an indicative rate. Please check it.
        </p>
      )}

      <h2>Plan</h2>
      {editable ? (
        <TripForm
          tripId={trip.id}
          defaults={{
            departCity: trip.depart_city ?? "",
            notes: trip.notes ?? "",
            registration: centsToInput(trip.est_registration_cents),
            flights: centsToInput(trip.est_flights_cents),
            hotel: centsToInput(trip.est_hotel_cents),
            other: centsToInput(trip.est_other_cents),
          }}
        />
      ) : (
        <dl className="facts">
          <dt>Departure city</dt>
          <dd>{trip.depart_city || "—"}</dd>
          <dt>Registration</dt>
          <dd>{formatMoney(trip.est_registration_cents, trip.currency)}</dd>
          <dt>Flights</dt>
          <dd>{formatMoney(trip.est_flights_cents, trip.currency)}</dd>
          <dt>Hotel</dt>
          <dd>{formatMoney(trip.est_hotel_cents, trip.currency)}</dd>
          <dt>Other costs</dt>
          <dd>{formatMoney(trip.est_other_cents, trip.currency)}</dd>
          <dt>Notes</dt>
          <dd>{trip.notes || "—"}</dd>
        </dl>
      )}
      <p className="total" data-testid="trip-total">
        Estimated total: <strong>{formatMoney(total, trip.currency)}</strong>
      </p>
      {trip.manager_comment && (
        <p className="notice" data-testid="manager-comment">
          <strong>Manager&apos;s comment:</strong> {trip.manager_comment}
        </p>
      )}
      {trip.status === "pending_approval" && trip.user_id === user.id && (
        <p className="muted">Waiting for your manager to approve this trip. They’ve been emailed.</p>
      )}
      {canSubmitTrip(trip, user) && <SubmitForApproval tripId={trip.id} resubmit={trip.status === "rejected"} />}
      {canDecideTrip(trip, user) && (
        <>
          <h2>Decision</h2>
          <DecisionForm tripId={trip.id} label={trip.owner_name} from="trip" />
        </>
      )}

      {(canBook || bookings.length > 0) && (
        <>
          <h2>Bookings</h2>
          {bookings.length === 0 && <p className="muted">Nothing booked yet.</p>}
          <ul className="bookings" data-testid="bookings">
            {bookings.map((b) => (
              <li key={b.id} data-testid={`booking-${b.kind}`}>
                <strong>{b.kind === "flight" ? "Flight" : "Hotel"}</strong> · ref{" "}
                <span data-testid="booking-reference">{b.reference}</span> · {formatMoney(b.total_cents, b.currency)}
                {describeBooking(b).map((l) => (
                  <div key={l} className="muted">
                    {l}
                  </div>
                ))}
              </li>
            ))}
          </ul>
          {canBook && (
            <p>
              <Link className="button" href={`/trips/${trip.id}/flights`}>
                Find flights
              </Link>
              {" "}
              <Link className="button" href={`/trips/${trip.id}/hotels`}>
                Find hotels
              </Link>
            </p>
          )}
        </>
      )}

      {(receipts.length > 0 || canUpload) && (
        <>
          <h2>Receipts</h2>
          {canUpload && <SnapReceiptForm tripId={trip.id} />}
          {toCheck.map((r) => (
            <CheckReceiptCard
              key={r.id}
              tripId={trip.id}
              receiptId={r.id}
              currency={r.currency}
              fileName={r.original_name || r.description || "Receipt"}
              viewHref={r.file_path ? `/trips/${trip.id}/receipts/${r.id}` : null}
              defaults={{
                supplier: r.supplier_name ?? "",
                abn: formatAbn(r.supplier_abn) || (r.supplier_abn ?? ""),
                gst: r.gst_cents == null ? "" : centsToInput(r.gst_cents),
                amount: r.amount_cents ? centsToInput(r.amount_cents) : "",
                date: r.receipt_date ?? "",
                kind: r.kind,
              }}
            />
          ))}
          {receipts.length === 0 && <p className="muted">No receipts yet.</p>}
          <ul className="receipts" data-testid="receipts">
            {receipts.map((r) => (
              <li key={r.id} data-testid="receipt">
                <span>
                  {r.description || r.kind} · {formatMoney(r.amount_cents, r.currency)}
                  {r.source === "upload" && <span className="muted"> · uploaded</span>}
                  {r.source === "email" && <span className="muted"> · emailed</span>}
                  {r.status === "needs_review" && (
                    <>
                      {" "}
                      <span className="badge badge-needs_review" data-testid="receipt-status">
                        {RECEIPT_STATUS_LABELS[r.status]}
                      </span>
                    </>
                  )}
                </span>
                <span className="receipt-actions">
                  {r.file_path && (
                    <>
                      <a href={`/trips/${trip.id}/receipts/${r.id}`}>View</a>
                      <a href={`/trips/${trip.id}/receipts/${r.id}?download=1`}>Download</a>
                    </>
                  )}
                  {canDeleteReceipt(r, trip, user) && (
                    <form action={deleteReceiptAction.bind(null, trip.id, r.id)}>
                      <button type="submit" className="link danger" aria-label={`Delete ${r.description}`}>
                        Delete
                      </button>
                    </form>
                  )}
                </span>
                {canEditReceipts && r.status !== "needs_review" && (
                  <EditReceiptForm
                    tripId={trip.id}
                    receiptId={r.id}
                    description={r.description || ""}
                    amount={centsToInput(r.amount_cents)}
                    currency={r.currency}
                  />
                )}
              </li>
            ))}
          </ul>
          {receipts.length > 0 && (
            <p>
              <a className="button secondary" href={`/trips/${trip.id}/claim-pack`} data-testid="claim-pack-preview" download>
                Preview claim pack
              </a>{" "}
              <span className="muted">One PDF: cover sheet, claim form and every receipt.</span>
            </p>
          )}
          {canUpload && (
            <>
              <h3>Add a receipt by hand</h3>
              <p className="muted">Taxis, meals, registration — anything you paid for yourself. Type the details yourself.</p>
              <UploadReceiptForm tripId={trip.id} />
              <h3>Or forward it by email</h3>
              <p className="inbound" data-testid="inbound-address">
                Forward receipt emails from <strong>your account email</strong> to{" "}
                <code>{inboundAddress(trip.inbound_code)}</code>
              </p>
              <p className="muted">PDF, JPG and PNG attachments are added here, with the email subject as the description and no amount yet. Use Edit to add the amount.</p>
            </>
          )}
        </>
      )}

      {(canClaim || claim) && (
        <>
          <h2>Claim</h2>
          {claim ? (
            <p data-testid="claim-sent">
              Sent to <strong>{claim.to_addr}</strong> on {formatDate(claim.sent_at)} ·{" "}
              {formatMoney(claim.total_cents, claim.currency)} · {claim.receipt_count}{" "}
              {claim.receipt_count === 1 ? "receipt" : "receipts"}
              {claim.paid_at && <> · paid on {formatDate(claim.paid_at)}</>}
            </p>
          ) : (
            <SendClaimForm tripId={trip.id} financeEmail={financeEmail} />
          )}
        </>
      )}
    </main>
  );
}
