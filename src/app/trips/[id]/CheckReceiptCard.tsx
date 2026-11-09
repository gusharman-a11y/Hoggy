"use client";

import { useActionState } from "react";
import { reviewReceiptAction, type ReviewReceiptState } from "../../receipt-actions";
import { SNAP_KIND_LABELS, SNAP_KINDS } from "@/lib/receipt-upload-kinds";

export interface CheckReceiptDefaults {
  supplier: string;
  abn: string;
  gst: string;
  amount: string;
  date: string;
  kind: string;
}

/** "Check this receipt": what the reader found, all editable; "Looks right" confirms it. */
export default function CheckReceiptCard({
  tripId,
  receiptId,
  currency,
  fileName,
  viewHref,
  defaults,
}: {
  tripId: number;
  receiptId: number;
  currency: string;
  fileName: string;
  viewHref: string | null;
  defaults: CheckReceiptDefaults;
}) {
  const [state, action, pending] = useActionState<ReviewReceiptState | undefined, FormData>(
    reviewReceiptAction.bind(null, tripId, receiptId),
    undefined,
  );
  const v = state?.values ?? defaults;
  const id = (k: string) => `check-${receiptId}-${k}`;
  return (
    <section className="check-receipt" id={`check-${receiptId}`} data-testid="check-receipt" aria-labelledby={id("title")}>
      <h3 id={id("title")}>Check this receipt</h3>
      <p className="muted">
        {fileName}
        {viewHref && (
          <>
            {" · "}
            <a href={viewHref} target="_blank" rel="noreferrer">
              View
            </a>
          </>
        )}
        {" · "}Fix anything we got wrong, then tap Looks right.
      </p>
      <form action={action} className="form check-grid" key={state ? JSON.stringify(state.values) : "initial"}>
        <div className="field">
          <label htmlFor={id("supplier")}>Supplier</label>
          <input id={id("supplier")} name="supplier" defaultValue={v.supplier} maxLength={200} placeholder="e.g. Harbour Taxis" />
        </div>
        <div className="field">
          <label htmlFor={id("abn")}>ABN</label>
          <input id={id("abn")} name="abn" defaultValue={v.abn} inputMode="numeric" placeholder="11 digits" />
        </div>
        <div className="field">
          <label htmlFor={id("amount")}>Amount ({currency})</label>
          <input id={id("amount")} name="amount" defaultValue={v.amount} inputMode="decimal" placeholder="e.g. 42.50" required />
        </div>
        <div className="field">
          <label htmlFor={id("gst")}>GST ({currency})</label>
          <input id={id("gst")} name="gst" defaultValue={v.gst} inputMode="decimal" placeholder="e.g. 3.86" />
        </div>
        <div className="field">
          <label htmlFor={id("date")}>Date</label>
          <input id={id("date")} name="date" type="date" defaultValue={v.date} />
        </div>
        <div className="field">
          <label htmlFor={id("kind")}>What is it?</label>
          <select id={id("kind")} name="kind" defaultValue={v.kind}>
            {SNAP_KINDS.map((k) => (
              <option key={k} value={k}>
                {SNAP_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        {state?.error && <p className="error">{state.error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Looks right"}
        </button>
      </form>
    </section>
  );
}
