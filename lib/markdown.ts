/**
 * Small, deliberately conservative Markdown parser used by the browser
 * converter. It never injects source Markdown as HTML: raw HTML is escaped,
 * URLs are allow-listed, and remote images are represented by an honest note
 * instead of being fetched.
 */

export const MAX_MARKDOWN_BYTES = 10 * 1024 * 1024;

export type MarkdownBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "blockquote"; text: string }
  | { kind: "list"; ordered: boolean; items: Array<{ text: string; level: number }> }
  | { kind: "code"; language: string; text: string }
  | { kind: "rule" }
  | { kind: "table"; headers: string[]; rows: string[][] };

function normalizeMarkdown(source: string): string {
  return source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function isRule(line: string): boolean {
  return /^\s*(?:\*\s*){3,}$/.test(line) ||
    /^\s*(?:-\s*){3,}$/.test(line) ||
    /^\s*(?:_\s*){3,}$/.test(line);
}

function isTableDivider(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length >= 1 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function splitTableRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  let codeTicks = 0;
  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      current += char;
      continue;
    }
    if (char === "`") {
      codeTicks = codeTicks === 0 ? 1 : 0;
      current += char;
      continue;
    }
    if (char === "|" && codeTicks === 0) {
      cells.push(current.trim().replace(/\\\|/g, "|"));
      current = "";
    } else {
      current += char;
    }
  }
  if (escaped) current += "\\";
  cells.push(current.trim().replace(/\\\|/g, "|"));
  return cells;
}

function listMatch(line: string): { indent: number; ordered: boolean; text: string } | null {
  const match = /^(\s*)([-+*]|\d+[.)])\s+(.+)$/.exec(line);
  if (!match) return null;
  return {
    indent: Math.min(3, Math.floor(match[1].replace(/\t/g, "  ").length / 2)),
    ordered: /^\d/.test(match[2]),
    text: match[3],
  };
}

