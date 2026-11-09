"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClaimError, sendClaim } from "@/claims/send";
import { getCurrentUser } from "@/lib/auth";
import { getMailer } from "@/lib/mailer";

export interface SendClaimState {
  error?: string;
}

export async function sendClaimAction(tripId: number): Promise<SendClaimState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  try {
    await sendClaim(tripId, user, getMailer());
  } catch (err) {
    if (err instanceof ClaimError) return { error: err.message };
    console.error(err);
    return { error: "Something went wrong. Your claim was not sent. Please try again." };
  }
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/dashboard");
  redirect(`/trips/${tripId}?claim=sent`);
}
