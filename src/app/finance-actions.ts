"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FinanceError, markClaimPaid } from "@/claims/finance";
import { getCurrentUser } from "@/lib/auth";
import { getMailer } from "@/lib/mailer";

export interface MarkPaidState {
  error?: string;
}

export async function markPaidAction(tripId: number): Promise<MarkPaidState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  try {
    await markClaimPaid(tripId, user, getMailer());
  } catch (err) {
    if (err instanceof FinanceError) return { error: err.message };
    console.error(err);
    return { error: "Something went wrong. The claim was not marked paid. Please try again." };
  }
  revalidatePath("/claims");
  revalidatePath(`/trips/${tripId}`);
  redirect(`/claims?paid=${tripId}`);
}