/** Parse the supported Markdown subset into safe, layout-oriented blocks. */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = normalizeMarkdown(source).split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index++;
      continue;
    }

    const fence = /^\s*(```+|~~~+)\s*([^\s]*)\s*$/.exec(line);
    if (fence) {
      const closing = fence[1][0];
      const code: string[] = [];
      index++;
      while (index < lines.length && !new RegExp(`^\\s*${closing}{3,}\\s*$`).test(lines[index])) {
        code.push(lines[index]);
        index++;
      }
      if (index < lines.length) index++;
      blocks.push({ kind: "code", language: fence[2], text: code.join("\n") });
      continue;
    }

    const heading = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      index++;
      continue;
    }

    if (isRule(line)) {
      blocks.push({ kind: "rule" });
      index++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index++;
      }
      blocks.push({ kind: "blockquote", text: quote.join("\n") });
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1])) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        rows.push(splitTableRow(lines[index]));
        index++;
      }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }

    const firstList = listMatch(line);
    if (firstList) {
      const items: Array<{ text: string; level: number }> = [];
      const ordered = firstList.ordered;
      while (index < lines.length) {
        const item = listMatch(lines[index]);
        if (!item || item.ordered !== ordered) break;
        items.push({ text: item.text, level: item.indent });
        index++;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index++;
    while (index < lines.length && lines[index].trim()) {
      if (/^\s*(?:#{1,6})\s+/.test(lines[index]) || /^\s*>/.test(lines[index]) ||
          isRule(lines[index]) || listMatch(lines[index]) ||
          (index + 1 < lines.length && lines[index].includes("|") && isTableDivider(lines[index + 1]))) {
        break;
      }
      paragraph.push(lines[index].trim());
      index++;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
  }

  return blocks;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function safeHref(value: string): string | null {
  const trimmed = value.trim();
  if (/^(?:https?:\/\/|mailto:|#|\/(?!\/))/i.test(trimmed) || trimmed === "#") {
    return trimmed;
  }
  return null;
}

function safeImageSource(value: string): string | null {
  const trimmed = value.trim();
  if (/^blob:/i.test(trimmed)) return trimmed;
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(trimmed)) return trimmed;
  return null;
}

function inlineCandidate(input: string): { index: number; length: number; html: string } | null {
  const candidates: Array<{ index: number; length: number; html: string }> = [];
  const image = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/.exec(input);
  if (image && image.index !== undefined) {
    const src = safeImageSource(image[2]);
    candidates.push({
      index: image.index,
      length: image[0].length,
      html: src
        ? `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(image[1])}" class="folio-md-image">`
        : `<span class="folio-md-image-note">[Remote image omitted]</span>`,
    });
  }
  const link = /\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/.exec(input);
  if (link && link.index !== undefined) {
    const href = safeHref(link[2]);
    candidates.push({
      index: link.index,
      length: link[0].length,
      html: href
        ? `<a href="${escapeAttribute(href)}" class="folio-md-link">${renderInline(link[1])}</a>`
        : renderInline(link[1]),
    });
  }
  const code = /(`+)([\s\S]*?)\1/.exec(input);
  if (code && code.index !== undefined) {
    candidates.push({ index: code.index, length: code[0].length, html: `<code>${escapeHtml(code[2])}</code>` });
  }
  const strongItalic = /(\*\*\*|___)(?=\S)([\s\S]*?\S)\1/.exec(input);
  if (strongItalic && strongItalic.index !== undefined) {
    candidates.push({ index: strongItalic.index, length: strongItalic[0].length, html: `<strong><em>${renderInline(strongItalic[2])}</em></strong>` });
  }
  const strong = /(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(input);
  if (strong && strong.index !== undefined) {
    candidates.push({ index: strong.index, length: strong[0].length, html: `<strong>${renderInline(strong[2])}</strong>` });
  }
  const emphasis = /(\*|_)(?=\S)([\s\S]*?\S)\1/.exec(input);
  if (emphasis && emphasis.index !== undefined) {
    candidates.push({ index: emphasis.index, length: emphasis[0].length, html: `<em>${renderInline(emphasis[2])}</em>` });
  }
  return candidates.sort((a, b) => a.index - b.index)[0] ?? null;
}

/** Render inline Markdown without ever allowing executable HTML through. */
export function renderInline(input: string): string {
  let remaining = input;
  let result = "";
  while (remaining.length > 0) {
    const candidate = inlineCandidate(remaining);
    if (!candidate) {
      result += escapeHtml(remaining).replace(/ {2}\n/g, "<br>");
      break;
    }
    result += escapeHtml(remaining.slice(0, candidate.index)).replace(/ {2}\n/g, "<br>");
    result += candidate.html;
    remaining = remaining.slice(candidate.index + candidate.length);
  }
  return result;
}

function renderList(block: Extract<MarkdownBlock, { kind: "list" }>): string {
  const tag = block.ordered ? "ol" : "ul";
  return `<${tag}>${block.items
    .map((item) => `<li class="folio-md-level-${item.level}">${renderInline(item.text)}</li>`)
    .join("")}</${tag}>`;
}

function renderTable(block: Extract<MarkdownBlock, { kind: "table" }>): string {
  const width = Math.max(block.headers.length, ...block.rows.map((row) => row.length), 1);
  const normalize = (row: string[]) => Array.from({ length: width }, (_, index) => row[index] ?? "");
  return `<div class="folio-md-table-wrap"><table><thead><tr>${normalize(block.headers)
    .map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead><tbody>${block.rows
      .map((row) => `<tr>${normalize(row).map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></div>`;
}

/** Return a styled, safe HTML representation for the page renderer. */
export function markdownToHtml(source: string): string {
  return parseMarkdown(source).map((block) => {
    switch (block.kind) {
      case "heading":
        return `<h${block.level}>${renderInline(block.text)}</h${block.level}>`;
      case "paragraph":
        return `<p>${renderInline(block.text)}</p>`;
      case "blockquote":
        return `<blockquote>${renderInline(block.text)}</blockquote>`;
      case "list":
        return renderList(block);
      case "code":
        return `<pre><code${block.language ? ` data-language="${escapeAttribute(block.language)}"` : ""}>${escapeHtml(block.text)}</code></pre>`;
      case "rule":
        return "<hr>";
      case "table":
        return renderTable(block);
    }
  }).join("\n");
}

export function decodeMarkdown(bytes: Uint8Array): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.trim()) throw new Error("No readable content found in this Markdown file.");
    if (text.includes("\0")) throw new Error("This Markdown file contains invalid binary data.");
    return text;
  } catch (error) {
    if (error instanceof Error && /No readable|binary data/.test(error.message)) throw error;
    throw new Error("Could not read this Markdown file. Choose a valid UTF-8 .md file and try again.");
  }
}
