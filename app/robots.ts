import type { MetadataRoute } from "next";

const origin = "https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/api/", "/oauth/", "/connect/"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
