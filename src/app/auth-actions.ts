"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { logIn, logOut } from "@/lib/auth";
import {
  checkCredentials,
  createOrg,
  createUser,
  findOrgByCode,
  findUserByEmail,
  safeNext,
} from "@/lib/users";

export interface FormState {
  error?: string;
  /** Submitted values (never the password) so the form can refill after React resets it. */
  values?: Record<string, string>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const keep = (f: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, str(f, k)]));

export async function signupAction(_prev: FormState | undefined, form: FormData): Promise<FormState> {
  const name = str(form, "name");
  const email = str(form, "email");
  const password = String(form.get("password") ?? "");
  const mode = str(form, "mode") === "create" ? "create" : "join";
  const values = keep(form, ["name", "email", "mode", "joinCode", "orgName", "financeEmail"]);

  if (!name) return { error: "Please enter your name.", values };
  if (!EMAIL.test(email)) return { error: "Please enter a valid email address.", values };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", values };

  const db = getDb();
  if (findUserByEmail(db, email)) return { error: "An account with that email already exists. Try logging in.", values };

  let userId: number;
  if (mode === "join") {
    const org = findOrgByCode(db, str(form, "joinCode"));
    if (!org) return { error: "We don't recognise that hospital code. Check it with your manager.", values };
    userId = createUser(db, { orgId: org.id, email, name, password, role: "doctor" }).id;
  } else {
    const orgName = str(form, "orgName");
    const financeEmail = str(form, "financeEmail");
    if (!orgName) return { error: "Please enter the hospital name.", values };
    if (!EMAIL.test(financeEmail)) return { error: "Please enter a valid finance email address.", values };
    db.exec("BEGIN");
    try {
      const org = createOrg(db, { name: orgName, financeEmail });
      userId = createUser(db, { orgId: org.id, email, name, password, role: "admin" }).id;
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  await logIn(userId);
  redirect(mode === "create" ? "/account?created=1" : "/account");
}

export async function loginAction(_prev: FormState | undefined, form: FormData): Promise<FormState> {
  const user = checkCredentials(getDb(), str(form, "email"), String(form.get("password") ?? ""));
  if (!user) return { error: "Wrong email or password.", values: keep(form, ["email"]) };
  await logIn(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logoutAction(): Promise<void> {
  await logOut();
  redirect("/login");
}
