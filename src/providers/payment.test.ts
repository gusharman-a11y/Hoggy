import { describe, expect, it } from "vitest";
import { getPaymentProvider, MockPayment, PaymentError, StripePayment } from "./payment";

describe("payments", () => {
  it("MockPayment always succeeds with a fresh id", async () => {
    const p = new MockPayment();
    const req = { amountCents: 45000, currency: "AUD", description: "Flight", customerEmail: "a@b.test" };
    const a = await p.charge(req);
    const b = await p.charge(req);
    expect(a).toMatchObject({ status: "succeeded", amountCents: 45000, currency: "AUD" });
    expect(a.id).toMatch(/^mockpay_[0-9a-f]{8}$/);
    expect(b.id).not.toBe(a.id);
  });

  it("rejects bad amounts and currencies", async () => {
    const p = new MockPayment();
    await expect(p.charge({ amountCents: -1, currency: "AUD", description: "", customerEmail: "" })).rejects.toThrow(PaymentError);
    await expect(p.charge({ amountCents: 1.5, currency: "AUD", description: "", customerEmail: "" })).rejects.toThrow(PaymentError);
    await expect(p.charge({ amountCents: 100, currency: "aud", description: "", customerEmail: "" })).rejects.toThrow(PaymentError);
  });

  it("uses Stripe only when STRIPE_SECRET_KEY is set", () => {
    expect(getPaymentProvider({})).toBeInstanceOf(MockPayment);
    expect(getPaymentProvider({ STRIPE_SECRET_KEY: "sk_test_x" })).toBeInstanceOf(StripePayment);
  });
});
