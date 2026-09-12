import { describe, expect, it } from "vitest";
import {
  CAPABILITY_GRAPH,
  actionsForKinds,
  getCapability,
} from "./capabilityGraph";

describe("public capability graph", () => {
  it("exposes only implemented browser conversions and one mixed batch action", () => {
    expect(CAPABILITY_GRAPH.filter((item) => item.kind === "conversion").map((item) => item.id)).toContain("combine-to-pdf");
    expect(getCapability("combine-to-pdf")?.inputs).toEqual(
      expect.arrayContaining(["pdf", "docx", "markdown", "jpeg", "png"]),
    );
    expect(actionsForKinds(["pages"])).toEqual(["pages-to-pdf", "pages-to-word"]);
    expect(actionsForKinds(["pptx"])).toEqual(["powerpoint-to-pdf"]);
    expect(actionsForKinds(["xlsx"])).toEqual(["excel-to-pdf"]);
  });

  it("selects actions from the entire batch shape", () => {
    expect(actionsForKinds(["pdf"])).toContain("split-pdf");
    expect(actionsForKinds(["pdf", "pdf"])).toEqual(["merge-pdf"]);
    expect(actionsForKinds(["docx", "docx", "docx"])).toEqual(["docx-to-pdf"]);
    expect(actionsForKinds(["jpeg", "png"])).toEqual(["image-to-pdf"]);
    expect(actionsForKinds(["pdf", "docx", "markdown", "png"])).toEqual(["combine-to-pdf"]);
    expect(actionsForKinds(["pages"], { hasEmbeddedPdf: true })).toEqual(["embedded-pdf", "pages-to-pdf", "pages-to-word"]);
  });
});
