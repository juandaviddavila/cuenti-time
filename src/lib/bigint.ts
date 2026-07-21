import { z } from "zod";

/**
 * BigInt ↔ string conversion for JSON-safe serialization.
 * BigInt values MUST NEVER reach JSON.stringify without these helpers.
 */

/** Convert BigInt to decimal string. Passes strings through and handles null/undefined. */
export function bigintToString(value: bigint): string;
export function bigintToString(value: string): string;
export function bigintToString(value: bigint | null): string | null;
export function bigintToString(value: string | null): string | null;
export function bigintToString(value: bigint | undefined): string | undefined;
export function bigintToString(value: string | undefined): string | undefined;
export function bigintToString(value: string | bigint | null | undefined): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return typeof value === "bigint" ? value.toString() : value;
}

/** Parse decimal string to BigInt. Throws on non-numeric input. Passes through bigint values. */
export function stringToBigint(value: string | bigint): bigint;
export function stringToBigint(value: string | bigint | null): bigint | null;
export function stringToBigint(value: string | bigint | undefined): bigint | undefined;
export function stringToBigint(value: string | bigint | null | undefined): bigint | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === "bigint") return value;
  if (!/^-?\d+$/.test(value)) throw new Error(`Invalid BigInt string: "${value}"`);
  return BigInt(value);
}

/** Parse decimal string to BigInt. Returns null on invalid input. */
export function stringToBigintSafe(value: string | null | undefined): bigint | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  if (!/^-?\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/** JSON.stringify replacer — converts BigInt values to strings. */
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

/** Type-level representation of a value after BigInt JSON serialization. */
export type JsonSafe<T> = T extends bigint
  ? string
  : T extends readonly (infer U)[]
    ? JsonSafe<U>[]
    : T extends object
      ? { [K in keyof T]: JsonSafe<T[K]> }
      : T;

/**
 * Serialize a value to JSON-safe object: converts all BigInt values to strings.
 * Use in API route responses: NextResponse.json(serializeRecord(record)).
 */
export function serializeRecord<T>(record: T): JsonSafe<T> {
  return JSON.parse(JSON.stringify(record, bigintReplacer)) as JsonSafe<T>;
}

/** Serialize an array of records. */
export function serializeRecords<T>(records: T[]): JsonSafe<T>[] {
  return records.map(serializeRecord);
}

/** Zod schema for BigInt autoincrement IDs. */
export const bigintIdSchema = z.coerce.bigint().positive();

/** Zod schema for optional/nullable BigInt FKs. */
export const bigintIdNullishSchema = z.coerce.bigint().positive().nullish();

/**
 * Returns the companyId filter for Prisma queries based on role.
 * SAAS_SUPER_ADMIN sees all; everyone else is scoped to their single company.
 * This is the bigint counterpart of getCompanyFilter() in tenant.ts.
 */
export function getCompanyFilterBigInt(session: { role: string; companyId?: string | null }): { companyId: bigint } | Record<string, never> {
  if (session.role === "SAAS_SUPER_ADMIN") return {};
  if (!session.companyId) return { companyId: -1n }; // no data returned
  return { companyId: stringToBigint(session.companyId) };
}

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

/** Global safety net: BigInt values serialize as decimal strings when JSON.stringify is used. */
if (typeof BigInt.prototype.toJSON !== "function") {
  BigInt.prototype.toJSON = function (this: bigint): string {
    return this.toString();
  };
}
