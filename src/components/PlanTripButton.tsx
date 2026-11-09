import { planTripAction } from "@/app/plan-actions";

/** A real form POST: planning a trip writes a row, so it must never happen on a GET. */
export default function PlanTripButton({ slug }: { slug: string }) {
  return (
    <form action={planTripAction.bind(null, slug)} className="inline-form">
      <button type="submit" className="button">
        Plan trip
      </button>
    </form>
  );
}
