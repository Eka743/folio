#!/usr/bin/env node

/**
 * Opt-in inspection harness for the pinned iWork renderer.
 *
 * Run it with a checkout or install containing the pinned package, then pass
 * --package-dir. It remains an evaluation tool: production conversion is
 * deliberately limited to Folio's validated structured Beta subset.
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
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
    const packageJsonPath = require.resolve(`${PACKAGE_NAME}/package.json`);
    return {
      require,
      packageJsonPath,
      packageJson: require(packageJsonPath),
      entry: require.resolve(PACKAGE_NAME),
      parserEntry: require.resolve(`${PACKAGE_NAME}/parser`),
    };
  } catch {
    return null;
  }
}

function walkFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (entry.isFile()) files.push(filePath);
    }
  };
  visit(root);
  return files;
}

function packageInventory(packageRoot) {
  const files = walkFiles(packageRoot).map((filePath) => ({
    path: path.relative(packageRoot, filePath),
    bytes: statSync(filePath).size,
  }));
  files.sort((left, right) => right.bytes - left.bytes);
  return {
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    largestFiles: files.slice(0, 12),
    publishedFiles: files.map((file) => file.path).sort(),
  };
}

function sourceSignals(packageRoot) {
  const patterns = {
    fetch: /\bfetch\s*\(/g,
    xhr: /XMLHttpRequest/g,
    websocket: /WebSocket/g,
    beacon: /sendBeacon/g,
    wasm: /WebAssembly|\.wasm\b/gi,
    worker: /new\s+Worker\s*\(/g,
    objectUrlCreate: /URL\.createObjectURL/g,
    objectUrlRevoke: /URL\.revokeObjectURL/g,
    remoteUrlLiteral: /https?:\/\//gi,
  };
  const signals = Object.fromEntries(Object.keys(patterns).map((name) => [name, 0]));
  for (const filePath of walkFiles(packageRoot)) {
    if (!/\.(?:js|mjs|cjs|ts)$/.test(filePath)) continue;
    const source = readFileSync(filePath, "utf8");
    for (const [name, pattern] of Object.entries(patterns)) {
      signals[name] += source.match(pattern)?.length ?? 0;
    }
  }
  return signals;
}

function dependencyTree(packageDir) {
  try {
    const output = execFileSync("npm", ["ls", "--all", "--json", "--omit=dev"], {
      cwd: packageDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, tree: JSON.parse(output) };
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? "";
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      tree: stdout ? JSON.parse(stdout) : undefined,
    };
  }
}

function asArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

const candidateConsoleLogs = [];
async function silenceCandidateOutput(callback) {
  const originalLog = console.log;
  console.log = (...args) => candidateConsoleLogs.push(args.map(String).join(" "));
  try {
    return await callback();
  } finally {
    console.log = originalLog;
  }
}

function fixtureFiles(fixtureDir) {
  const manifestPath = path.join(fixtureDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const manifestFixtures = Array.isArray(manifest.fixtures)
    ? manifest.fixtures
    : Object.entries(manifest.fixtures ?? {}).map(([fixturePath, metadata]) => ({
      ...metadata,
      path: fixturePath,
      id: path.basename(fixturePath),
      kind: fixturePath.split(path.sep)[0],
    }));
  return {
    manifest,
    files: manifestFixtures.map((fixture) => ({
      ...fixture,
      absolutePath: path.join(fixtureDir, fixture.path),
    })),
  };
}

function modelSummary(document) {
  const scenes = Array.isArray(document?.scenes) ? document.scenes : [];
  const text = scenes.flatMap((scene) => Array.isArray(scene.blocks) ? scene.blocks : [])
    .flatMap((block) => [block.text, block.content])
    .filter((value) => typeof value === "string" && value.length > 0)
    .slice(0, 6);
  const tables = scenes.flatMap((scene) => Array.isArray(scene.tables) ? scene.tables : []);
  const objects = scenes.flatMap((scene) => Array.isArray(scene.objects) ? scene.objects : []);
  const notes = scenes.flatMap((scene) => Array.isArray(scene.notes) ? scene.notes : []);
  return {
    kind: document?.kind,
    generation: document?.generation,
    title: document?.title,
    scenes: scenes.length,
    textBlocks: scenes.reduce((sum, scene) => sum + (Array.isArray(scene.blocks) ? scene.blocks.length : 0), 0),
    sceneDimensions: scenes.map((scene) => ({ id: scene.id, width: scene.width, height: scene.height })),
    tables: tables.length,
    tableRows: tables.map((table) => Array.isArray(table.rows) ? table.rows.length : 0),
    cellText: tables.flatMap((table) => Array.isArray(table.rows) ? table.rows.flat() : [])
      .filter((value) => typeof value === "string" && value.length > 0)
      .slice(0, 12),
    objects: objects.length,
    objectKinds: Object.fromEntries(
      [...new Set(objects.map((object) => object.kind))]
        .map((kind) => [kind, objects.filter((object) => object.kind === kind).length]),
    ),
    notes: notes.length,
    noteText: notes.filter((note) => typeof note === "string").slice(0, 6),
    objectCount: document?.objectCount,
    limitedPreview: Boolean(document?.limitedPreview),
    preview: Boolean(document?.preview),
    text,
    diagnostics: document?.diagnostics,
  };
}

function validateFixtureExpectation(fixture, summary) {
  const expected = fixture.expected ?? {};
  const failures = [];
  const textCorpus = [...summary.text, ...summary.cellText, ...summary.noteText].join("\n");
  const expectedScenes = expected.scenes ?? expected.pages ?? expected.slides ?? expected.sheets;
  const minimumScenes = expected.minimumScenes ?? expected.minimumSlides;
  if (expectedScenes !== undefined && summary.scenes !== expectedScenes) {
    failures.push(`expected ${expectedScenes} scenes, got ${summary.scenes}`);
  }
  if (minimumScenes !== undefined && summary.scenes < minimumScenes) {
    failures.push(`expected at least ${minimumScenes} scenes, got ${summary.scenes}`);
  }
  if (expected.minimumTextBlocks !== undefined && summary.textBlocks < expected.minimumTextBlocks) {
    failures.push(`expected at least ${expected.minimumTextBlocks} text blocks, got ${summary.textBlocks}`);
  }
  if (expected.tables !== undefined && summary.tables !== expected.tables) {
    failures.push(`expected ${expected.tables} tables, got ${summary.tables}`);
  }
  if (expected.minimumTables !== undefined && summary.tables < expected.minimumTables) {
    failures.push(`expected at least ${expected.minimumTables} tables, got ${summary.tables}`);
  }
  if (expected.tableRows !== undefined) {
    const requiredRows = Array.isArray(expected.tableRows) ? expected.tableRows : [expected.tableRows];
    if (!requiredRows.every((rows) => summary.tableRows.includes(rows))) {
      failures.push(`expected table row counts ${requiredRows.join(", ")}, got ${summary.tableRows.join(", ")}`);
    }
  }
  if (expected.shapes !== undefined && (summary.objectKinds.shape ?? 0) !== expected.shapes) {
    failures.push(`expected ${expected.shapes} shapes, got ${summary.objectKinds.shape ?? 0}`);
  }
  if (expected.charts !== undefined && (summary.objectKinds.chart ?? 0) !== expected.charts) {
    failures.push(`expected ${expected.charts} charts, got ${summary.objectKinds.chart ?? 0}`);
  }
  if (expected.images !== undefined && (summary.objectKinds.image ?? 0) !== expected.images) {
    failures.push(`expected ${expected.images} images, got ${summary.objectKinds.image ?? 0}`);
  }
  if (expected.notes !== undefined && summary.notes < expected.notes) {
    failures.push(`expected at least ${expected.notes} notes, got ${summary.notes}`);
  }
  if (expected.text !== undefined && !textCorpus.includes(expected.text)) {
    failures.push(`expected text marker ${JSON.stringify(expected.text)}`);
  }
  if (expected.noteText !== undefined && !summary.noteText.join("\n").includes(expected.noteText)) {
    failures.push(`expected note marker ${JSON.stringify(expected.noteText)}`);
  }
  if (expected.formulaCachedValue !== undefined && !textCorpus.includes(expected.formulaCachedValue)) {
    failures.push(`expected cached value ${JSON.stringify(expected.formulaCachedValue)}`);
  }
  return { pass: failures.length === 0, failures };
}

async function auditFixtures(resolved, fixtureDir) {
  const { parseIworkDocument } = await import(resolved.parserEntry);
  const { manifest, files } = fixtureFiles(fixtureDir);
  const results = [];
  for (const fixture of files) {
    const bytes = readFileSync(fixture.absolutePath);
    const startedAt = performance.now();
    try {
      const document = await parseIworkDocument(asArrayBuffer(bytes), fixture.kind);
      const summary = modelSummary(document);
      const expectation = validateFixtureExpectation(fixture, summary);
      results.push({
        id: fixture.id,
        kind: fixture.kind,
        path: fixture.path,
        bytes: bytes.length,
        parseMs: Number((performance.now() - startedAt).toFixed(2)),
        ok: true,
        structuralPass: expectation.pass,
        structuralFailures: expectation.failures,
        summary,
      });
    } catch (error) {
      results.push({
        id: fixture.id,
        kind: fixture.kind,
        path: fixture.path,
        bytes: bytes.length,
        parseMs: Number((performance.now() - startedAt).toFixed(2)),
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    manifest: {
      generated: manifest.generated,
      license: manifest.license,
      warning: manifest.warning,
      fixtureCount: files.length,
    },
    passed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    structuralPassed: results.filter((result) => result.ok && result.structuralPass).length,
    structuralFailed: results.filter((result) => result.ok && !result.structuralPass).length,
    results,
  };
}

async function createZip(JSZip, entries) {
  const zip = new JSZip();
  for (const [filePath, content] of Object.entries(entries)) zip.file(filePath, content);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function adversarialAudit(resolved) {
  const { inspectIworkContainer, parseIworkDocument } = await import(resolved.parserEntry);
  const JSZip = resolved.require("jszip");
  const malformedIwa = await createZip(JSZip, {
    "Index/Document.iwa": Buffer.from([0]),
    "Index/Metadata.iwa": Buffer.from([0]),
  });
  const encryptedPackage = await createZip(JSZip, {
    EncryptedPackage: Buffer.from("encrypted marker"),
  });
  const ooxmlContainer = await createZip(JSZip, {
    "[Content_Types].xml": "<Types/>",
    "xl/workbook.xml": "<workbook/>",
  });
  const oversized = await createZip(JSZip, {
    "Index/Document.iwa": "x".repeat(1024),
  });
  const cases = [
    { name: "truncated-zip", bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]), expectedReject: true },
    { name: "random-bytes", bytes: Buffer.from("not an iWork container"), expectedReject: true },
    { name: "malformed-iwa", bytes: malformedIwa, expectedReject: true },
    { name: "encrypted-package-marker", bytes: encryptedPackage, expectedReject: true },
    { name: "ooxml-container-mismatch", bytes: ooxmlContainer, expectedReject: true },
    {
      name: "uncompressed-limit",
      bytes: oversized,
      limits: { maxUncompressedBytes: 32 },
      expectedReject: true,
    },
  ];
  const results = [];
  for (const testCase of cases) {
    let rejected = false;
    let errorMessage;
    try {
      await inspectIworkContainer(asArrayBuffer(testCase.bytes), testCase.limits);
      await parseIworkDocument(asArrayBuffer(testCase.bytes), "pages", testCase.limits);
    } catch (error) {
      rejected = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    results.push({
      name: testCase.name,
      bytes: testCase.bytes.length,
      expectedReject: testCase.expectedReject,
      rejected,
      pass: rejected === testCase.expectedReject,
      error: errorMessage,
    });
  }
  return {
    passed: results.filter((result) => result.pass).length,
    failed: results.filter((result) => !result.pass).length,
    results,
  };
}

const packageDir = path.resolve(argumentValue("--package-dir") ?? process.cwd());
const fixtureDirArgument = argumentValue("--fixture-dir");
const resolved = resolvePackage(packageDir);
const report = {
  candidate: PACKAGE_NAME,
  expected: EXPECTED,
  packageDir,
  fixtureDir: fixtureDirArgument ? path.resolve(fixtureDirArgument) : undefined,
  installed: Boolean(resolved),
  verdict: "SCOPED BETA — PUBLIC EXPORTS FAIL CLOSED",
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
  const packageRoot = path.dirname(resolved.packageJsonPath);
  report.installedVersion = resolved.packageJson.version;
  report.installedLicense = resolved.packageJson.license;
  report.repository = resolved.packageJson.repository;
  report.entry = resolved.entry;
  report.package = {
    name: resolved.packageJson.name,
    version: resolved.packageJson.version,
    license: resolved.packageJson.license,
    repository: resolved.packageJson.repository,
    description: resolved.packageJson.description,
    directDependencies: resolved.packageJson.dependencies,
    inventory: packageInventory(packageRoot),
    sourceSignals: sourceSignals(packageRoot),
  };
  report.dependencyTree = dependencyTree(packageDir);
  if (process.argv.includes("--load")) {
    try {
      await silenceCandidateOutput(() => import(resolved.entry));
      report.loaded = true;
    } catch (error) {
      report.loaded = false;
      report.loadError = error instanceof Error ? error.message : String(error);
    }
  }
  if (fixtureDirArgument) {
    try {
      report.fixtureAudit = await silenceCandidateOutput(() => auditFixtures(resolved, path.resolve(fixtureDirArgument)));
      report.adversarialAudit = await silenceCandidateOutput(() => adversarialAudit(resolved));
    } catch (error) {
      report.fixtureAuditError = error instanceof Error ? error.message : String(error);
    }
  }
  report.candidateConsoleLogs = candidateConsoleLogs;
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
  if (report.fixtureAudit) {
    console.log(`Fixtures: ${report.fixtureAudit.passed}/${report.fixtureAudit.manifest.fixtureCount} parsed`);
    console.log(`Structural assertions: ${report.fixtureAudit.structuralPassed}/${report.fixtureAudit.passed} passed`);
    console.log(`Adversarial cases: ${report.adversarialAudit.passed}/${report.adversarialAudit.passed + report.adversarialAudit.failed} passed`);
  }
  console.log("Public Apple conversion is limited to Folio's validated structured Beta subset.");
}
