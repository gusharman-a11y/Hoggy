"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/format";
import { deleteUploadedReceipt, saveUploadedReceipt, updateReceipt, UploadError } from "@/lib/receipt-uploads";
import { reviewReceipt, snapReceipt } from "@/lib/receipt-snap";

export interface UploadFormState {
  error?: string;
  values?: { description: string; amount: string; kind: string };
}

export async function uploadReceiptAction(
  tripId: number,
  _prev: UploadFormState | undefined,
  form: FormData,
): Promise<UploadFormState> {
  const values = {
    description: String(form.get("description") ?? ""),
    amount: String(form.get("amount") ?? ""),
    kind: String(form.get("kind") ?? ""),
  };
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again.", values };
  const f = form.get("file");
  const file =
    f instanceof File && f.size > 0
      ? { name: f.name, size: f.size, bytes: new Uint8Array(await f.arrayBuffer()) }
      : undefined;
  const amountCents = values.amount.trim() === "" ? undefined : parseMoneyToCents(values.amount);
  try {
    saveUploadedReceipt(tripId, user, { file, description: values.description, amountCents, kind: values.kind });
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message, values };
    console.error(err);
    return { error: "Something went wrong. Please try again.", values };
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?receipt=added`);
}

export async function deleteReceiptAction(tripId: number, receiptId: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/trips/${tripId}`);
  try {
    deleteUploadedReceipt(tripId, receiptId, user);
  } catch (err) {
    if (!(err instanceof UploadError)) throw err;
    redirect(`/trips/${tripId}?receipt=denied`);
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?receipt=deleted`);
}

export interface EditReceiptState {
  error?: string;
  values?: { description: string; amount: string };
}

export async function editReceiptAction(
  tripId: number,
  receiptId: number,
  _prev: EditReceiptState | undefined,
  form: FormData,
): Promise<EditReceiptState> {
  const values = {
    description: String(form.get("description") ?? ""),
    amount: String(form.get("amount") ?? ""),
  };
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again.", values };
  const amountCents = values.amount.trim() === "" ? undefined : parseMoneyToCents(values.amount);
  try {
    updateReceipt(tripId, receiptId, user, { description: values.description, amountCents });
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message, values };
    console.error(err);
    return { error: "Something went wrong. Please try again.", values };
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?receipt=updated`);
}

export interface SnapFormState {
  error?: string;
}

/** "Snap receipt": save the photo/PDF, read it, then show the "Check this receipt" card. */
export async function snapReceiptAction(
  tripId: number,
  _prev: SnapFormState | undefined,
  form: FormData,
): Promise<SnapFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  const f = form.get("file");
  const file =
    f instanceof File && f.size > 0
      ? { name: f.name, size: f.size, bytes: new Uint8Array(await f.arrayBuffer()) }
      : undefined;
  let receiptId: number;
  try {
    receiptId = (await snapReceipt(tripId, user, file)).id;
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message };
    console.error(err);
    return { error: "Something went wrong. Please try again." };
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?receipt=snapped#check-${receiptId}`);
}

export interface ReviewReceiptState {
  error?: string;
  values?: { supplier: string; abn: string; gst: string; amount: string; date: string; kind: string };
}

/** "Looks right" on the check card: save the (possibly corrected) details and confirm. */
export async function reviewReceiptAction(
  tripId: number,
  receiptId: number,
  _prev: ReviewReceiptState | undefined,
  form: FormData,
): Promise<ReviewReceiptState> {
  const field = (k: string) => String(form.get(k) ?? "");
  const values = {
    supplier: field("supplier"),
    abn: field("abn"),
    gst: field("gst"),
    amount: field("amount"),
    date: field("date"),
    kind: field("kind"),
  };
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again.", values };
  try {
    reviewReceipt(tripId, receiptId, user, {
      supplierName: values.supplier,
      supplierAbn: values.abn,
      gstCents: values.gst.trim() === "" ? null : parseMoneyToCents(values.gst),
      amountCents: values.amount.trim() === "" ? undefined : parseMoneyToCents(values.amount),
      receiptDate: values.date,
      kind: values.kind,
    });
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message, values };
    console.error(err);
    return { error: "Something went wrong. Please try again.", values };
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?receipt=confirmed`);
}
