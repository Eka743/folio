import XCTest
@testable import FolioHelper

private func req(_ method: String, _ path: String, headers: [String: String] = [:], body: Data = Data()) -> HttpRequest {
    // Browsers always send Host; default to loopback so routing tests
    // exercise endpoints rather than the DNS-rebinding guard.
    var h = headers
    if h["host"] == nil { h["host"] = "127.0.0.1:17391" }
    if h["origin"] == nil { h["origin"] = "https://folio.tools" }
    return HttpRequest(method: method, path: path, headers: h, body: body)
}

private func convertBody(from: String, to: String, filename: String, b64: String = "aGVsbG8=") -> Data {
    try! JSONSerialization.data(withJSONObject: [
        "from": from, "to": to, "filename": filename, "contentBase64": b64,
    ])
}

final class ServerTests: XCTestCase {
    let caps = HelperCapabilities(pages: true, word: true)
    let token = "test-token"

    func testStatus() {
        let res = routeRequest(req("GET", "/v1/status"), capabilities: caps, expectedToken: token)
        XCTAssertEqual(res.status, 200)
        XCTAssertEqual(res.json["platform"] as? String, "macOS")
    }

    func testCapabilitiesEndpoint() {
        let res = routeRequest(req("GET", "/v1/capabilities"), capabilities: caps, expectedToken: token)
        XCTAssertEqual(res.status, 200)
        XCTAssertEqual(res.json["pages"] as? Bool, true)
    }

    func testStatusAndCapabilitiesRequireAllowedOrigin() {
        let status = routeRequest(
            req("GET", "/v1/status", headers: ["origin": "https://evil.example"]),
            capabilities: caps,
            expectedToken: token
        )
        XCTAssertEqual(status.status, 403)
        let capabilities = routeRequest(
            req("GET", "/v1/capabilities", headers: ["origin": "https://evil.example"]),
            capabilities: caps,
            expectedToken: token
        )
        XCTAssertEqual(capabilities.status, 403)
    }

    func testPairRequiresAllowedOrigin() {
        let bad = routeRequest(req("GET", "/v1/pair", headers: ["origin": "https://evil.example"]),
                               capabilities: caps, expectedToken: token)
        XCTAssertEqual(bad.status, 403)
        let good = routeRequest(req("GET", "/v1/pair", headers: ["origin": "https://folio.tools"]),
                                capabilities: caps, expectedToken: token)
        XCTAssertEqual(good.status, 200)
        XCTAssertEqual(good.json["token"] as? String, token)
    }

    func testConvertRejectsBadOrigin() {
        let res = routeRequest(
            req("POST", "/v1/convert",
                headers: ["origin": "https://evil.example", "x-folio-token": token],
                body: convertBody(from: "pages", to: "pdf", filename: "a.pages")),
            capabilities: caps, expectedToken: token)
        XCTAssertEqual(res.status, 403)
    }

    func testConvertRejectsBadToken() {
        let res = routeRequest(
            req("POST", "/v1/convert",
                headers: ["origin": "https://folio.tools", "x-folio-token": "wrong"],
                body: convertBody(from: "pages", to: "pdf", filename: "a.pages")),
            capabilities: caps, expectedToken: token)
        XCTAssertEqual(res.status, 403)
    }

    func testConvertRejectsDisallowedPair() {
        let res = routeRequest(
            req("POST", "/v1/convert",
                headers: ["origin": "https://folio.tools", "x-folio-token": token],
                body: convertBody(from: "pdf", to: "exe", filename: "a.pdf")),
            capabilities: caps, expectedToken: token)
        XCTAssertEqual(res.status, 400)
    }

    func testConvertRejectsMalformedJson() {
        let res = routeRequest(
            req("POST", "/v1/convert",
                headers: ["origin": "https://folio.tools", "x-folio-token": token],
                body: Data("not json".utf8)),
            capabilities: caps, expectedToken: token)
        XCTAssertEqual(res.status, 400)
    }

    func testConvertAcceptsValidRequest() {
        let res = routeRequest(
            req("POST", "/v1/convert",
                headers: ["origin": "https://folio.tools", "x-folio-token": token],
                body: convertBody(from: "pages", to: "pdf", filename: "a.pages")),
            capabilities: caps, expectedToken: token)
        XCTAssertEqual(res.status, 200)
        XCTAssertEqual(res.json["ok"] as? Bool, true)
    }

    func testParseRequest() {
        let raw = Data("POST /v1/convert HTTP/1.1\r\nContent-Length: 3\r\nOrigin: https://folio.tools\r\n\r\nabc".utf8)
        let parsed = parseHttpRequest(raw)
        XCTAssertNotNil(parsed)
        XCTAssertEqual(parsed?.method, "POST")
        XCTAssertEqual(parsed?.path, "/v1/convert")
        XCTAssertEqual(parsed?.headers["origin"], "https://folio.tools")
        XCTAssertEqual(parsed?.body.count, 3)
    }

    func testContentLengthDetectionIsCaseInsensitive() {
        let lower = Data("POST /v1/convert HTTP/1.1\r\ncontent-length: 3\r\n\r\nabc".utf8)
        XCTAssertTrue(hasContentLengthHeader(lower))
    }

    func testParseStripsQueryString() {
        let raw = Data("GET /v1/status?x=1 HTTP/1.1\r\nContent-Length: 0\r\n\r\n".utf8)
        XCTAssertEqual(parseHttpRequest(raw)?.path, "/v1/status")
    }

    func testUnknownEndpoint404() {
        let res = routeRequest(req("GET", "/v1/nope"), capabilities: caps, expectedToken: token)
        XCTAssertEqual(res.status, 404)
    }
}
