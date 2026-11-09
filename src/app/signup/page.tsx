import Link from "next/link";
import SignupForm from "./SignupForm";

export const metadata = { title: "Sign up · StudyLeave" };

export default function SignupPage() {
  return (
    <main className="narrow">
      <h1>Sign up</h1>
      <SignupForm />
      <p>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
