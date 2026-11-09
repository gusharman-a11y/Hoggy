"use client";

import { useState } from "react";

/** Copies `text` to the clipboard; says "Copied" for a moment. */
export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState<"yes" | "no" | undefined>();
  return (
    <button
      type="button"
      className="secondary copy-button"
      aria-label={`${label} ${text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied("yes");
        } catch {
          setCopied("no");
        }
        setTimeout(() => setCopied(undefined), 2000);
      }}
    >
      {copied === "yes" ? "Copied" : copied === "no" ? "Select and copy" : label}
    </button>
  );
}
