import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ToolRunner } from "@/components/ToolRunner";
import { TOOLS, getTool, isRetiredToolSlug } from "@/lib/tools";

export function generateStaticParams(): Array<{ slug: string }> {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (isRetiredToolSlug(slug)) redirect("/");
  const tool = getTool(slug);
  if (!tool) return { title: "Tool not found" };
  const description = `${tool.description} Free, no account, processed in your browser.`;
  const shareTitle = `${tool.name} · Folio`;
  return {
    title: tool.name,
    description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title: shareTitle,
      description,
      url: `/tools/${tool.slug}`,
      siteName: "Folio",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: shareTitle,
      description,
    },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (isRetiredToolSlug(slug)) redirect("/");
  if (!tool) notFound();
  return <ToolRunner tool={tool} />;
}
