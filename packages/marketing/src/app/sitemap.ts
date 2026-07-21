import type { MetadataRoute } from "next";

import { absoluteUrl, resourceSlugs } from "@/lib/site";

const corePages = ["/", "/producto", "/precios", "/recursos", "/para-ia"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const updatedAt = new Date();
  const pages: MetadataRoute.Sitemap = corePages.map((path) => ({
    url: absoluteUrl(path),
    lastModified: updatedAt,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/producto" ? 0.9 : 0.8,
  }));
  const resources: MetadataRoute.Sitemap = resourceSlugs.map((slug) => ({
    url: absoluteUrl(`/recursos/${slug}`),
    lastModified: updatedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return pages.concat(resources);
}
