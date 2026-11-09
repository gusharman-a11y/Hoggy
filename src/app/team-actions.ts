"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { setAllowance } from "@/lib/budget";
import { parseMoneyToCents } from "@/lib/format";

export interface AllowanceFormState {
  error?: string;
  saved?: boolean;
  value?: string;
}

const MAX_CENTS = 100_000_000; // AUD 1,000,000

export async function setAllowanceAction(
  userId: number,
  year: number,
  _prev: AllowanceFormState | undefined,
  form: FormData,
): Promise<AllowanceFormState> {
  const value = String(form.get("allowance") ?? "").trim();
  const user = await getCurrentUser();
  if (!user || user.org_id == null || (user.role !== "manager" && user.role !== "admin")) {
    return { error: "Only managers can set allowances.", value };
  }
  const cents = parseMoneyToCents(value);
  if (value === "" || cents === undefined || cents > MAX_CENTS) {
    return { error: "Enter an amount like 3000 or 3,000.00.", value };
  }
  try {
    setAllowance(getDb(), { orgId: user.org_id, userId, year, allowanceCents: cents });
  } catch {
    return { error: "Couldn't save that allowance.", value };
  }
  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { saved: true, value };
}
