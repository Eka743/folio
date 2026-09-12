import { describe, expect, it } from "vitest";
import { ArchiveInspectionError } from "./safeArchive";
import { FileReadError } from "./files";
import { describeError } from "./errors";

describe("user-facing error boundary", () => {
  it("maps the WebKit read failure without losing its cause", () => {
    const cause = new FileReadError("internal read failure", new DOMException("The I/O read operation failed.", "NotReadableError"));
    const result = describeError(cause);

    expect(result.code).toBe("file-read");
    expect(result.message).toBe("We couldn’t read this file. Remove it and select it again.");
    expect(result.cause).toBe(cause);
    expect(result.debugMessage).toBe("internal read failure");
  });

  it("maps archive safety failures instead of rendering ZIP internals", () => {
    const result = describeError(
      new ArchiveInspectionError("ARCHIVE_UNSAFE_PATH", "Traversal ZIP entry path: ../secret"),
    );

    expect(result.code).toBe("unsafe-container");
    expect(result.message).not.toContain("../secret");
    expect(result.debugMessage).toContain("../secret");
  });

  it("keeps known actionable input messages", () => {
    expect(describeError(new Error("No valid pages selected.")).message).toBe("No valid pages selected.");
    expect(describeError(new Error("Canvas unavailable in this browser.")).code).toBe("browser-capability");
    expect(describeError(new Error("This PDF appears to contain scanned pages or images. Text extraction is not available for this file yet.")).code).toBe("input");
    expect(describeError(new Error("Could not read this Markdown file. Choose a valid UTF-8 .md file and try again.")).code).toBe("invalid-markdown");
  });

  it("does not expose arbitrary runtime exception text", () => {
    const result = describeError(new Error("TypeError: detached ArrayBuffer at native code"));
    expect(result.code).toBe("unknown");
    expect(result.message).toBe("Something went wrong. Check the file and try again.");
    expect(result.debugMessage).toContain("detached ArrayBuffer");
  });
});
