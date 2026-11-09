import { formatMoney } from "@/lib/format";
import type { Budget } from "@/lib/budget";

/** The study-budget summary: allowance, committed, spent, remaining (all AUD). */
export default function BudgetCard({ budget, currency = "AUD" }: { budget: Budget; currency?: string }) {
  const over = budget.remainingCents < 0;
  return (
    <section className="budget-card" data-testid="budget-card" aria-labelledby="budget-heading">
      <h2 id="budget-heading">Study budget {budget.year}</h2>
      <dl className="budget-grid">
        <div>
          <dt>Allowance</dt>
          <dd data-testid="budget-allowance">{formatMoney(budget.allowanceCents, currency)}</dd>
        </div>
        <div>
          <dt>Committed</dt>
          <dd data-testid="budget-committed">{formatMoney(budget.committedCents, currency)}</dd>
        </div>
        <div>
          <dt>Spent</dt>
          <dd data-testid="budget-spent">{formatMoney(budget.spentCents, currency)}</dd>
        </div>
        <div className={over ? "over" : "left"}>
          <dt>Remaining</dt>
          <dd data-testid="budget-remaining">{formatMoney(budget.remainingCents, currency)}</dd>
        </div>
      </dl>
      <p className="muted small">
        Committed = approved and booked trips (estimates). Spent = claimed and paid trips (receipts).
        {budget.pendingCents > 0 && <> {formatMoney(budget.pendingCents, currency)} is awaiting approval.</>}
      </p>
    </section>
  );
}
