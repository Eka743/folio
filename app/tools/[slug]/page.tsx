import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolRunner } from "@/components/ToolRunner";
import { TOOLS, getTool } from "@/lib/tools";

export function generateStaticParams(): Array<{ slug: string }> {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return { title: "Tool not found" };
  return {
    title: tool.name,
    description: `${tool.description} Free, no account — processed in your browser.`,
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();
  return <ToolRunner tool={tool} />;
}
