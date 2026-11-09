"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/format";
import {
  confirmReviewReceipt,
  deletePersonalReceipt,
  deleteUnfiledReceipt,
  editReviewReceipt,
  editUnfiledReceipt,
  moveReviewReceipt,
  moveUnfiledReceipt,
} from "@/lib/receipt-review";
import { UploadError } from "@/lib/receipt-uploads";

/** Which list the item is in on /receipts: a filed receipt on a trip, or an unfiled one. */
export type ReviewItemKind = "trip" | "unfiled";

export interface ReviewActionState {
  error?: string;
  values?: { supplier: string; abn: string; gst: string; amount: string; date: string; kind: string };
}

function done(flag: string): never {
  revalidatePath("/receipts");
  revalidatePath("/", "layout");
  redirect(`/receipts?done=${flag}`);
}

async function viewer() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/receipts");
  return user;
}

const fail = (err: unknown, values?: ReviewActionState["values"]): ReviewActionState => {
  if (err instanceof UploadError) return { error: err.message, values };
  console.error(err);
  return { error: "Something went wrong. Please try again.", values };
};

/** "Confirm": the details Hoggy read are right. */
export async function confirmReviewAction(receiptId: number): Promise<ReviewActionState> {
  const user = await viewer();
  try {
    confirmReviewReceipt(receiptId, user);
  } catch (err) {
    return fail(err);
  }
  done("confirmed");
}

/** "Edit": save corrected details (a filed receipt stays in the review list until confirmed). */
export async function editReviewAction(
  kind: ReviewItemKind,
  id: number,
  _prev: ReviewActionState | undefined,
  form: FormData,
): Promise<ReviewActionState> {
  const field = (k: string) => String(form.get(k) ?? "");
  const values = { supplier: field("supplier"), abn: field("abn"), gst: field("gst"), amount: field("amount"), date: field("date"), kind: field("kind") };
  const user = await viewer();
  const review = {
    supplierName: values.supplier,
    supplierAbn: values.abn,
    gstCents: values.gst.trim() === "" ? null : parseMoneyToCents(values.gst),
    amountCents: values.amount.trim() === "" ? undefined : parseMoneyToCents(values.amount),
    receiptDate: values.date,
    kind: values.kind,
  };
  try {
    if (kind === "trip") editReviewReceipt(id, user, review);
    else editUnfiledReceipt(id, user, review);
  } catch (err) {
    return fail(err, values);
  }
  done("saved");
}

/** "Move to another of my trips" (or, for an unfiled receipt, file it on a trip). */
export async function moveReviewAction(
  kind: ReviewItemKind,
  id: number,
  _prev: ReviewActionState | undefined,
  form: FormData,
): Promise<ReviewActionState> {
  const user = await viewer();
  const to = Number(form.get("trip"));
  try {
    if (kind === "trip") moveReviewReceipt(id, to, user);
    else moveUnfiledReceipt(id, to, user);
  } catch (err) {
    return fail(err);
  }
  done("moved");
}

/** "Personal — delete": removes the receipt and its file. */
export async function deletePersonalAction(kind: ReviewItemKind, id: number): Promise<ReviewActionState> {
  const user = await viewer();
  try {
    if (kind === "trip") deletePersonalReceipt(id, user);
    else deleteUnfiledReceipt(id, user);
  } catch (err) {
    return fail(err);
  }
  done("deleted");
}
