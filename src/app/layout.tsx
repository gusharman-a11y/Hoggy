import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { outboxScope } from "@/lib/mailer";
import { countReceiptsToReview } from "@/lib/receipt-review";
import { isDemoMode } from "@/lib/runtime";
import { APP_NAME, TAGLINE } from "@/lib/site";
import { logoutAction } from "./auth-actions";

export const metadata: Metadata = {
  title: APP_NAME,
  description: TAGLINE,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Read-only count for the nav badge (needs_review + unfiled receipts of this user).
  const toReview = user ? countReceiptsToReview(user) : 0;
  return (
    <html lang="en">
      <body>
        {isDemoMode() && (
          <p className="demo-banner" data-testid="demo-banner">
            Demo — data resets from time to time. Logins: manager@demo.test / password123 · sign up with code
            DEMO2026
          </p>
        )}
        <header className="topnav">
          <Link href="/" className="brand">
            {APP_NAME}
          </Link>
          <nav aria-label="Main">
            <Link href="/conferences">Conferences</Link>
            {user ? (
              <>
                <Link href="/trips">My trips</Link>
                <Link href="/receipts" data-testid="nav-receipts">
                  Receipts
                  {toReview > 0 && (
                    <span className="nav-count" data-testid="nav-review-count" aria-label={`${toReview} to check`}>
                      {toReview}
                    </span>
                  )}
                </Link>
                {(user.role === "manager" || user.role === "admin") && <Link href="/approvals">Approvals</Link>}
                {(user.role === "finance" || user.role === "admin") && <Link href="/claims">Claims</Link>}
                <Link href="/dashboard">Dashboard</Link>
                {(user.role === "manager" || user.role === "admin") && <Link href="/team">Team</Link>}
                {user.role === "admin" && <Link href="/settings">Settings</Link>}
                {outboxScope(user) && <Link href="/outbox">Outbox</Link>}
                <Link href="/account" className="nav-account">
                  {user.name}
                </Link>
                <form action={logoutAction}>
                  <button type="submit" className="link">
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/signup">Sign up</Link>
              </>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
