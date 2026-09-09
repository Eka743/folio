import XCTest
@testable import FolioHelper

final class SecurityTests: XCTestCase {
    func testSanitizeStripsDirectoriesAndTraversal() {
        XCTAssertEqual(HelperSecurity.sanitizeFilename("/etc/passwd"), "passwd")
        XCTAssertEqual(HelperSecurity.sanitizeFilename("..\\..\\secret.pages"), "secret.pages")
        XCTAssertEqual(HelperSecurity.sanitizeFilename("../../a"), "a")
    }

    func testSanitizeRemovesControlsAndKeepsSafeChars() {
        XCTAssertEqual(HelperSecurity.sanitizeFilename("my report (final) [v2].pages"), "my report (final) [v2].pages")
        XCTAssertEqual(HelperSecurity.sanitizeFilename("a\0b"), "ab")
        XCTAssertEqual(HelperSecurity.sanitizeFilename("..."), "document")
        XCTAssertEqual(HelperSecurity.sanitizeFilename(""), "document")
    }

    func testSanitizeCapsLength() {
        let long = String(repeating: "a", count: 500) + ".pages"
        XCTAssertLessThanOrEqual(HelperSecurity.sanitizeFilename(long).count, 100)
    }

    func testOriginAllowlist() {
        XCTAssertTrue(HelperSecurity.isAllowedOrigin("https://folio.tools"))
        XCTAssertTrue(HelperSecurity.isAllowedOrigin("http://localhost:3000"))
        XCTAssertTrue(HelperSecurity.isAllowedOrigin("http://127.0.0.1:3000"))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin("https://evil.example"))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin(nil))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin(""))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin("https://folio.tools.evil.com"))
    }

    func testTokenComparison() {
        XCTAssertTrue(HelperSecurity.tokensMatch(provided: "abc", expected: "abc"))
        XCTAssertFalse(HelperSecurity.tokensMatch(provided: "abc", expected: "abd"))
        XCTAssertFalse(HelperSecurity.tokensMatch(provided: "ab", expected: "abc"))
        XCTAssertFalse(HelperSecurity.tokensMatch(provided: nil, expected: "abc"))
    }

    func testAllowlist() {
        XCTAssertTrue(HelperSecurity.isAllowedPair(from: "pages", to: "pdf"))
        XCTAssertTrue(HelperSecurity.isAllowedPair(from: "DOCX", to: "PDF"))
        XCTAssertFalse(HelperSecurity.isAllowedPair(from: "pdf", to: "exe"))
        XCTAssertFalse(HelperSecurity.isAllowedPair(from: "pages", to: "exe"))
    }

    func testAppleScriptQuoting() {
        let q = HelperSecurity.appleScriptQuoted(#"a"b\c"#)
        XCTAssertEqual(q, #"a\"b\\c"#)
    }

    func testTempDirLifecycle() throws {
        let dir = try HelperSecurity.makeTempDir()
        XCTAssertTrue(FileManager.default.fileExists(atPath: dir.path))
        HelperSecurity.cleanup(dir)
        XCTAssertFalse(FileManager.default.fileExists(atPath: dir.path))
        HelperSecurity.cleanup(dir) // idempotent, must not throw
    }
}
