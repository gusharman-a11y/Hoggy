"use server";

import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getConference } from "@/lib/conferences";
import { toAudCents } from "@/lib/fx";
import { findOrCreateDraftTrip } from "@/lib/trips";

/**
 * "Plan trip" (POST): opens the doctor's draft trip for this conference, creating it the
 * first time. Find-or-create keeps double clicks from making duplicates. Logged-out
 * users go to /login and come back to the (read-only) /plan page to confirm.
 */
export async function planTripAction(slug: string): Promise<void> {
  const c = getConference(slug);
  if (!c) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/conferences/${c.slug}/plan`)}`);
  if (user.org_id == null) redirect("/account");

  const fee = c.registration_fee_cents == null ? 0 : (toAudCents(c.registration_fee_cents, c.currency) ?? 0);
  const { trip } = findOrCreateDraftTrip(user, c.id, fee);
  redirect(`/trips/${trip.id}`);
}
