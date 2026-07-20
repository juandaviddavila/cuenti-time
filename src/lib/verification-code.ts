import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

const CODE_LENGTH = 6;
const CODE_TTL_MS = 15 * 60 * 1000;

export function generateVerificationCode(): string {
  return String(randomInt(10 ** (CODE_LENGTH - 1), 10 ** CODE_LENGTH - 1));
}

export async function hashVerificationCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyVerificationCode(
  code: string,
  hashedCode: string
): Promise<boolean> {
  return bcrypt.compare(code, hashedCode);
}

export function getVerificationExpiry(): Date {
  return new Date(Date.now() + CODE_TTL_MS);
}

export const VERIFICATION_CODE_TTL_MINUTES = CODE_TTL_MS / 60_000;
