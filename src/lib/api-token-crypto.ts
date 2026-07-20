import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const raw =
    process.env.API_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim();
  if (!raw) {
    throw new Error("API_TOKEN_ENCRYPTION_KEY o JWT_SECRET requerido para cifrar tokens");
  }
  return createHash("sha256").update(raw).digest();
}

/** Cifra el token en claro. Formato: iv:tag:ciphertext (hex). */
export function encryptApiToken(rawToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(rawToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptApiToken(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato de token cifrado inválido");
  }
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = createDecipheriv(
    ALGO,
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
