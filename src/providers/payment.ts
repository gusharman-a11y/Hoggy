/**
 * Payments behind one interface. Dev/test: MockPayment (always succeeds, no
 * network). Real: StripePayment, only when STRIPE_SECRET_KEY is set (not wired
 * up yet). Money is integer cents.
 */

export interface ChargeRequest {
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
}

export interface Charge {
  /** Provider's payment id, e.g. "mockpay_1a2b3c4d". */
  id: string;
  status: "succeeded";
  amountCents: number;
  currency: string;
}

export interface PaymentProvider {
  readonly name: string;
  charge(req: ChargeRequest): Promise<Charge>;
}

/** The charge could not be made (message is shown on screen as-is). */
export class PaymentError extends Error {}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Test payments: always succeed for a valid amount; the id is unique per charge. */
export class MockPayment implements PaymentProvider {
  readonly name = "mock";
  private count = 0;

  async charge(req: ChargeRequest): Promise<Charge> {
    if (!Number.isInteger(req.amountCents) || req.amountCents < 0) throw new PaymentError("Invalid payment amount");
    if (!/^[A-Z]{3}$/.test(req.currency)) throw new PaymentError("Invalid currency");
    this.count += 1;
    const seed = `${req.customerEmail}|${req.amountCents}|${req.description}|${Date.now()}|${this.count}`;
    return {
      id: `mockpay_${hash(seed).toString(16).padStart(8, "0")}`,
      status: "succeeded",
      amountCents: req.amountCents,
      currency: req.currency,
    };
  }
}

/** Placeholder for Stripe; chosen only when STRIPE_SECRET_KEY is set. Never used in tests. */
export class StripePayment implements PaymentProvider {
  readonly name = "stripe";
  constructor(private readonly secretKey: string) {}

  async charge(): Promise<Charge> {
    void this.secretKey;
    throw new PaymentError("Card payments are not set up yet: unset STRIPE_SECRET_KEY to use test payments");
  }
}

export function getPaymentProvider(env: Record<string, string | undefined> = process.env): PaymentProvider {
  if (env.STRIPE_SECRET_KEY) return new StripePayment(env.STRIPE_SECRET_KEY);
  return new MockPayment();
}
