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
  const where =
    tool.processing === "mac-helper"
      ? "Processed locally on your Mac by Folio for Mac."
      : tool.processing === "hybrid"
        ? "Free, no account — browser conversion, or high fidelity with Word on Mac."
        : "Free, no account — processed in your browser.";
  return {
    title: tool.name,
    description: `${tool.description} ${where}`,
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
