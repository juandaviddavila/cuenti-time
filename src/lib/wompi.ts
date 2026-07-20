import { createHash } from "crypto";

export function getWompiPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ??
    process.env.WOMPI_PUBLIC_KEY ??
    ""
  );
}

export function getWompiIntegritySecret(): string {
  const secret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!secret) {
    throw new Error("WOMPI_INTEGRITY_SECRET no está configurado");
  }
  return secret;
}

export function getWompiEventsSecret(): string {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) {
    throw new Error("WOMPI_EVENTS_SECRET no está configurado");
  }
  return secret;
}

export function buildCheckoutIntegritySignature(
  reference: string,
  amountInCents: number,
  currency = "COP"
): string {
  const secret = getWompiIntegritySecret();
  const chain = `${reference}${amountInCents}${currency}${secret}`;
  return createHash("sha256").update(chain).digest("hex");
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return "";
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current === null || current === undefined ? "" : String(current);
}

export function verifyWompiEventChecksum(
  payload: Record<string, unknown>,
  signature: { properties: string[]; checksum: string },
  timestamp: number
): boolean {
  const secret = getWompiEventsSecret();
  const chain =
    signature.properties.map((prop) => getNestedValue(payload, prop)).join("") +
    timestamp +
    secret;
  const expected = createHash("sha256").update(chain).digest("hex");
  return expected === signature.checksum;
}

export function generatePaymentReference(): string {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `cuenti_${stamp}_${random}`;
}
