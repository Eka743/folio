import { describe, expect, it } from "vitest";
import { parsePageRanges, summarizePages } from "./pageRanges";

describe("parsePageRanges", () => {
  it("parses a single page", () => {
    expect(parsePageRanges("5", 10)).toEqual({ pages: [5] });
  });

  it("parses the canonical example", () => {
    expect(parsePageRanges("1-3,5,8-10", 10)).toEqual({
      pages: [1, 2, 3, 5, 8, 9, 10],
    });
  });

  it("ignores whitespace and deduplicates, sorting output", () => {
    expect(parsePageRanges(" 5 , 3-4, 3 ,1-2 ", 6)).toEqual({
      pages: [1, 2, 3, 4, 5],
    });
  });

  it("supports open-ended ranges", () => {
    expect(parsePageRanges("8-", 10)).toEqual({ pages: [8, 9, 10] });
  });

  it("rejects empty input", () => {
    const r = parsePageRanges("   ", 10);
    expect(r.error).toMatch(/at least one page/);
  });

  it("rejects reversed ranges with guidance", () => {
    const r = parsePageRanges("5-2", 10);
    expect(r.error).toMatch(/reversed/);
  });

  it("rejects out-of-range pages", () => {
    expect(parsePageRanges("11", 10).error).toMatch(/outside/);
    expect(parsePageRanges("1-11", 10).error).toMatch(/outside/);
  });

  it("rejects zero and garbage", () => {
    expect(parsePageRanges("0", 10).error).toMatch(/start at 1/);
    expect(parsePageRanges("abc", 10).error).toMatch(/not a valid page/);
    expect(parsePageRanges("1--2", 10).error).toMatch(/not a valid page/);
  });
});

describe("summarizePages", () => {
  it("summarizes runs", () => {
    expect(summarizePages([1, 2, 3, 5])).toBe("4 pages (1–3, 5)");
    expect(summarizePages([4])).toBe("1 page (4)");
    expect(summarizePages([])).toBe("no pages");
  });
});
