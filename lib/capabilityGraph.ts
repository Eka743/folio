/**
 * The public browser capability graph.
 *
 * `formatMatrix.ts` owns the public conversion metadata. This graph adds the
 * action semantics used by detection and Universal Drop, so a capability is
 * advertised only when it points at a public browser-local implementation.
 */

import {
  PUBLIC_WEB_FORMAT_MATRIX,
  type FormatConversion,
} from "./formatMatrix";

export type CapabilityFormat =
  | "pdf"
  | "jpeg"
  | "png"
  | "docx"
  | "markdown"
  | "pptx"
  | "xlsx"
  | "pages"
  | "keynote"
  | "numbers";

export type CapabilityActionId =
  | "merge-pdf"
  | "split-pdf"
  | "rotate-pdf"
  | "compress-pdf"
  | "pdf-to-jpg"
  | "image-to-pdf"
  | "docx-to-pdf"
  | "markdown-to-pdf"
  | "pdf-to-markdown"
  | "combine-to-pdf"
  | "embedded-pdf"
  | "pages-to-pdf"
  | "pages-to-word"
  | "keynote-to-pdf"
  | "keynote-to-powerpoint"
  | "numbers-to-xlsx"
  | "numbers-to-pdf"
  | "powerpoint-to-pdf"
  | "excel-to-pdf";

export type CapabilityKind = "conversion" | "preview";
export type CapabilityBrowserStatus = "ready" | "beta";

export interface CapabilityDefinition {
  id: string;
  action: CapabilityActionId;
  kind: CapabilityKind;
  inputs: CapabilityFormat[];
  output: string;
  toolSlug?: string;
  category: "PDF" | "Documents" | "Images";
  title: string;
  description: string;
  browser: CapabilityBrowserStatus;
  limitation: string;
}

function toCapabilityFormat(input: string): CapabilityFormat {
  if (input === "jpg") return "jpeg";
  if (input === "md") return "markdown";
  return input as CapabilityFormat;
}

function actionForConversion(conversion: FormatConversion): CapabilityActionId {
  return conversion.id === "images-to-pdf"
    ? "image-to-pdf"
    : conversion.id as CapabilityActionId;
}

const conversionCapabilities: CapabilityDefinition[] =
  PUBLIC_WEB_FORMAT_MATRIX.map((conversion) => ({
    id: conversion.id,
    action: actionForConversion(conversion),
    kind: "conversion",
    inputs: conversion.inputs.map(toCapabilityFormat),
    output: conversion.output,
    toolSlug: conversion.toolSlug,
    category: conversion.category,
    title: conversion.title,
    description: conversion.description,
    browser: conversion.browser === "full" ? "ready" : "beta",
    limitation: conversion.limitation,
  }));

export const CAPABILITY_GRAPH: readonly CapabilityDefinition[] = [
  ...conversionCapabilities,
  {
    id: "embedded-pdf",
    action: "embedded-pdf",
    kind: "preview",
    inputs: ["pages", "keynote", "numbers"],
    output: "pdf-preview",
    category: "Documents",
    title: "Export embedded PDF preview",
    description: "Export an Apple document’s own QuickLook PDF preview.",
    browser: "beta",
    limitation: "An embedded preview is not native conversion or an editable output.",
  },
] as const;

export function getCapability(action: CapabilityActionId): CapabilityDefinition | undefined {
  return CAPABILITY_GRAPH.find((definition) => definition.action === action);
}

export function getConversionCapabilities(): readonly CapabilityDefinition[] {
  return CAPABILITY_GRAPH.filter((definition) => definition.kind === "conversion");
}

export function actionsForKinds(
  kinds: readonly CapabilityFormat[],
  options: { hasEmbeddedPdf?: boolean } = {},
): CapabilityActionId[] {
  if (kinds.length === 0) return [];
  const unique = [...new Set(kinds)];
  const first = unique[0];
  const allSame = unique.length === 1;
  const allCombinable = kinds.every((kind) =>
    getCapability("combine-to-pdf")?.inputs.includes(kind) ?? false,
  );

  if (kinds.length === 1 && ["pages", "keynote", "numbers"].includes(first)) {
    const actions: CapabilityActionId[] = [];
    if (options.hasEmbeddedPdf) actions.push("embedded-pdf");
    if (first === "pages") actions.push("pages-to-pdf", "pages-to-word");
    else if (first === "keynote") actions.push("keynote-to-pdf", "keynote-to-powerpoint");
    else actions.push("numbers-to-xlsx", "numbers-to-pdf");
    return actions;
  }
  if (kinds.length === 1 && first === "pptx") return ["powerpoint-to-pdf"];
  if (kinds.length === 1 && first === "xlsx") return ["excel-to-pdf"];
  if (!allCombinable) return [];
  if (allSame && first === "pdf") {
    if (kinds.length > 1) return ["merge-pdf"];
    return [
      "merge-pdf",
      "split-pdf",
      "rotate-pdf",
      "compress-pdf",
      "pdf-to-jpg",
      "pdf-to-markdown",
    ];
  }
  if (allSame && first === "docx") return ["docx-to-pdf"];
  if (allSame && (first === "jpeg" || first === "png")) return ["image-to-pdf"];
  if (unique.every((kind) => kind === "jpeg" || kind === "png")) return ["image-to-pdf"];
  if (allSame && first === "markdown" && kinds.length === 1) return ["markdown-to-pdf"];
  return ["combine-to-pdf"];
}

export function capabilityFormatForKind(kind: string): CapabilityFormat | undefined {
  const known: CapabilityFormat[] = [
    "pdf",
    "jpeg",
    "png",
    "docx",
    "markdown",
    "pptx",
    "xlsx",
    "pages",
    "keynote",
    "numbers",
  ];
  return known.includes(kind as CapabilityFormat)
    ? kind as CapabilityFormat
    : undefined;
}
