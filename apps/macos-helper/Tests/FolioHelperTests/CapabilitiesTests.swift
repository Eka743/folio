import XCTest
@testable import FolioHelper

final class CapabilitiesTests: XCTestCase {
    func testDetectWithMockProber() {
        let prober = MockAppProber(
            installed: ["com.apple.iWork.Pages", "com.microsoft.Word"],
            executables: ["soffice"]
        )
        let caps = detectCapabilities(prober: prober)
        XCTAssertTrue(caps.pages)
        XCTAssertFalse(caps.keynote)
        XCTAssertTrue(caps.word)
        XCTAssertTrue(caps.libreoffice)
    }

    func testDetectNoneByDefault() {
        let caps = detectCapabilities(prober: MockAppProber())
        XCTAssertFalse(caps.pages)
        XCTAssertFalse(caps.word)
        XCTAssertFalse(caps.libreoffice)
    }

    func testCapabilitiesEncodeOnlyKnownKeys() throws {
        let caps = HelperCapabilities(pages: true)
        let data = try JSONEncoder().encode(caps)
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertNotNil(obj?["pages"])
        XCTAssertNil(obj?["serialNumber"])
        XCTAssertNil(obj?["hostname"])
    }
}
