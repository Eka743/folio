#!/usr/bin/env node

/**
 * Disposable, opt-in inspection harness for the iWork renderer candidate.
 *
 * This script intentionally has no production import path and does not add a
 * renderer to Folio's dependencies. Run it from a separate evaluation folder
 * with the candidate installed there, then pass --package-dir.
 */

import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const PACKAGE_NAME = "@file-viewer/renderer-iwork";
const EXPECTED = {
  version: "3.0.3",
  license: "Apache-2.0",
  repository: "https://github.com/flyfish-dev/file-viewer",
  packagePath: "packages/renderers/iwork",
};

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolvePackage(packageDir) {
  const require = createRequire(path.join(packageDir, "package.json"));
  try {
    return {
      require,
      packageJson: require(`${PACKAGE_NAME}/package.json`),
      entry: require.resolve(PACKAGE_NAME),
    };
  } catch {
    return null;
  }
}

const packageDir = path.resolve(argumentValue("--package-dir") ?? process.cwd());
const resolved = resolvePackage(packageDir);
const report = {
  candidate: PACKAGE_NAME,
  expected: EXPECTED,
  packageDir,
  installed: Boolean(resolved),
  verdict: "EXPERIMENTAL — NOT FOR PRODUCTION",
  gates: {
    bundleIsolation: "required",
    networkFreeRuntime: "required",
    licenseReview: "required",
    pagesFidelity: "unproven",
    keynoteFidelity: "unproven",
    numbersFidelity: "not ready",
  },
};

if (resolved) {
  report.installedVersion = resolved.packageJson.version;
  report.installedLicense = resolved.packageJson.license;
  report.entry = resolved.entry;
  if (process.argv.includes("--load")) {
    try {
      await import(resolved.entry);
      report.loaded = true;
    } catch (error) {
      report.loaded = false;
      report.loadError = error instanceof Error ? error.message : String(error);
    }
  }
} else {
  report.note = "Candidate is not installed in this Folio checkout; no production dependency was added.";
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Folio iWork renderer evaluation: ${report.verdict}`);
  console.log(`Candidate: ${PACKAGE_NAME} (expected ${EXPECTED.version}, ${EXPECTED.license})`);
  console.log(`Installed in ${packageDir}: ${report.installed ? "yes" : "no"}`);
  if (report.loaded === false) console.log(`Load failed: ${report.loadError}`);
  console.log("Public Pages/Keynote/Numbers conversion remains disabled.");
}
