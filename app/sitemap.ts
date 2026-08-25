import type { MetadataRoute } from "next";

const origin = "https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-25T00:00:00-03:00");
  return [
    { url: origin, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/privacy`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/terms`, lastModified, changeFrequency: "monthly", priority: 0.5 },
  ];
}
