import { NextResponse } from "next/server";

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://192.168.1.230:7578"
  );
}

export async function GET() {
  const base = appBaseUrl();
  const apiUrl = `${base}/api/v1`;

  const swaggerHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>cuenti time API — Documentación</title>
  <link rel="stylesheet" href="/api/v1/docs/assets/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .api-base-banner {
      font-family: ui-sans-serif, system-ui, sans-serif;
      padding: 12px 20px;
      background: #111827;
      color: #f9fafb;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      font-size: 14px;
    }
    .api-base-banner strong { color: #93c5fd; font-weight: 600; }
    .api-base-banner code {
      background: #1f2937;
      padding: 4px 8px;
      border-radius: 6px;
      color: #e5e7eb;
      word-break: break-all;
    }
    .api-base-banner a { color: #93c5fd; }
  </style>
</head>
<body>
  <div class="api-base-banner">
    <strong>URL de la API</strong>
    <code id="api-base-url">${apiUrl}</code>
    <span style="opacity:.75">Base path para Try it out · OpenAPI en
      <a href="/api/v1/openapi">/api/v1/openapi</a>
    </span>
  </div>
  <div id="swagger-ui"></div>
  <script src="/api/v1/docs/assets/swagger-ui-bundle.js"></script>
  <script src="/api/v1/docs/assets/swagger-ui-standalone-preset.js"></script>
  <script>
    const API_BASE = ${JSON.stringify(apiUrl)};
    SwaggerUIBundle({
      url: '/api/v1/openapi',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      supportedSubmitMethods: ['get', 'post', 'put', 'delete'],
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`;

  return new NextResponse(swaggerHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
