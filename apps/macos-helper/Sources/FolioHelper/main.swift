import Foundation
#if canImport(Glibc)
import Glibc
#elseif canImport(Darwin)
import Darwin
#endif

/// Folio Helper for macOS — localhost-only conversion bridge.
///
/// Binds 127.0.0.1:<port> ONLY (never 0.0.0.0). Accepts a narrow typed API:
/// GET /v1/status, GET /v1/pair, GET /v1/capabilities, POST /v1/convert.
/// Documents are written to a random 0700 temp dir per conversion and
/// deleted afterwards (success or failure). No shell is ever spawned with
/// untrusted input; LibreOffice is spawned via argument arrays only and
/// AppleScript runs via NSAppleScript with quoted paths.

func log(_ msg: String) {
    fputs("[folio-helper] \(msg)\n", stderr)
}

let port: UInt16 = UInt16(ProcessInfo.processInfo.environment["FOLIO_HELPER_PORT"] ?? "").flatMap(UInt16.init) ?? UInt16(HelperConfig.port)
let token = HelperSecurity.newPairingToken()
let prober = DefaultAppProber()
log("\(HelperConfig.name) v\(HelperConfig.version) starting on 127.0.0.1:\(port)")

// POSIX socket, IPv4 loopback only.
let fd = socket(AF_INET, Int32(SOCK_STREAM.rawValue), 0)
guard fd >= 0 else { fputs("socket() failed\n", stderr); exit(1) }
var reuse: Int32 = 1
setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))
var addr = sockaddr_in()
addr.sin_family = sa_family_t(AF_INET)
addr.sin_port = port.bigEndian
addr.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
let bindResult = withUnsafePointer(to: &addr) {
    $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
    }
}
guard bindResult == 0 else { fputs("bind(127.0.0.1:\(port)) failed — is another helper running?\n", stderr); exit(1) }
guard listen(fd, 16) == 0 else { fputs("listen() failed\n", stderr); exit(1) }
log("listening on 127.0.0.1:\(port) (localhost only)")
log("pairing token issued via GET /v1/pair (Folio origin required)")

while true {
    var peer = sockaddr_in()
    var peerLen = socklen_t(MemoryLayout<sockaddr_in>.size)
    let conn = withUnsafeMutablePointer(to: &peer) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            accept(fd, $0, &peerLen)
        }
    }
    guard conn >= 0 else { continue }
    // Read until full request (headers + Content-Length body) or 150MB cap.
    var buffer = Data()
    var complete: HttpRequest? = nil
    var tooBig = false
    while buffer.count < HelperConfig.maxBase64Chars + 65536 {
        var chunk = [UInt8](repeating: 0, count: 65536)
        let n = recv(conn, &chunk, chunk.count, 0)
        if n <= 0 { break }
        buffer.append(contentsOf: chunk.prefix(n))
        if let parsed = parseHttpRequest(buffer) { complete = parsed; break }
        if buffer.count > 4096, parseHttpRequest(buffer) == nil,
           let s = String(data: buffer.prefix(4096), encoding: .utf8),
           !s.contains("Content-Length:") && buffer.count > 8192 { break }
    }
    if buffer.count >= HelperConfig.maxBase64Chars + 65536 { tooBig = true }

    func sendResponse(_ res: HttpResponse, origin: String?) {
        let data = encodeResponse(res, origin: origin)
        data.withUnsafeBytes { (ptr: UnsafeRawBufferPointer) in
            var sent = 0
            while sent < data.count {
                guard let base = ptr.baseAddress else { break }
                let n = Glibc.send(conn, base.advanced(by: sent), data.count - sent, 0)
                if n <= 0 { break }
                sent += n
            }
        }
    }

    guard let req = complete, !tooBig else {
        let origin: String? = nil
        sendResponse(HttpResponse(status: 413, json: ["error": "too_large", "hint": ConversionError.tooLarge.hint]), origin: origin)
        close(conn)
        continue
    }

    let origin = req.headers["origin"]
    // Route validation first (origin, token, allowlist, sizes).
    let caps = detectCapabilities(prober: prober)
    let routed = routeRequest(req, capabilities: caps, expectedToken: token)

    // The pure router returns {ok:true} for valid convert requests; perform I/O here.
    if req.path == "/v1/convert" && req.method == "POST",
       let ok = routed.json["ok"] as? Bool, ok,
       let from = routed.json["from"] as? String,
       let to = routed.json["to"] as? String,
       let filename = routed.json["filename"] as? String {
        do {
            let payload = try JSONDecoder().decode(ConvertPayload.self, from: req.body)
            guard let b64 = payload.contentBase64,
                  let raw = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else {
                throw ConversionError.badRequest(hint: "Document content is not valid base64.")
            }
            guard raw.count <= HelperConfig.maxBytes else { throw ConversionError.tooLarge }
            guard raw.count > 0 else { throw ConversionError.badRequest(hint: "Empty document.") }
            let dir = try HelperSecurity.makeTempDir()
            defer { HelperSecurity.cleanup(dir) }
            let inputURL = dir.appendingPathComponent(filename)
            // Defense in depth: filename was sanitized; still confine to dir.
            guard inputURL.standardized.path.hasPrefix(dir.standardized.path) else {
                throw ConversionError.badRequest(hint: "Invalid filename.")
            }
            try raw.write(to: inputURL, options: .atomic)
            let outName = outputFilename(for: filename, to: to)
            let outputURL = dir.appendingPathComponent(outName)
            guard outputURL.standardized.path.hasPrefix(dir.standardized.path) else {
                throw ConversionError.badRequest(hint: "Invalid filename.")
            }
            #if os(macOS)
            let runner = AppleScriptRunner()
            let orchestrator = ConversionOrchestrator(
                capabilities: caps,
                runScript: { _, script in try runner.run(source: script) },
                libreOffice: caps.libreoffice ? LibreOfficeConverter() : nil
            )
            #else
            let orchestrator = ConversionOrchestrator(
                capabilities: caps,
                runScript: { _, _ in throw ConversionError.appMissing(appName: "Desktop apps") },
                libreOffice: nil
            )
            #endif
            let engine: String
            do {
                engine = try orchestrator.convert(input: inputURL, outputURL: outputURL, from: from, to: to)
            } catch let e as ConversionError {
                sendResponse(errorResponse(e), origin: origin)
                close(conn)
                continue
            }
            guard let outData = try? Data(contentsOf: outputURL), !outData.isEmpty else {
                sendResponse(errorResponse(.convertFailed), origin: origin)
                close(conn)
                continue
            }
            let resp = HttpResponse(status: 200, json: [
                "outputFilename": outName,
                "engine": engine,
                "contentBase64": outData.base64EncodedString(),
            ])
            sendResponse(resp, origin: origin)
        } catch let e as ConversionError {
            sendResponse(errorResponse(e), origin: origin)
        } catch {
            sendResponse(HttpResponse(status: 500, json: ["error": "convert_failed", "hint": ConversionError.convertFailed.hint]), origin: origin)
        }
        close(conn)
        continue
    }

    sendResponse(routed, origin: origin)
    close(conn)
}
