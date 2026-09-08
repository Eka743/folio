import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const failures = [];

function required(name, predicate = (value) => Boolean(value?.trim())) {
  const value = process.env[name]?.trim();
  if (!predicate(value)) failures.push(name);
  return value;
}

function httpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function contact(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || httpsUrl(value);
}

required("NEXT_PUBLIC_OWNER_NAME");
required("NEXT_PUBLIC_OWNER_CONTACT", contact);
required("NEXT_PUBLIC_SITE_URL", httpsUrl);
required("NEXT_PUBLIC_MAC_DOWNLOAD_URL", httpsUrl);
required("NEXT_PUBLIC_SOURCE_REPOSITORY_URL", httpsUrl);
required("NEXT_PUBLIC_LEGAL_UPDATED_AT", (value) => /^\d{4}-\d{2}-\d{2}$/.test(value));

if (!/^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_SOURCE_REPOSITORY_PUBLIC?.trim() ?? "")) {
  failures.push("NEXT_PUBLIC_SOURCE_REPOSITORY_PUBLIC=true");
}

const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
if (packageJson.license !== "AGPL-3.0-or-later") failures.push("package.json license");
if (!existsSync(resolve(root, "LICENSE"))) failures.push("LICENSE");

for (const route of [
  "app/privacy/page.tsx",
  "app/cookies/page.tsx",
  "app/terms/page.tsx",
  "app/legal/page.tsx",
  "app/security/page.tsx",
  "app/open-source/page.tsx",
  "app/mac/page.tsx",
]) {
  if (!existsSync(resolve(root, route))) failures.push(route);
}

if (failures.length > 0) {
  console.error("release:check failed. Missing or invalid release configuration:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("No secret values were printed. Supply verified public release values and rerun.");
  process.exitCode = 1;
} else {
  console.log("release:check passed: public legal, domain, source, download, license, and route configuration is present.");
}
