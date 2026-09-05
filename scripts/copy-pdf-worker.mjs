/**
 * Copy the pdf.js worker into `public/` so PDF → JPG is served same-origin.
 *
 * The worker file ( ~1.4 MB) is generated from the installed `pdfjs-dist`
 * package and must NOT be committed — see .gitignore.
 * Runs on `postinstall` and before `next build`.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const dest = join(root, "public", "pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.error(`[folio] pdf.js worker not found at ${src} — did npm ci fail?`);
  process.exit(1);
}
mkdirSync(join(root, "public"), { recursive: true });
copyFileSync(src, dest);
console.log("[folio] pdf.js worker copied to public/pdf.worker.min.mjs");
