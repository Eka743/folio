import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const webFailures = [];
const macFailures = [];

const defaults = {
  NEXT_PUBLIC_OWNER_NAME: "Independent developer in Spain",
  NEXT_PUBLIC_OWNER_CONTACT: "ekaitzrockandroll@gmail.com",
  NEXT_PUBLIC_SITE_URL: "https://foliotools.vercel.app",
  NEXT_PUBLIC_SOURCE_REPOSITORY_URL: "https://github.com/Eka743/folio",
  NEXT_PUBLIC_LEGAL_UPDATED_AT: "2026-09-08",
  NEXT_PUBLIC_SOURCE_REPOSITORY_PUBLIC: "true",
};

function valueOf(name) {
  return process.env[name]?.trim() || defaults[name] || "";
}

function required(target, name, predicate = (value) => Boolean(value?.trim())) {
  const value = valueOf(name);
  if (!predicate(value)) target.push(name);
  return value;
}

function configured(value) {
  return Boolean(value?.trim()) && !/^(todo|placeholder|replace(?:[-_ ]?me)?)\b/i.test(value.trim());
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

required(webFailures, "NEXT_PUBLIC_OWNER_NAME", configured);
required(webFailures, "NEXT_PUBLIC_OWNER_CONTACT", (value) => configured(value) && contact(value));
required(webFailures, "NEXT_PUBLIC_SITE_URL", httpsUrl);
required(webFailures, "NEXT_PUBLIC_SOURCE_REPOSITORY_URL", httpsUrl);
required(webFailures, "NEXT_PUBLIC_LEGAL_UPDATED_AT", (value) => /^\d{4}-\d{2}-\d{2}$/.test(value));

if (!/^(1|true|yes)$/i.test(valueOf("NEXT_PUBLIC_SOURCE_REPOSITORY_PUBLIC"))) {
  webFailures.push("NEXT_PUBLIC_SOURCE_REPOSITORY_PUBLIC=true (after the GitHub repository is public)");
}

if (!httpsUrl(process.env.NEXT_PUBLIC_MAC_DOWNLOAD_URL?.trim())) {
  macFailures.push("NEXT_PUBLIC_MAC_DOWNLOAD_URL (signed, notarized DMG URL)");
}
if (!/^(1|true|yes)$/i.test(process.env.FOLIO_MAC_RELEASE_VERIFIED?.trim() ?? "")) {
  macFailures.push("FOLIO_MAC_RELEASE_VERIFIED=true (after clean-machine Gatekeeper validation)");
}

const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
if (packageJson.license !== "AGPL-3.0-or-later") webFailures.push("package.json license");
if (!existsSync(resolve(root, "LICENSE"))) webFailures.push("LICENSE");

for (const route of [
  "app/privacy/page.tsx",
  "app/cookies/page.tsx",
  "app/terms/page.tsx",
  "app/legal/page.tsx",
  "app/security/page.tsx",
  "app/open-source/page.tsx",
  "app/mac/page.tsx",
]) {
  if (!existsSync(resolve(root, route))) webFailures.push(route);
}

console.log(`WEB BETA READY: ${webFailures.length === 0 ? "PASS" : "BLOCKED"}`);
if (webFailures.length > 0) {
  for (const failure of webFailures) console.log(`- ${failure}`);
}
console.log(`MAC PUBLIC DISTRIBUTION READY: ${macFailures.length === 0 ? "PASS" : "BLOCKED"}`);
if (macFailures.length > 0) {
  for (const failure of macFailures) console.log(`- ${failure}`);
}

if (webFailures.length > 0) {
  console.error("Web beta release check is blocked. No secret values were printed.");
  process.exitCode = 1;
} else {
  console.log("Web beta release configuration is complete. Mac distribution remains independently gated.");
}
