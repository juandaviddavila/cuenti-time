import {
  DIAL_COUNTRIES,
  PREFERRED_DIAL_ISO2,
  type DialCountry,
} from "./dial-countries";

const PREFERRED_SET = new Set<string>(PREFERRED_DIAL_ISO2);

export function flagEmoji(iso2: string): string {
  const code = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(
    ...Array.from(code, (char) => 0x1f1e6 - 65 + char.charCodeAt(0))
  );
}

export function preferredCountryForDial(dial: string): DialCountry | undefined {
  const matches = DIAL_COUNTRIES.filter((country) => country.dial === dial);
  if (matches.length === 0) return undefined;
  return matches.find((country) => PREFERRED_SET.has(country.iso2)) ?? matches[0];
}

export function matchDialFromE164(e164: string): DialCountry | undefined {
  const digits = e164.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const candidates = DIAL_COUNTRIES.map((country) => ({
    country,
    dialDigits: country.dial.replace(/[^\d]/g, ""),
  }))
    .filter((item) => digits.startsWith(item.dialDigits))
    .sort((a, b) => b.dialDigits.length - a.dialDigits.length);
  if (candidates.length === 0) return undefined;
  const bestLen = candidates[0].dialDigits.length;
  const sameLen = candidates.filter((item) => item.dialDigits.length === bestLen);
  return (
    sameLen.find((item) => PREFERRED_SET.has(item.country.iso2)) ?? sameLen[0]
  ).country;
}

export function composePhoneE164(
  phoneCountryCode: string,
  phoneNumber: string
): string | null {
  const local = phoneNumber.replace(/[\s.\-()]/g, "").replace(/\D/g, "");
  if (!local) return null;
  const ccDigits = phoneCountryCode.replace(/[^\d]/g, "");
  if (!ccDigits) return null;
  return local.startsWith(ccDigits) ? `+${local}` : `+${ccDigits}${local}`;
}

export function normalizeToE164(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function e164ToWhatsAppTo(e164: string): string {
  return e164.replace(/^\+/, "");
}

export function splitPhoneE164(e164: string | null | undefined): {
  phoneCountryCode: string;
  phoneNumber: string;
  iso2: string;
} {
  const raw = (e164 ?? "").trim();
  if (!raw) {
    return { phoneCountryCode: "+57", phoneNumber: "", iso2: "CO" };
  }
  const withPlus = raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
  const country = matchDialFromE164(withPlus);
  if (!country) {
    return {
      phoneCountryCode: "+57",
      phoneNumber: withPlus.replace(/^\+/, "").replace(/\D/g, ""),
      iso2: "CO",
    };
  }
  const dialDigits = country.dial.replace(/[^\d]/g, "");
  const allDigits = withPlus.replace(/\D/g, "");
  const national = allDigits.startsWith(dialDigits)
    ? allDigits.slice(dialDigits.length)
    : allDigits;
  return {
    phoneCountryCode: country.dial,
    phoneNumber: national,
    iso2: country.iso2,
  };
}

export function searchDialCountries(query: string): DialCountry[] {
  const q = query.trim().toLowerCase();
  const pool = !q
    ? [...DIAL_COUNTRIES]
    : DIAL_COUNTRIES.filter((country) => {
        const dialDigits = country.dial.replace(/\D/g, "");
        const qDigits = q.replace(/\D/g, "");
        const name = country.nameEs.toLowerCase();
        return (
          name.includes(q) ||
          country.iso2.toLowerCase().includes(q) ||
          country.dial.includes(q) ||
          (qDigits.length > 0 &&
            (dialDigits.startsWith(qDigits) || qDigits.startsWith(dialDigits)))
        );
      });

  const preferred = PREFERRED_DIAL_ISO2.map((iso) =>
    pool.find((country) => country.iso2 === iso)
  ).filter((country): country is DialCountry => Boolean(country));
  const preferredSet = new Set(preferred.map((country) => country.iso2));
  const rest = pool
    .filter((country) => !preferredSet.has(country.iso2))
    .sort((a, b) => a.nameEs.localeCompare(b.nameEs, "es"));
  return [...preferred, ...rest];
}

export function maskPhoneE164(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 6) return e164;
  return `+${digits.slice(0, 2)}••••${digits.slice(-4)}`;
}
