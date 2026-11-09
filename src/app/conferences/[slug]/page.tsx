import Link from "next/link";
import { notFound } from "next/navigation";
import { getConference } from "@/lib/conferences";
import { formatDateRange, formatMoney } from "@/lib/format";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const c = getConference((await params).slug);
  return { title: `${c ? c.name : "Conference not found"} · StudyLeave` };
}

export default async function ConferencePage({ params }: { params: Params }) {
  const c = getConference((await params).slug);
  if (!c) notFound();

  return (
    <main className="narrow">
      <p>
        <Link href="/conferences">← All conferences</Link>
      </p>
      <h1>{c.name}</h1>
      <p className="muted">{c.specialty}</p>
      <dl className="facts" data-testid="conference-facts">
        <dt>Dates</dt>
        <dd>{formatDateRange(c.start_date, c.end_date)}</dd>
        <dt>Venue</dt>
        <dd>{c.venue || "TBC"}</dd>
        <dt>City</dt>
        <dd>{c.city || "TBC"}</dd>
        <dt>Country</dt>
        <dd>{c.country || "TBC"}</dd>
        <dt>CPD points</dt>
        <dd>{c.cpd_points ?? "TBC"}</dd>
        <dt>Registration fee</dt>
        <dd>{formatMoney(c.registration_fee_cents, c.currency)}</dd>
        <dt>Official site</dt>
        <dd>
          {c.url ? (
            <a href={c.url} target="_blank" rel="noopener noreferrer">
              {c.url}
            </a>
          ) : (
            "—"
          )}
        </dd>
      </dl>
      <p className="actions">
        <Link className="button" href={`/conferences/${c.slug}/plan`}>
          Plan trip
        </Link>
      </p>
    </main>
  );
}
