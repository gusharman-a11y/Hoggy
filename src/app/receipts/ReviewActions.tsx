"use client";

import { useActionState } from "react";
import { SNAP_KIND_LABELS, SNAP_KINDS } from "@/lib/receipt-upload-kinds";
import {
  confirmReviewAction,
  deletePersonalAction,
  editReviewAction,
  moveReviewAction,
  type ReviewActionState,
  type ReviewItemKind,
} from "../review-actions";

export interface ReviewDefaults {
  supplier: string;
  abn: string;
  gst: string;
  amount: string;
  date: string;
  kind: string;
}

type State = ReviewActionState | undefined;

/** Confirm / Edit / Move / Personal — delete for one receipt on /receipts. Every action is a POST. */
export default function ReviewActions({
  kind,
  id,
  currency,
  defaults,
  targets,
  canConfirm,
  canMoveOrDelete,
}: {
  kind: ReviewItemKind;
  id: number;
  currency: string;
  defaults: ReviewDefaults;
  /** Trips it can move to (already excludes the one it's on). */
  targets: { id: number; label: string }[];
  canConfirm: boolean;
  canMoveOrDelete: boolean;
}) {
  const [confirmState, confirm, confirming] = useActionState<State>(confirmReviewAction.bind(null, id), undefined);
  const [editState, edit, saving] = useActionState<State, FormData>(editReviewAction.bind(null, kind, id), undefined);
  const [moveState, move, moving] = useActionState<State, FormData>(moveReviewAction.bind(null, kind, id), undefined);
  const [deleteState, remove, deleting] = useActionState<State>(deletePersonalAction.bind(null, kind, id), undefined);
  const v = editState?.values ?? defaults;
  const fid = (k: string) => `${kind}-${id}-${k}`;
  const error = confirmState?.error ?? moveState?.error ?? deleteState?.error;

  return (
    <div className="review-actions">
      <div className="review-buttons">
        {canConfirm && (
          <form action={confirm} className="inline-form">
            <button type="submit" disabled={confirming}>
              {confirming ? "Saving…" : "Confirm"}
            </button>
          </form>
        )}
        {canMoveOrDelete && targets.length > 0 && (
          <form action={move} className="move-form">
            <label htmlFor={fid("trip")}>{kind === "unfiled" ? "File on" : "Move to"}</label>
            <select id={fid("trip")} name="trip" defaultValue={String(targets[0].id)}>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button type="submit" className="secondary" disabled={moving}>
              {moving ? "Moving…" : kind === "unfiled" ? "File it" : "Move"}
            </button>
          </form>
        )}
        {canMoveOrDelete && (
          <form
            action={remove}
            className="inline-form"
            onSubmit={(e) => {
              if (!window.confirm("Delete this receipt and its file? This can't be undone.")) e.preventDefault();
            }}
          >
            <button type="submit" className="link danger" disabled={deleting}>
              Personal — delete
            </button>
          </form>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <details className="edit-receipt" open={editState?.error ? true : undefined}>
        <summary>Edit</summary>
        <form action={edit} className="form check-grid" key={editState ? JSON.stringify(editState.values) : "initial"}>
          <div className="field">
            <label htmlFor={fid("supplier")}>Supplier</label>
            <input id={fid("supplier")} name="supplier" defaultValue={v.supplier} maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor={fid("abn")}>ABN</label>
            <input id={fid("abn")} name="abn" defaultValue={v.abn} inputMode="numeric" placeholder="11 digits" />
          </div>
          <div className="field">
            <label htmlFor={fid("amount")}>Amount ({currency})</label>
            <input id={fid("amount")} name="amount" defaultValue={v.amount} inputMode="decimal" required />
          </div>
          <div className="field">
            <label htmlFor={fid("gst")}>GST ({currency})</label>
            <input id={fid("gst")} name="gst" defaultValue={v.gst} inputMode="decimal" />
          </div>
          <div className="field">
            <label htmlFor={fid("date")}>Date</label>
            <input id={fid("date")} name="date" type="date" defaultValue={v.date} />
          </div>
          <div className="field">
            <label htmlFor={fid("kind")}>What is it?</label>
            <select id={fid("kind")} name="kind" defaultValue={v.kind}>
              {SNAP_KINDS.map((k) => (
                <option key={k} value={k}>
                  {SNAP_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          {editState?.error && <p className="error">{editState.error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </details>
    </div>
  );
}
