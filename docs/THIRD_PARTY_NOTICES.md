# Third-party notices

Folio does not send document contents to these projects or their maintainers.
The web application bundles or uses the following direct dependencies under the
licenses shown by the locked package metadata. Redistributed builds must retain
the applicable upstream notices and license terms.

| Dependency | Use | License |
| --- | --- | --- |
| Next.js | Web framework | MIT |
| React / React DOM | UI runtime | MIT |
| pdf-lib | PDF transforms | MIT |
| pdfjs-dist | PDF rendering | Apache-2.0 |
| mammoth | DOCX-to-HTML parsing | BSD-2-Clause |
| jsPDF | Browser PDF generation | MIT |
| html2canvas | Browser rendering support | MIT |
| JSZip | ZIP output | MIT or GPL-3.0-or-later, at the recipient's option |
| @file-viewer/renderer-iwork | Apple Pages/Keynote/Numbers parser for scoped local Beta exports | Apache-2.0 |
| styled-exceljs | Numbers saved-value XLSX output (loaded with the Apple renderer) | Apache-2.0 |
| keynote-archives | Typed Keynote/iWork archive definitions (loaded with the Apple renderer) | MIT |
| Tailwind CSS | Stylesheet generation | MIT |

PPTX/XLSX parsing and the Keynote → PPTX / Pages → DOCX writers use Folio’s
bounded local OOXML reader and writer over the existing JSZip dependency. The
candidate `pptxgenjs` package was evaluated but not adopted because its
transitive `image-size` dependency has a high-severity image parsing advisory
in the candidate install; it is not part of the Folio lockfile.

The complete dependency graph and its license metadata are recorded in
`package-lock.json`. The macOS helper and Folio for Mac packages use Apple
platform frameworks and the source files in this repository; they do not add a
third-party runtime package manager dependency.

This notice is an operational release aid, not a substitute for reviewing the
license files included by a particular redistribution.
