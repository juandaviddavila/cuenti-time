export interface Country {
  code: string;
  name: string;
  aliases: string[];
}

const PRIORITY_CODES = ["CO", "PA"] as const;

const COUNTRY_ROWS: ReadonlyArray<readonly [string, string, ...string[]]> = [
  ["CO", "Colombia"],
  ["PA", "Panamá"],
  ["AR", "Argentina"],
  ["BO", "Bolivia"],
  ["BR", "Brasil"],
  ["CL", "Chile"],
  ["CR", "Costa Rica"],
  ["CU", "Cuba"],
  ["DO", "República Dominicana"],
  ["EC", "Ecuador"],
  ["SV", "El Salvador"],
  ["GT", "Guatemala"],
  ["HN", "Honduras"],
  ["MX", "México", "mexico"],
  ["NI", "Nicaragua"],
  ["PY", "Paraguay"],
  ["PE", "Perú", "peru"],
  ["PR", "Puerto Rico"],
  ["UY", "Uruguay"],
  ["VE", "Venezuela"],
  ["US", "Estados Unidos", "eeuu", "usa", "united states"],
  ["CA", "Canadá", "canada"],
  ["ES", "España", "espana"],
  ["PT", "Portugal"],
  ["FR", "Francia"],
  ["DE", "Alemania"],
  ["IT", "Italia"],
  ["GB", "Reino Unido", "uk", "inglaterra"],
  ["IE", "Irlanda"],
  ["NL", "Países Bajos", "holanda"],
  ["BE", "Bélgica"],
  ["CH", "Suiza"],
  ["AT", "Austria"],
  ["SE", "Suecia"],
  ["NO", "Noruega"],
  ["DK", "Dinamarca"],
  ["FI", "Finlandia"],
  ["PL", "Polonia"],
  ["CZ", "Chequia"],
  ["RO", "Rumanía"],
  ["GR", "Grecia"],
  ["TR", "Turquía"],
  ["RU", "Rusia"],
  ["UA", "Ucrania"],
  ["CN", "China"],
  ["JP", "Japón"],
  ["KR", "Corea del Sur"],
  ["IN", "India"],
  ["AU", "Australia"],
  ["NZ", "Nueva Zelanda"],
  ["ZA", "Sudáfrica"],
  ["EG", "Egipto"],
  ["MA", "Marruecos"],
  ["NG", "Nigeria"],
  ["KE", "Kenia"],
  ["AE", "Emiratos Árabes Unidos", "emiratos"],
  ["SA", "Arabia Saudita"],
  ["IL", "Israel"],
  ["SG", "Singapur"],
  ["TH", "Tailandia"],
  ["VN", "Vietnam"],
  ["PH", "Filipinas"],
  ["ID", "Indonesia"],
  ["MY", "Malasia"],
  ["AF", "Afganistán"],
  ["AL", "Albania"],
  ["DZ", "Argelia"],
  ["AD", "Andorra"],
  ["AO", "Angola"],
  ["AM", "Armenia"],
  ["AZ", "Azerbaiyán"],
  ["BH", "Baréin"],
  ["BD", "Bangladés"],
  ["BY", "Bielorrusia"],
  ["BZ", "Belice"],
  ["BJ", "Benín"],
  ["BT", "Bután"],
  ["BA", "Bosnia y Herzegovina"],
  ["BW", "Botsuana"],
  ["BN", "Brunéi"],
  ["BG", "Bulgaria"],
  ["BF", "Burkina Faso"],
  ["BI", "Burundi"],
  ["KH", "Camboya"],
  ["CM", "Camerún"],
  ["CV", "Cabo Verde"],
  ["TD", "Chad"],
  ["CY", "Chipre"],
  ["CI", "Costa de Marfil"],
  ["HR", "Croacia"],
  ["EE", "Estonia"],
  ["ET", "Etiopía"],
  ["FJ", "Fiyi"],
  ["GA", "Gabón"],
  ["GM", "Gambia"],
  ["GE", "Georgia"],
  ["GH", "Ghana"],
  ["GN", "Guinea"],
  ["GY", "Guyana"],
  ["HT", "Haití"],
  ["HU", "Hungría"],
  ["IS", "Islandia"],
  ["IQ", "Irak"],
  ["IR", "Irán"],
  ["JM", "Jamaica"],
  ["JO", "Jordania"],
  ["KZ", "Kazajistán"],
  ["KW", "Kuwait"],
  ["LV", "Letonia"],
  ["LB", "Líbano"],
  ["LY", "Libia"],
  ["LT", "Lituania"],
  ["LU", "Luxemburgo"],
  ["MG", "Madagascar"],
  ["MW", "Malaui"],
  ["MV", "Maldivas"],
  ["ML", "Malí"],
  ["MT", "Malta"],
  ["MR", "Mauritania"],
  ["MU", "Mauricio"],
  ["MD", "Moldavia"],
  ["MC", "Mónaco"],
  ["MN", "Mongolia"],
  ["ME", "Montenegro"],
  ["MZ", "Mozambique"],
  ["MM", "Myanmar"],
  ["NA", "Namibia"],
  ["NP", "Nepal"],
  ["OM", "Omán"],
  ["PK", "Pakistán"],
  ["PS", "Palestina"],
  ["QA", "Catar"],
  ["RS", "Serbia"],
  ["SN", "Senegal"],
  ["SK", "Eslovaquia"],
  ["SI", "Eslovenia"],
  ["SO", "Somalia"],
  ["LK", "Sri Lanka"],
  ["SD", "Sudán"],
  ["SR", "Surinam"],
  ["SY", "Siria"],
  ["TW", "Taiwán"],
  ["TZ", "Tanzania"],
  ["TN", "Túnez"],
  ["UG", "Uganda"],
  ["UZ", "Uzbekistán"],
  ["YE", "Yemen"],
  ["ZM", "Zambia"],
  ["ZW", "Zimbabue"],
];

