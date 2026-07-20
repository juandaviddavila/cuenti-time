import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://192.168.1.230:7578"
  );
}

/**
 * OpenAPI con `servers` apuntando a la URL real de la API
 * (NEXT_PUBLIC_APP_URL + /api/v1).
 */
export async function GET() {
  const yamlPath = join(process.cwd(), "public", "openapi.yml");
  let yaml = await readFile(yamlPath, "utf8");
  const apiUrl = `${appBaseUrl()}/api/v1`;

  // Reemplaza el bloque servers para que Swagger muestre y use la URL absoluta.
  yaml = yaml.replace(
    /servers:\n(?:[ \t]- url:.*\n(?:[ \t]{2,}.*\n)*)+/,
    `servers:\n  - url: ${apiUrl}\n    description: API v1 (cuenti time)\n  - url: /api/v1\n    description: Relativo al host actual\n`
  );

  return new NextResponse(yaml, {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
