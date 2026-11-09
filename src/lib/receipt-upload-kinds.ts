/** What an uploaded receipt is for. Client-safe (no node imports). */
export const UPLOAD_KINDS = ["registration", "taxi", "meals", "accommodation", "transport", "other"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];
export const UPLOAD_KIND_LABELS: Record<UploadKind, string> = {
  registration: "Registration",
  taxi: "Taxi / rideshare",
  meals: "Meals",
  accommodation: "Accommodation",
  transport: "Other transport",
  other: "Other",
};
