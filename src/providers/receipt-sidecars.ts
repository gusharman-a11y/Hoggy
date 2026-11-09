import type { ReceiptReading } from "./receipt-reader";

/**
 * What MockReceiptReader "sees" in known photos (images have no text to read in tests).
 * Key = sha256 of the file bytes. Fixture files live in src/providers/__fixtures__/receipts/.
 * SAMPLE data only.
 */
export const RECEIPT_SIDECARS: Record<string, Partial<ReceiptReading>> = {
  // taxi-photo.png: a 2x2 PNG standing in for a phone photo of a taxi receipt
  "4e4729c40dd3664a50bd6f9f1027b5d71fe42761074c5325ed732c2fbd3abefe": {
    supplierName: "SAMPLE Harbour Taxis",
    supplierAbn: "51824753556",
    totalCents: 4575,
    gstCents: 416,
    date: "2027-03-10",
    isTaxInvoice: true,
    kind: "taxi",
    confidence: 0.9,
  },
};