function uniqueCountries(
  rows: ReadonlyArray<readonly [string, string, ...string[]]>
): Country[] {
  const seen = new Set<string>();
  const countries: Country[] = [];
  for (const [code, name, ...aliases] of rows) {
    if (seen.has(code)) continue;
    seen.add(code);
    countries.push({ code, name, aliases });
  }
  return countries;
}

export const COUNTRIES: Country[] = uniqueCountries(COUNTRY_ROWS);

const COUNTRIES_BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export function normalizeCountryText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function isCountryCode(value: string): boolean {
  return COUNTRIES_BY_CODE.has(value.toUpperCase());
}

export function findCountry(code?: string | null): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES_BY_CODE.get(code.toUpperCase());
}

export function countryFlagEmoji(code: string): string {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "";
  return String.fromCodePoint(...Array.from(upper, (char) => 127397 + char.charCodeAt(0)));
}

const COUNTRY_CENTERS: Record<string, { lat: number; lng: number }> = {
  CO: { lat: 4.711, lng: -74.0721 },
  PA: { lat: 8.9824, lng: -79.5199 },
  AR: { lat: -34.6037, lng: -58.3816 },
  BO: { lat: -16.4897, lng: -68.1193 },
  BR: { lat: -15.7975, lng: -47.8919 },
  CL: { lat: -33.4489, lng: -70.6693 },
  CR: { lat: 9.9281, lng: -84.0907 },
  CU: { lat: 23.1136, lng: -82.3666 },
  DO: { lat: 18.4861, lng: -69.9312 },
  EC: { lat: -0.1807, lng: -78.4678 },
  SV: { lat: 13.6929, lng: -89.2182 },
  GT: { lat: 14.6349, lng: -90.5069 },
  HN: { lat: 14.0723, lng: -87.1921 },
  MX: { lat: 19.4326, lng: -99.1332 },
  NI: { lat: 12.115, lng: -86.2362 },
  PY: { lat: -25.2637, lng: -57.5759 },
  PE: { lat: -12.0464, lng: -77.0428 },
  PR: { lat: 18.4655, lng: -66.1057 },
  UY: { lat: -34.9011, lng: -56.1645 },
  VE: { lat: 10.4806, lng: -66.9036 },
  US: { lat: 38.9072, lng: -77.0369 },
  ES: { lat: 40.4168, lng: -3.7038 },
};

export function getCountryMapCenter(code?: string | null): { lat: number; lng: number } {
  if (!code) return COUNTRY_CENTERS.CO;
  return COUNTRY_CENTERS[code.toUpperCase()] ?? COUNTRY_CENTERS.CO;
}

export function searchCountries(query: string): Country[] {
  const normalized = normalizeCountryText(query);
  const filtered = normalized
    ? COUNTRIES.filter((country) => {
        if (country.code.toLowerCase() === normalized) return true;
        if (normalizeCountryText(country.name).includes(normalized)) return true;
        return country.aliases.some((alias) => normalizeCountryText(alias).includes(normalized));
      })
    : COUNTRIES;

  return filtered.slice().sort((a, b) => {
    const aPriority = (PRIORITY_CODES as readonly string[]).includes(a.code) ? 0 : 1;
    const bPriority = (PRIORITY_CODES as readonly string[]).includes(b.code) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.name.localeCompare(b.name, "es");
  });
}
