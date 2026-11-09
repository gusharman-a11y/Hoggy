import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getConference } from "@/lib/conferences";
import { formatDateRange } from "@/lib/format";
import PlanTripButton from "@/components/PlanTripButton";

export const metadata = { title: "Plan trip · StudyLeave" };

// Where logged-out users land after logging in from "Plan trip". This GET only reads:
// the draft trip is created by the button's server action (POST).
export default async function PlanTripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getConference(slug);
  if (!c) notFound();
  const user = await requireRole([], `/conferences/${slug}/plan`);
  if (user.org_id == null) redirect("/account");

  return (
    <main className="narrow">
      <p>
        <Link href={`/conferences/${c.slug}`}>← {c.name}</Link>
      </p>
      <h1>Plan a trip</h1>
      <p>
        <strong>{c.name}</strong>
        <br />
        <span className="muted">
          {formatDateRange(c.start_date, c.end_date)} · {[c.city, c.country].filter(Boolean).join(", ") || "TBC"}
        </span>
      </p>
      <p>This opens a draft trip you can fill in and send for approval. Nothing is booked yet.</p>
      <div className="actions">
        <PlanTripButton slug={c.slug} />
      </div>
    </main>
  );
}
