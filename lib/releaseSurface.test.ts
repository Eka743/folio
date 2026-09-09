import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function sourceFiles(dir: string): string[] {
  const absolute = resolve(root, dir);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(absolute, entry.name);
    if (entry.isDirectory()) return sourceFiles(resolve(dir, entry.name));
    return /\.(ts|tsx|js|mjs)$/.test(entry.name) ? [path] : [];
  });
}

describe("public release surface", () => {
  it("keeps required legal routes and license metadata present", () => {
    for (const route of [
      "app/privacy/page.tsx",
      "app/cookies/page.tsx",
      "app/terms/page.tsx",
      "app/legal/page.tsx",
      "app/security/page.tsx",
      "app/open-source/page.tsx",
      "app/mac/page.tsx",
      "LICENSE",
      "SECURITY.md",
    ]) {
      expect(existsSync(resolve(root, route)), route).toBe(true);
    }
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(packageJson.license).toBe("AGPL-3.0-or-later");
  });

  it("contains no common analytics or advertising runtime dependency", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const dependencies = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
    const packageLock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
    const lockedPackages = Object.keys(packageLock.packages ?? {}).map((name) =>
      name.replace(/^node_modules\//, ""),
    );
    const blockedPackages = /^(?:@vercel\/analytics|analytics|segment|posthog|mixpanel|hotjar|clarity)$/i;
    expect([...dependencies, ...lockedPackages].some((name) => blockedPackages.test(name))).toBe(false);

    const runtime = [...sourceFiles("app"), ...sourceFiles("components"), ...sourceFiles("lib")]
      .filter((file) => !file.endsWith(".test.ts"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(runtime).not.toContain("TODO:");
    expect(runtime).not.toMatch(/@vercel\/analytics|googletagmanager|google-analytics|posthog|mixpanel|hotjar|clarity/i);
  });

  it("has no server document API surface", () => {
    expect(existsSync(resolve(root, "app/api"))).toBe(false);
    const helperClient = readFileSync(resolve(root, "lib/helper.ts"), "utf8");
    expect(helperClient).toContain("127.0.0.1");
    expect(helperClient).not.toMatch(/fetch\(\s*[`"']https?:\/\//);

    const browserOperations = readFileSync(resolve(root, "lib/pdfOps.ts"), "utf8");
    expect(browserOperations).not.toMatch(/fetch|XMLHttpRequest|WebSocket|sendBeacon/);
  });

  it("keeps public discovery files tied to the canonical URL helper", () => {
    const sitemap = readFileSync(resolve(root, "app/sitemap.ts"), "utf8");
    const robots = readFileSync(resolve(root, "app/robots.ts"), "utf8");
    expect(sitemap).toContain('import { siteUrl } from "@/lib/site"');
    expect(sitemap).toContain('"cookies"');
    expect(robots).toContain('import { siteUrl } from "@/lib/site"');
  });
});
