import { TOOLS } from "@/lib/tools";
import { siteUrl } from "@/lib/site";

export default function Sitemap(): Array<{
  url: string;
  lastModified: string;
}> {
  const base = siteUrl();
  const now = new Date().toISOString();
  return [
    { url: base, lastModified: now },
    { url: `${base}/privacy`, lastModified: now },
    ...TOOLS.map((t) => ({
      url: `${base}/tools/${t.slug}`,
      lastModified: now,
    })),
  ];
}
