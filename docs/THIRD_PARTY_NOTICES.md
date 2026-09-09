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
| Tailwind CSS | Stylesheet generation | MIT |

The complete dependency graph and its license metadata are recorded in
`package-lock.json`. The macOS helper and Folio for Mac packages use Apple
platform frameworks and the source files in this repository; they do not add a
third-party runtime package manager dependency.

This notice is an operational release aid, not a substitute for reviewing the
license files included by a particular redistribution.
