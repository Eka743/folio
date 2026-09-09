/**
 * Page-range parsing for the Split and Rotate tools.
 *
 * Supported syntax (1-based, inclusive):
 *   "1-3,5,8-10"  -> pages 1,2,3,5,8,9,10
 *   "4"           -> page 4
 *   "2-"          -> pages 2..pageCount (open-ended)
 *
 * Rules: whitespace is ignored; ranges may not be reversed (5-2 is an
 * error, not silently swapped); duplicates are collapsed; output is
 * sorted ascending. Everything is validated against `pageCount`.
 */

export interface ParsedRange {
  pages: number[]; // 1-based page numbers, sorted, unique
}

export function parsePageRanges(
  input: string,
  pageCount: number,
): { pages: number[]; error?: undefined } | { pages: []; error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { pages: [], error: "Enter at least one page or range, e.g. 1-3,5." };
  }
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return { pages: [], error: "This PDF has no readable pages." };
  }

  const parts = trimmed.split(",").map((p) => p.trim());

  if (parts.some((p) => p.length === 0)) {
    return {
      pages: [],
      error: "Empty page or range found. Use numbers like 1-3,5,8-10.",
    };
  }

  const collected = new Set<number>();

  for (const part of parts) {
    if (!/^[0-9]+(\s*-\s*[0-9]*)?$/.test(part)) {
      return {
        pages: [],
        error: `"${part}" is not a valid page or range. Use numbers like 1-3,5,8-10.`,
      };
    }

    if (part.includes("-")) {
      const [startRaw, endRaw] = part.split("-").map((s) => s.trim());
      const start = Number(startRaw);
      const end = endRaw === "" ? pageCount : Number(endRaw);

      if (!Number.isInteger(start) || start < 1) {
        return { pages: [], error: `Page numbers must start at 1 (got "${part}").` };
      }
      if (!Number.isInteger(end) || end < 1) {
        return { pages: [], error: `"${part}" is not a valid range.` };
      }
      if (end < start) {
        return {
          pages: [],
          error: `"${part}" is reversed — write the smaller page first, e.g. ${end}-${start}.`,
        };
      }
      if (start > pageCount || end > pageCount) {
        return {
          pages: [],
          error: `"${part}" is outside this PDF (it has ${pageCount} page${pageCount === 1 ? "" : "s"}).`,
        };
      }
      for (let p = start; p <= end; p++) collected.add(p);
    } else {
      const n = Number(part);
      if (!Number.isInteger(n) || n < 1) {
        return { pages: [], error: `Page numbers must start at 1 (got "${part}").` };
      }
      if (n > pageCount) {
        return {
          pages: [],
          error: `Page ${n} is outside this PDF (it has ${pageCount} page${pageCount === 1 ? "" : "s"}).`,
        };
      }
      collected.add(n);
    }
  }

  return { pages: [...collected].sort((a, b) => a - b) };
}

/** Human summary, e.g. [1,2,3,5] -> "4 pages (1–3, 5)". */
export function summarizePages(pages: number[]): string {
  if (pages.length === 0) return "no pages";
  const sorted = [...pages].sort((a, b) => a - b);
  const runs: Array<[number, number]> = [];
  let s = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      runs.push([s, prev]);
      s = sorted[i];
      prev = sorted[i];
    }
  }
  runs.push([s, prev]);
  const label = runs
    .map(([a, b]) => (a === b ? String(a) : `${a}–${b}`))
    .join(", ");
  return `${sorted.length} page${sorted.length === 1 ? "" : "s"} (${label})`;
}
