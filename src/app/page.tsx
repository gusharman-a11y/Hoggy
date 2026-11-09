import { APP_NAME, TAGLINE } from "@/lib/site";

export default function Home() {
  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p>{TAGLINE}</p>
    </main>
  );
}
