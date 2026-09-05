import { TOOLS } from "@/lib/tools";

export default function Sitemap(): Array<{
  url: string;
  lastModified: string;
}> {
  const base = "https://folio.tools";
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
