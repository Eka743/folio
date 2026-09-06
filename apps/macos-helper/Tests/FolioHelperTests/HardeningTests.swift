import XCTest
@testable import FolioHelper

/// Hardening tests for the production bridge: DNS-rebinding defense,
/// preview-origin suffix rule, Private Network Access header, TLS
/// provisioning arguments, and the rolling rate limiter.
final class HardeningTests: XCTestCase {
    let caps = HelperCapabilities(pages: true, word: true)
    let token = "test-token"

    private func req(_ method: String, _ path: String, headers: [String: String] = [:]) -> HttpRequest {
        HttpRequest(method: method, path: path, headers: headers, body: Data())
    }

    // MARK: - Host allowlist

    func testAllowedHosts() {
        XCTAssertTrue(HelperSecurity.isAllowedHost("127.0.0.1"))
        XCTAssertTrue(HelperSecurity.isAllowedHost("127.0.0.1:17391"))
        XCTAssertTrue(HelperSecurity.isAllowedHost("localhost:17392"))
        XCTAssertTrue(HelperSecurity.isAllowedHost("localhost"))
        XCTAssertFalse(HelperSecurity.isAllowedHost(nil))
        XCTAssertFalse(HelperSecurity.isAllowedHost(""))
        XCTAssertFalse(HelperSecurity.isAllowedHost("evil.example"))
        XCTAssertFalse(HelperSecurity.isAllowedHost("evil.example:17391"))
        XCTAssertFalse(HelperSecurity.isAllowedHost("127.0.0.1.evil.example"))
        XCTAssertFalse(HelperSecurity.isAllowedHost("[::1]"))
    }

    func testRebindingHostRejected() {
        let res = routeRequest(
            req("GET", "/v1/status", headers: ["host": "attacker.example"]),
            capabilities: caps, expectedToken: token)
        XCTAssertEqual(res.status, 403)
        XCTAssertEqual(res.json["error"] as? String, "forbidden")
    }

    func testMissingHostRejected() {
        let res = routeRequest(req("GET", "/v1/status"),
                               capabilities: caps, expectedToken: token)
        XCTAssertEqual(res.status, 403)
    }

    // MARK: - Origin suffix rule

    func testExactOriginsStillAllowed() {
        XCTAssertTrue(HelperSecurity.isAllowedOrigin("https://folio.tools"))
        XCTAssertTrue(HelperSecurity.isAllowedOrigin("https://www.folio.tools"))
        XCTAssertTrue(HelperSecurity.isAllowedOrigin("http://localhost:3000"))
    }

    func testVercelPreviewSuffixAllowed() {
        XCTAssertTrue(HelperSecurity.isAllowedOrigin("https://folio-abc123-eka743.vercel.app"))
    }

    func testSuffixAttacksRejected() {
        XCTAssertFalse(HelperSecurity.isAllowedOrigin("https://evil.example"))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin("https://vercel.app"))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin("https://a..vercel.app"))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin("https://folio.vercel.app.evil.example"))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin("https://folio-vercel-app.evil.example"))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin("http://folio-abc.vercel.app"))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin("https://a.vercel.app/path"))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin(nil))
        XCTAssertFalse(HelperSecurity.isAllowedOrigin(""))
    }

    // MARK: - PNA header

    func testPnaHeaderPresentForAllowedOrigin() {
        let headers = corsHeaders(for: "https://folio.tools")
        XCTAssertEqual(headers["Access-Control-Allow-Private-Network"], "true")
        XCTAssertEqual(headers["Access-Control-Allow-Origin"], "https://folio.tools")
    }

    func testNoCorsHeadersForEvilOrigin() {
        XCTAssertTrue(corsHeaders(for: "https://evil.example").isEmpty)
    }

    // MARK: - Rate limiter

    func testRateLimiterAdmitsThenBlocks() {
        var limiter = HelperSecurity.RateLimiter(maxRequests: 3, windowSeconds: 60)
        XCTAssertTrue(limiter.shouldAllow(now: 0))
        XCTAssertTrue(limiter.shouldAllow(now: 1))
        XCTAssertTrue(limiter.shouldAllow(now: 2))
        XCTAssertFalse(limiter.shouldAllow(now: 3))
    }

    func testRateLimiterWindowSlides() {
        var limiter = HelperSecurity.RateLimiter(maxRequests: 1, windowSeconds: 60)
        XCTAssertTrue(limiter.shouldAllow(now: 0))
        XCTAssertFalse(limiter.shouldAllow(now: 30))
        XCTAssertTrue(limiter.shouldAllow(now: 61))
    }

    // MARK: - BridgeTLS provisioning

    func testOpensslArgsAreFixed() {
        let args = BridgeTLS.opensslArguments(certPath: "/tmp/c.pem", keyPath: "/tmp/k.pem")
        XCTAssertEqual(args.first, "openssl")
        XCTAssertTrue(args.contains("subjectAltName=IP:127.0.0.1,DNS:localhost"))
        XCTAssertTrue(args.contains("/CN=127.0.0.1"))
        // No shell interpolation surface: args are an array, never a string.
        XCTAssertFalse(args.joined(separator: " ").contains(";"))
    }

    func testNeedsProvisioning() {
        XCTAssertTrue(BridgeTLS.needsProvisioning(certExists: false, keyExists: true))
        XCTAssertTrue(BridgeTLS.needsProvisioning(certExists: true, keyExists: false))
        XCTAssertFalse(BridgeTLS.needsProvisioning(certExists: true, keyExists: true))
    }

    func testBridgePaths() {
        let home = URL(fileURLWithPath: "/Users/test")
        XCTAssertTrue(BridgeTLS.certURL(home: home).path.hasSuffix(".folio/bridge/folio-bridge-cert.pem"))
        XCTAssertTrue(BridgeTLS.keyURL(home: home).path.hasSuffix(".folio/bridge/folio-bridge-key.pem"))
    }
}
