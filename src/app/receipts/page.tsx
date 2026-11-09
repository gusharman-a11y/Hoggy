import Link from "next/link";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { centsToInput, formatDate, formatMoney } from "@/lib/format";
import { listMoveTargets, listReceiptsToReview, UNFILED_KEEP_DAYS } from "@/lib/receipt-review";
import { formatAbn } from "@/lib/receipts";
import { SNAP_KIND_LABELS, type SnapKind } from "@/lib/receipt-upload-kinds";
import { listUnfiledReceipts, UNFILED_REASON_LABELS } from "@/lib/unfiled-receipts";
import ReviewActions, { type ReviewDefaults } from "./ReviewActions";

export const metadata = { title: "Receipts to check · StudyLeave" };

const NOTICES: Record<string, string> = {
  confirmed: "Receipt confirmed.",
  saved: "Changes saved.",
  moved: "Receipt moved.",
  deleted: "Receipt deleted.",
};

interface Details {
  kind: string;
  supplier_name: string | null;
  supplier_abn: string | null;
  gst_cents: number | null;
  amount_cents: number;
  currency: string;
  receipt_date: string | null;
}

const kindLabel = (k: string) => SNAP_KIND_LABELS[k as SnapKind] ?? k;

function defaultsFor(r: Details): ReviewDefaults {
  return {
    supplier: r.supplier_name ?? "",
    abn: formatAbn(r.supplier_abn) || (r.supplier_abn ?? ""),
    gst: r.gst_cents == null ? "" : centsToInput(r.gst_cents),
    amount: r.amount_cents ? centsToInput(r.amount_cents) : "",
    date: r.receipt_date ?? "",
    kind: r.kind,
  };
}

/** What Hoggy read off the receipt, as plain facts (blank = not found). */
function ExtractedDetails({ r }: { r: Details }) {
  return (
    <dl className="extracted">
      <div>
        <dt>Supplier</dt>
        <dd>{r.supplier_name ?? "—"}</dd>
      </div>
      <div>
        <dt>Amount</dt>
        <dd>{formatMoney(r.amount_cents, r.currency)}</dd>
      </div>
      <div>
        <dt>GST</dt>
        <dd>{r.gst_cents == null ? "—" : formatMoney(r.gst_cents, r.currency)}</dd>
      </div>
      <div>
        <dt>ABN</dt>
        <dd>{r.supplier_abn ? formatAbn(r.supplier_abn) : "—"}</dd>
      </div>
      <div>
        <dt>Date</dt>
        <dd>{r.receipt_date ? formatDate(r.receipt_date) : "—"}</dd>
      </div>
      <div>
        <dt>Type</dt>
        <dd>{kindLabel(r.kind)}</dd>
      </div>
    </dl>
  );
}

/** /receipts: the doctor checks what Hoggy filed and fixes mistakes. Read-only on GET. */
export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole([], "/receipts");
  const db = getDb();
  const doneParam = (await searchParams).done;
  const notice = typeof doneParam === "string" ? NOTICES[doneParam] : undefined;
  const toReview = listReceiptsToReview(user, db);
  const unfiled = listUnfiledReceipts(user.id, db);
  const trips = listMoveTargets(user, db).map((t) => ({ id: t.id, label: `${t.conference_name} (${formatDate(t.start_date)})` }));

  return (
    <main>
      <h1>Receipts to check</h1>
      <p className="muted">
        Hoggy reads every receipt you forward or snap. Check the details, move anything on the wrong trip, and delete
        personal ones.
      </p>
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}

      <section aria-labelledby="review-title">
        <h2 id="review-title">Needs review ({toReview.length})</h2>
        {toReview.length === 0 ? (
          <p className="empty">All checked. Nice.</p>
        ) : (
          <ul className="review-list">
            {toReview.map((r) => (
              <li key={r.id} className="conf-card review-item" data-testid="review-receipt">
                <p className="review-head">
                  <strong>{r.description}</strong> <span className="badge badge-needs_review">Needs review</span>
                </p>
                <p className="conf-meta">
                  <span>
                    On <Link href={`/trips/${r.trip_id}`}>{r.conference_name}</Link>
                  </span>
                  {r.file_path && (
                    <span>
                      <a href={`/trips/${r.trip_id}/receipts/${r.id}`} target="_blank" rel="noreferrer">
                        View
                      </a>
                    </span>
                  )}
                </p>
                <ExtractedDetails r={r} />
                <ReviewActions
                  kind="trip"
                  id={r.id}
                  currency={r.currency}
                  defaults={defaultsFor(r)}
                  targets={trips.filter((t) => t.id !== r.trip_id)}
                  canConfirm
                  canMoveOrDelete={r.source !== "generated"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="unfiled-title">
        <h2 id="unfiled-title">Unfiled ({unfiled.length})</h2>
        <p className="muted">
          Only you can see these. File them on a trip, or delete personal ones — anything left is deleted after{" "}
          {UNFILED_KEEP_DAYS} days.
        </p>
        {unfiled.length === 0 ? (
          <p className="empty">Nothing unfiled.</p>
        ) : (
          <ul className="review-list">
            {unfiled.map((r) => (
              <li key={r.id} className="conf-card review-item" data-testid="review-unfiled">
                <p className="review-head">
                  <strong>{r.description}</strong> <span className="badge">{UNFILED_REASON_LABELS[r.reason]}</span>
                </p>
                <p className="conf-meta">
                  <span>Received {formatDate(r.created_at)}</span>
                  <span>
                    <a href={`/receipts/unfiled/${r.id}`} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </span>
                </p>
                <ExtractedDetails r={r} />
                <ReviewActions
                  kind="unfiled"
                  id={r.id}
                  currency={r.currency}
                  defaults={defaultsFor(r)}
                  targets={trips}
                  canConfirm={false}
                  canMoveOrDelete
                />
              </li>
            ))}
          </ul>
        )}
        {unfiled.length > 0 && trips.length === 0 && (
          <p className="muted">
            To file one, first <Link href="/conferences">plan the trip</Link> it belongs to.
          </p>
        )}
      </section>
    </main>
  );
}
