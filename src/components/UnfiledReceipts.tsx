import { formatDate, formatMoney } from "@/lib/format";
import { formatAbn } from "@/lib/receipts";
import { UNFILED_REASON_LABELS, type UnfiledReceipt } from "@/lib/unfiled-receipts";

/** The doctor's private Unfiled receipts (personal-inbox mail that didn't fit one trip). */
export default function UnfiledReceipts({ receipts }: { receipts: UnfiledReceipt[] }) {
  return (
    <section data-testid="unfiled-receipts" aria-labelledby="unfiled-title">
      <h2 id="unfiled-title">Unfiled receipts</h2>
      <p className="muted">Only you can see these. Anything left here is deleted after 7 days — personal receipts can simply be ignored.</p>
      {receipts.length === 0 ? (
        <p className="empty">Nothing unfiled.</p>
      ) : (
        <ul className="unfiled-list">
          {receipts.map((r) => (
            <li key={r.id} className="conf-card" data-testid="unfiled-receipt">
              <strong>{r.description}</strong> · {formatMoney(r.amount_cents, r.currency)}
              <p className="conf-meta">
                {r.receipt_date && <span>{formatDate(r.receipt_date)}</span>}
                {r.supplier_abn && <span>ABN {formatAbn(r.supplier_abn)}</span>}
                <span>{UNFILED_REASON_LABELS[r.reason]}</span>
                <span>
                  <a href={`/receipts/unfiled/${r.id}`} target="_blank" rel="noreferrer">
                    View
                  </a>
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
