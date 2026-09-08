import { TOOLS } from "@/lib/tools";
import { siteUrl } from "@/lib/site";

export default function Sitemap(): Array<{
  url: string;
  lastModified: string;
}> {
  const base = siteUrl();
  const now = new Date().toISOString();
  const publicPages = [
    "privacy",
    "cookies",
    "terms",
    "legal",
    "security",
    "open-source",
    "mac",
  ];
  return [
    { url: base, lastModified: now },
    ...publicPages.map((page) => ({
      url: `${base}/${page}`,
      lastModified: now,
    })),
    ...TOOLS.map((t) => ({
      url: `${base}/tools/${t.slug}`,
      lastModified: now,
    })),
  ];
}
