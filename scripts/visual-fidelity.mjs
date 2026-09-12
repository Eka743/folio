import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";

function usage() {
  console.error("Usage: node scripts/visual-fidelity.mjs --case name actual.pdf reference.pdf [--output report.json] [--strict]");
  process.exitCode = 2;
}

function command(name) {
  const configured = name === "pdftoppm" ? process.env.FOLIO_PDFTOPPM : process.env.FOLIO_PDFINFO;
  return configured || name;
}

function pdfInfo(path) {
  const output = execFileSync(command("pdfinfo"), [path], { encoding: "utf8" });
  const pages = Number(/^Pages:\s+(\d+)/m.exec(output)?.[1] ?? 0);
  const sizes = [...output.matchAll(/^Page size:\s+([\d.]+) x ([\d.]+) pts/mg)].map((match) => [Number(match[1]), Number(match[2])]);
  return { pages, sizes };
}

async function renderPages(path, root) {
  mkdirSync(root, { recursive: true });
  execFileSync(command("pdftoppm"), ["-png", "-r", "96", path, join(root, "page")], { stdio: "ignore" });
  return readdirSync(root)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort((left, right) => Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0]));
}

async function imageDifference(actualPath, referencePath, normalizeReference) {
  const actual = await sharp(actualPath).raw().toBuffer({ resolveWithObject: true });
  const reference = await (normalizeReference
    ? sharp(referencePath).resize(actual.info.width, actual.info.height, { fit: "fill" })
    : sharp(referencePath)
  ).raw().toBuffer({ resolveWithObject: true });
  if (actual.info.width !== reference.info.width || actual.info.height !== reference.info.height || actual.info.channels !== reference.info.channels) {
    return { geometryMatch: false, meanAbsoluteError: 1, changedRatio: 1 };
  }
  let total = 0;
  let changed = 0;
  const channels = Math.min(3, actual.info.channels);
  const pixels = actual.info.width * actual.info.height;
  for (let offset = 0; offset < actual.data.length; offset += actual.info.channels) {
    let pixelChanged = false;
    for (let channel = 0; channel < channels; channel++) {
      const difference = Math.abs(actual.data[offset + channel] - reference.data[offset + channel]);
      total += difference / 255;
      if (difference > 24) pixelChanged = true;
    }
    if (pixelChanged) changed++;
  }
  return {
    geometryMatch: true,
    meanAbsoluteError: total / (pixels * channels),
    changedRatio: changed / pixels,
  };
}

async function compareCase(name, actualPath, referencePath) {
  if (!existsSync(actualPath) || !existsSync(referencePath)) throw new Error(`${name}: both PDF paths must exist`);
  const actualInfo = pdfInfo(actualPath);
  const referenceInfo = pdfInfo(referencePath);
  const tempRoot = mkdtempSync(join(tmpdir(), `folio-visual-${name}-`));
  try {
    const actualPages = await renderPages(actualPath, join(tempRoot, "actual"));
    const referencePages = await renderPages(referencePath, join(tempRoot, "reference"));
    const pageSizeMatch = actualInfo.sizes.length === referenceInfo.sizes.length && actualInfo.sizes.every((size, index) =>
      Math.abs(size[0] - (referenceInfo.sizes[index]?.[0] ?? Number.POSITIVE_INFINITY)) <= 1.5 &&
      Math.abs(size[1] - (referenceInfo.sizes[index]?.[1] ?? Number.POSITIVE_INFINITY)) <= 1.5,
    );
    const pageDiffs = [];
    for (let index = 0; index < Math.min(actualPages.length, referencePages.length); index++) {
      pageDiffs.push(await imageDifference(
        join(tempRoot, "actual", actualPages[index]),
        join(tempRoot, "reference", referencePages[index]),
        pageSizeMatch,
      ));
    }
    return {
      name,
      actual: resolve(actualPath),
      reference: resolve(referencePath),
      actualPages: actualInfo.pages,
      referencePages: referenceInfo.pages,
      pageCountMatch: actualInfo.pages === referenceInfo.pages,
      actualPageSizes: actualInfo.sizes,
      referencePageSizes: referenceInfo.sizes,
      pageSizeMatch,
      rasterPageCountMatch: actualPages.length === referencePages.length,
      pageDiffs,
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
const cases = [];
let outputPath;
let strict = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === "--case") {
    const [name, actual, reference] = args.slice(index + 1, index + 4);
    if (!name || !actual || !reference) {
      usage();
      process.exit(2);
    }
    cases.push({ name, actual, reference });
    index += 3;
  } else if (args[index] === "--output") {
    outputPath = args[index + 1];
    index++;
  } else if (args[index] === "--strict") {
    strict = true;
  } else {
    usage();
    process.exit(2);
  }
}
if (cases.length === 0) {
  usage();
  process.exit(2);
}

const results = [];
for (const item of cases) results.push(await compareCase(item.name, item.actual, item.reference));
const report = { generatedAt: new Date().toISOString(), results };
const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) {
  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(outputPath, serialized);
}
console.log(serialized);
if (strict && results.some((result) => !result.pageCountMatch || !result.pageSizeMatch || !result.rasterPageCountMatch)) process.exitCode = 1;
