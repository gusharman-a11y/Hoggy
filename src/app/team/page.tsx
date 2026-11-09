import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { teamBudgets } from "@/lib/budget";
import { centsToInput, formatMoney } from "@/lib/format";
import { yearFromParam } from "@/lib/year-param";
import AllowanceForm from "./AllowanceForm";

export const metadata = { title: "Team · StudyLeave" };

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["manager", "admin"], "/team");
  const year = yearFromParam((await searchParams).year) ?? new Date().getUTCFullYear();
  const rows = user.org_id == null ? [] : teamBudgets(user.org_id, year);

  return (
    <main>
      <h1>Team budgets</h1>
      <nav className="year-tabs" aria-label="Budget year">
        <Link href={`/team?year=${year - 1}`}>← {year - 1}</Link>
        <strong aria-current="page">{year}</strong>
        <Link href={`/team?year=${year + 1}`}>{year + 1} →</Link>
      </nav>
      <p className="muted">
        Study-leave allowances for {year}, by the year each conference starts. Doctors without their own
        figure get the hospital default.
      </p>
      {rows.length === 0 ? (
        <p className="empty">No doctors have joined your hospital yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="team-table" data-testid="team-table">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Allowance (AUD)</th>
                <th>Committed</th>
                <th>Spent</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} data-testid={`team-row-${r.userId}`}>
                  <td>
                    {r.name}
                    <div className="muted small">{r.email}</div>
                  </td>
                  <td>
                    <AllowanceForm
                      userId={r.userId}
                      year={year}
                      name={r.name}
                      defaultValue={centsToInput(r.allowanceCents)}
                    />
                    {!r.hasOwnAllowance && <div className="muted small">Hospital default</div>}
                  </td>
                  <td>{formatMoney(r.committedCents)}</td>
                  <td>{formatMoney(r.spentCents)}</td>
                  <td className={r.remainingCents < 0 ? "over" : undefined}>{formatMoney(r.remainingCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
