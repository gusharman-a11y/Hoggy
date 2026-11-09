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

/** Kinds a snapped (auto-read) receipt can be: the upload kinds plus flights. */
export const SNAP_KINDS = ["flight", ...UPLOAD_KINDS] as const;
export type SnapKind = (typeof SNAP_KINDS)[number];
export const SNAP_KIND_LABELS: Record<SnapKind, string> = { flight: "Flight", ...UPLOAD_KIND_LABELS };
