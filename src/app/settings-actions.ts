"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { isValidEmail, setFinanceEmail } from "@/lib/users";

export interface SettingsFormState {
  error?: string;
  saved?: boolean;
  financeEmail?: string;
}

export async function saveSettingsAction(
  _prev: SettingsFormState | undefined,
  form: FormData,
): Promise<SettingsFormState> {
  const financeEmail = String(form.get("financeEmail") ?? "").trim();
  const user = await getCurrentUser();
  if (!user || user.org_id == null || user.role !== "admin") {
    return { error: "Only your hospital's admin can change settings.", financeEmail };
  }
  if (!isValidEmail(financeEmail)) return { error: "Please enter a valid email address.", financeEmail };
  const org = setFinanceEmail(getDb(), user.org_id, financeEmail);
  revalidatePath("/settings");
  return { saved: true, financeEmail: org.finance_email ?? financeEmail };
}
