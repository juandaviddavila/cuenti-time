import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["Googlebot", "Bingbot", "OAI-SearchBot"],
        allow: "/",
      },
      {
        // GPTBot es el crawler de entrenamiento; OAI-SearchBot conserva acceso.
        userAgent: "GPTBot",
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
