"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApprovalError, decideTrip, submitTripForApproval, type Decision } from "@/lib/approvals";
import { getCurrentUser } from "@/lib/auth";
import { getMailer } from "@/lib/mailer";

export interface ApprovalFormState {
  error?: string;
  /** Submitted comment so the textarea refills after React resets the form. */
  comment?: string;
}

function message(err: unknown): string {
  if (err instanceof ApprovalError) return err.message;
  console.error(err);
  return "Something went wrong. Please try again.";
}

export async function submitTripAction(tripId: number): Promise<ApprovalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  try {
    await submitTripForApproval(tripId, user, getMailer());
  } catch (err) {
    return { error: message(err) };
  }
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/approvals");
  return {};
}

export async function decideTripAction(
  tripId: number,
  _prev: ApprovalFormState | undefined,
  form: FormData,
): Promise<ApprovalFormState> {
  const comment = String(form.get("comment") ?? "");
  const decision = String(form.get("decision") ?? "") as Decision;
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again.", comment };
  try {
    await decideTrip(tripId, user, decision, comment, getMailer());
  } catch (err) {
    return { error: message(err), comment };
  }
  revalidatePath("/approvals");
  revalidatePath(`/trips/${tripId}`);
  // The form disappears once the trip is decided, so land on a page that says what happened.
  if (form.get("from") === "trip") redirect(`/trips/${tripId}`);
  redirect(`/approvals?decided=${decision}&trip=${tripId}`);
}
