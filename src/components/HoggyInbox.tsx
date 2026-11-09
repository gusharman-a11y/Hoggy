import CopyButton from "./CopyButton";

/** The doctor's personal Hoggy address, a copy button and how to forward to it. */
export default function HoggyInbox({ address }: { address: string }) {
  return (
    <section className="hoggy-inbox" data-testid="hoggy-inbox" aria-labelledby="hoggy-inbox-title">
      <h2 id="hoggy-inbox-title">Your receipt inbox</h2>
      <p className="inbox-address">
        <code data-testid="hoggy-inbox-address">{address}</code> <CopyButton text={address} />
      </p>
      <p className="muted">
        Forward any receipt here — flights, hotel, registration, taxis. We read it, put it on the right trip for you to
        check, and keep anything that doesn’t fit a trip in your private Unfiled receipts (deleted after 7 days).
      </p>
      <details className="how-to">
        <summary>How to forward</summary>
        <ol>
          <li>Open the receipt email (or the email you sent yourself a photo or PDF in).</li>
          <li>Tap <strong>Forward</strong> and paste the address above into “To”.</li>
          <li>
            Send it from <strong>your account email</strong> — mail from other addresses is ignored.
          </li>
          <li>PDF, JPG and PNG attachments are read; an email with no attachment is read as it is.</li>
        </ol>
      </details>
    </section>
  );
}
