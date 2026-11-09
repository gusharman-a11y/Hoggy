import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getConference } from "@/lib/conferences";
import { toAudCents } from "@/lib/fx";
import { findOrCreateDraftTrip } from "@/lib/trips";

export const metadata = { title: "Plan trip · StudyLeave" };

// "Plan trip": login-gated (logged-out users go to /login and come back here), then
// opens the doctor's draft trip for this conference, creating it the first time.
// Find-or-create keeps reloads and double clicks from making duplicates.
export default async function PlanTripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getConference(slug);
  if (!c) notFound();
  const user = await requireRole([], `/conferences/${slug}/plan`);
  if (user.org_id == null) redirect("/account");

  const fee = c.registration_fee_cents == null ? 0 : (toAudCents(c.registration_fee_cents, c.currency) ?? 0);
  const { trip } = findOrCreateDraftTrip(user, c.id, fee);
  redirect(`/trips/${trip.id}`);
}
