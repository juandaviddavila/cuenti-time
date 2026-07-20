import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const swaggerUiPath = join(process.cwd(), "node_modules", "swagger-ui-dist");

const ALLOWED_FILES: Record<string, string> = {
  "swagger-ui.css": "text/css; charset=utf-8",
  "swagger-ui-bundle.js": "application/javascript; charset=utf-8",
  "swagger-ui-standalone-preset.js": "application/javascript; charset=utf-8",
  "favicon-32x32.png": "image/png",
  "favicon-16x16.png": "image/png",
};

type RouteParams = { params: { file: string } };

export async function GET(_request: Request, { params }: RouteParams) {
  const contentType = ALLOWED_FILES[params.file];

  if (!contentType) {
    return NextResponse.json({ error: "Asset no encontrado" }, { status: 404 });
  }

  const file = await readFile(join(swaggerUiPath, params.file));

  return new NextResponse(file, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
