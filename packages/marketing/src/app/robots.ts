import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: ["Googlebot", "Bingbot", "OAI-SearchBot"], allow: "/" },
      {
        // GPTBot entrena modelos; OAI-SearchBot conserva acceso a búsqueda.
        userAgent: "GPTBot",
        disallow: "/",
      },
      { userAgent: "*", allow: "/" },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
