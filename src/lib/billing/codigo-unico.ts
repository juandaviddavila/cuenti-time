import { randomBytes } from "crypto";

const NUMERIC_ALPHABET = "0123456789";

function randomNumeric(len: number): string {
  const base = NUMERIC_ALPHABET.length;
  const out: string[] = [];
  const max = 256 - (256 % base);
  let buf = randomBytes(Math.max(len * 2, 16));
  let i = 0;

  while (out.length < len) {
    if (i >= buf.length) {
      buf = randomBytes(Math.max(len * 2, 16));
      i = 0;
    }
    const v = buf[i++];
    if (v < max) {
      out.push(NUMERIC_ALPHABET[v % base]);
    }
  }

  return out.join("");
}

export interface CodigoUnicoInput {
  idEmpresa: number;
  tipoDocumento: number;
  idUsuario: number;
  suffixLen?: number;
}

/**
 * Formato: {empresa}{tipoDocumento}{empleado}{sufijo8digitos}
 * Ejemplo: 291847263051
 */
export function generateCodigoUnicoNumeric({
  idEmpresa,
  tipoDocumento,
  idUsuario,
  suffixLen = 8,
}: CodigoUnicoInput): string {
  const prefix = `${idEmpresa}${tipoDocumento}${idUsuario}`;
  return `${prefix}${randomNumeric(suffixLen)}`;
}

export function isNumericCodigoUnico(value: string): boolean {
  return /^\d+$/.test(value) && value.length > 0;
}
