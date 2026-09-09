import XCTest
@testable import FolioHelper

final class ConversionsTests: XCTestCase {
    func testAllowlistMatchesWebMatrix() {
        // Must stay in sync with web lib/formatMatrix.ts HELPER_ALLOWLIST.
        let expected: Set<String> = [
            "pages>pdf", "pages>docx",
            "key>pdf", "key>pptx",
            "numbers>pdf", "numbers>xlsx",
            "doc>pdf", "docx>pdf",
            "ppt>pdf", "pptx>pdf",
            "xls>pdf", "xlsx>pdf",
        ]
        XCTAssertEqual(HelperConfig.allowlist, expected)
    }

    func testValidateAcceptsKnownPair() throws {
        let p = ConvertPayload(from: "pages", to: "pdf", filename: "deck.pages", contentBase64: "aGVsbG8=")
        let v = try validateConvertPayload(p)
        XCTAssertEqual(v.from, "pages")
        XCTAssertEqual(v.to, "pdf")
        XCTAssertEqual(v.filename, "deck.pages")
    }

    func testValidateRejectsArbitraryFormats() {
        let p = ConvertPayload(from: "pdf", to: "exe", filename: "a.pdf", contentBase64: "eA==")
        XCTAssertThrowsError(try validateConvertPayload(p)) { e in
            XCTAssertEqual((e as? ConversionError)?.code, "bad_request")
        }
    }

    func testValidateRejectsExtensionMismatch() {
        let p = ConvertPayload(from: "pages", to: "pdf", filename: "evil.docx", contentBase64: "eA==")
        XCTAssertThrowsError(try validateConvertPayload(p)) { e in
            XCTAssertEqual((e as? ConversionError)?.code, "bad_request")
        }
    }

    func testValidateRejectsMissingContent() {
        let p = ConvertPayload(from: "docx", to: "pdf", filename: "a.docx", contentBase64: nil)
        XCTAssertThrowsError(try validateConvertPayload(p))
    }

    func testPermissionHintNamesTheFolioAutomationSender() {
        let hint = ConversionError.permissionDenied(appName: "Keynote").hint
        XCTAssertTrue(hint.contains("expand Folio"))
        XCTAssertTrue(hint.contains("turn on Keynote"))
        XCTAssertFalse(hint.contains("Folio Helper"))
    }

    func testOutputFilename() {
        XCTAssertEqual(outputFilename(for: "a.pages", to: "pdf"), "a.pdf")
        XCTAssertEqual(outputFilename(for: "a", to: "pdf"), "a.pdf")
    }

    func testAppleScriptBuildersQuotePaths() {
        let s = AppleScripts.pagesExport(inputPath: #"a"b"#, outputPath: "/tmp/o.pdf", format: "pdf")
        XCTAssertTrue(s.contains("Pages"))
        XCTAssertTrue(s.contains(#"a\"b"#))
        XCTAssertTrue(s.contains("PDF"))
        XCTAssertTrue(s.contains("with timeout of 120 seconds"))
        XCTAssertTrue(s.contains("delay 1"))
        XCTAssertTrue(s.contains("on error errorMessage number errorNumber"))
        let w = AppleScripts.pagesExport(inputPath: "/tmp/a.pages", outputPath: "/tmp/o.docx", format: "docx")
        XCTAssertTrue(w.contains("Microsoft Word"))
    }

    func testSelectEngineNativeVsFallback() {
        let none = HelperCapabilities()
        XCTAssertEqual(selectEngine(from: "pages", caps: none), .unavailable(appName: "Pages"))
        // iWork never falls back to LibreOffice.
        let loOnly = HelperCapabilities(libreoffice: true)
        XCTAssertEqual(selectEngine(from: "key", caps: loOnly), .unavailable(appName: "Keynote"))
        // Office falls back honestly.
        XCTAssertEqual(selectEngine(from: "docx", caps: loOnly), .libreOffice)
        let word = HelperCapabilities(word: true)
        XCTAssertEqual(selectEngine(from: "docx", caps: word), .native("Microsoft Word"))
    }

    func testOrchestratorUsesMockAndReportsEngine() throws {
        var seen: [(String, String)] = []
        let caps = HelperCapabilities(pages: true)
        let orch = ConversionOrchestrator(capabilities: caps, runScript: { app, script in
            seen.append((app, script))
        })
        let engine = try orch.convert(input: URL(fileURLWithPath: "/tmp/a.pages"),
                                      outputURL: URL(fileURLWithPath: "/tmp/a.pdf"),
                                      from: "pages", to: "pdf")
        XCTAssertEqual(engine, "Pages")
        XCTAssertEqual(seen.count, 1)
    }

    func testOrchestratorThrowsWhenAppMissing() {
        let orch = ConversionOrchestrator(capabilities: HelperCapabilities(),
                                          runScript: { _, _ in })
        XCTAssertThrowsError(try orch.convert(input: URL(fileURLWithPath: "/tmp/a.pages"),
                                              outputURL: URL(fileURLWithPath: "/tmp/a.pdf"),
                                              from: "pages", to: "pdf")) { e in
            XCTAssertEqual((e as? ConversionError)?.code, "app_missing")
        }
    }
}
