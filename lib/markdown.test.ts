import { describe, expect, it } from "vitest";
import { decodeMarkdown, markdownToHtml, parseMarkdown } from "./markdown";

describe("browser Markdown renderer", () => {
  it("parses the supported block types", () => {
    const blocks = parseMarkdown(`# Title\n\nA **bold** and _italic_ paragraph.\n\n- one\n  - nested\n\n1. first\n2. second\n\n> quote\n\n| Name | Value |\n| --- | --- |\n| A | B |\n\n~~~ts\nconst answer = 42;\n~~~\n\n---`);
    expect(blocks.map((block) => block.kind)).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
      "blockquote",
      "table",
      "code",
      "rule",
    ]);
    expect(blocks[2]).toMatchObject({ kind: "list", ordered: false });
    expect(blocks[4]).toMatchObject({ kind: "blockquote" });
  });

  it("escapes raw HTML and blocks executable URLs", () => {
    const html = markdownToHtml(
      '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[bad](javascript:alert(1))\n\n![remote](https://evil.example/pixel.png)',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain('onerror="');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("https://evil.example/pixel.png");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Remote image omitted");
  });

  it("allows safe local/data images and safe links", () => {
    const html = markdownToHtml(
      '[docs](https://example.com/docs) ![pixel](data:image/png;base64,AAAA)',
    );
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it("rejects empty, binary and invalid UTF-8 input", () => {
    expect(() => decodeMarkdown(new TextEncoder().encode("  \n"))).toThrow(/No readable content/);
    expect(() => decodeMarkdown(new Uint8Array([0xff, 0xfe]))).toThrow(/valid UTF-8/);
    expect(() => decodeMarkdown(new TextEncoder().encode("hello\0world"))).toThrow(/binary data/);
  });
});
