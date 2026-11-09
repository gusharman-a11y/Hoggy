import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in · StudyLeave" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="narrow">
      <h1>Log in</h1>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p>
        New here? <Link href="/signup">Sign up</Link>
      </p>
    </main>
  );
}
