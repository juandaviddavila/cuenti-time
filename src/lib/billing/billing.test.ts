import assert from "node:assert/strict";
import {
  computeBillingQuote,
  BILLING_PERIOD_DAYS,
  roundMoney,
} from "./pricing";
import { assertInvoiceCancellable, BillingConflictError } from "./invoice-rules";
import { generateCodigoUnicoNumeric, isNumericCodigoUnico } from "./codigo-unico";
import {
  BILLING_INVOICE_ALREADY_PAID_MESSAGE,
} from "./types";

const config = {
  priceCopPerEmployeeMonthly: 3500,
  priceUsdPerEmployeeMonthly: 1,
};

function testMonthlySubscription() {
  const quote = computeBillingQuote(
    { targetEmployeeSlots: 4, currency: "COP" },
    config,
    {
      usedSlots: 2,
      currentEmployeeSlots: 3,
      subscriptionExpiresAt: null,
      subscriptionStatus: "none",
      now: new Date("2026-01-15T12:00:00Z"),
    }
  );
  assert.equal(quote.kind, "subscription");
  assert.equal(quote.totalAmount, 4 * 3500);
  assert.equal(quote.isProrated, false);
}

function testAddonProrationFifteenDays() {
  const now = new Date("2026-06-15T12:00:00Z");
  const expires = new Date("2026-06-30T12:00:00Z"); // 15 días
  const quote = computeBillingQuote(
    { targetEmployeeSlots: 5, currency: "COP" },
    config,
    {
      usedSlots: 4,
      currentEmployeeSlots: 4,
      subscriptionExpiresAt: expires,
      subscriptionStatus: "active",
      now,
    }
  );
  assert.equal(quote.kind, "addon");
  assert.equal(quote.billedEmployeeQuantity, 1);
  assert.equal(quote.proratedDays, 15);
  assert.equal(
    quote.totalAmount,
    roundMoney(1 * 3500 * (15 / BILLING_PERIOD_DAYS), "COP")
  );
  assert.equal(quote.totalAmount, 1750);
}

function testUsdTwoDecimals() {
  const now = new Date("2026-06-15T12:00:00Z");
  const expires = new Date("2026-06-20T12:00:00Z"); // 5 días
  const quote = computeBillingQuote(
    { targetEmployeeSlots: 6, currency: "USD" },
    config,
    {
      usedSlots: 5,
      currentEmployeeSlots: 5,
      subscriptionExpiresAt: expires,
      subscriptionStatus: "active",
      now,
    }
  );
  assert.equal(quote.totalAmount, roundMoney(1 * (5 / 30), "USD"));
}

function testRejectUnderUse() {
  assert.throws(() =>
    computeBillingQuote(
      { targetEmployeeSlots: 1, currency: "COP" },
      config,
      {
        usedSlots: 3,
        currentEmployeeSlots: 3,
        subscriptionExpiresAt: null,
        subscriptionStatus: "none",
      }
    )
  );
}

function testCancelRules() {
  assert.throws(
    () => assertInvoiceCancellable({ status: "paid", paidAt: new Date() }),
    (err: unknown) =>
      err instanceof BillingConflictError &&
      err.message === BILLING_INVOICE_ALREADY_PAID_MESSAGE
  );
  assert.throws(() =>
    assertInvoiceCancellable({ status: "cancelled", paidAt: null })
  );
  assert.doesNotThrow(() =>
    assertInvoiceCancellable({ status: "pending", paidAt: null })
  );
}

function testCodigoUnico() {
  const code = generateCodigoUnicoNumeric({
    idEmpresa: 2,
    tipoDocumento: 9,
    idUsuario: 1,
  });
  assert.ok(code.startsWith("291"));
  assert.equal(code.length, 11);
  assert.ok(isNumericCodigoUnico(code));
}

testMonthlySubscription();
testAddonProrationFifteenDays();
testUsdTwoDecimals();
testRejectUnderUse();
testCancelRules();
testCodigoUnico();

console.log("billing tests: 6 passed");
