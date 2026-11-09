import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getConference } from "@/lib/conferences";
import { formatDateRange } from "@/lib/format";

export const metadata = { title: "Plan trip · StudyLeave" };

// Entry point for "Plan trip": login-gated so logged-out users go to /login and come back here.
// US-010 turns this into creating a draft trip and opening /trips/[id].
export default async function PlanTripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getConference(slug);
  if (!c) notFound();
  const user = await requireRole([], `/conferences/${slug}/plan`);

  return (
    <main className="narrow">
      <h1>Plan trip</h1>
      <p>
        <strong>{c.name}</strong>
        <br />
        {formatDateRange(c.start_date, c.end_date)} · {[c.city, c.country].filter(Boolean).join(", ")}
      </p>
      <p className="notice" role="status">
        Thanks {user.name} — trip planning for this conference is coming next.
      </p>
      <p>
        <Link href={`/conferences/${c.slug}`}>Back to the conference</Link>
      </p>
    </main>
  );
}
