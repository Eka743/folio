import Foundation

/// Minimal localhost-only HTTP layer (no third-party deps).
/// Pure request parsing/routing lives here for testability; the POSIX
/// accept loop lives in main.swift.

public struct HttpRequest {
    public var method: String
    public var path: String
    public var headers: [String: String] // lowercased keys
    public var body: Data
    public init(method: String, path: String, headers: [String: String], body: Data) {
        self.method = method; self.path = path; self.headers = headers; self.body = body
    }
}

public struct HttpResponse {
    public var status: Int
    public var json: [String: Any]
    public init(status: Int, json: [String: Any]) {
        self.status = status; self.json = json
    }
}

public func reasonPhrase(_ status: Int) -> String {
    switch status {
    case 200: return "OK"
    case 204: return "No Content"
    case 400: return "Bad Request"
    case 403: return "Forbidden"
    case 404: return "Not Found"
    case 405: return "Method Not Allowed"
    case 413: return "Payload Too Large"
    case 429: return "Too Many Requests"
    case 500: return "Internal Server Error"
    default: return "OK"
    }
}

/// Parse a raw HTTP/1.1 request (headers + optional body) from the socket buffer.
/// Returns nil when the buffer doesn't yet contain a complete request.
public func parseHttpRequest(_ data: Data) -> HttpRequest? {
    guard let headerEnd = data.range(of: Data("\r\n\r\n".utf8)) else { return nil }
    let headerData = data.subdata(in: data.startIndex..<headerEnd.lowerBound)
    guard let headerText = String(data: headerData, encoding: .utf8) else { return nil }
    let lines = headerText.components(separatedBy: "\r\n")
    guard let requestLine = lines.first else { return nil }
    let parts = requestLine.split(separator: " ")
    guard parts.count >= 2 else { return nil }
    let method = String(parts[0]).uppercased()
    var rawPath = String(parts[1])
    if let q = rawPath.firstIndex(of: "?") { rawPath = String(rawPath[..<q]) }
    var headers: [String: String] = [:]
    for line in lines.dropFirst() {
        guard let colon = line.firstIndex(of: ":") else { continue }
        let key = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
        let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
        headers[key] = value
    }
    let bodyStart = headerEnd.upperBound
    let contentLength = Int(headers["content-length"] ?? "0") ?? 0
    guard data.count >= bodyStart + contentLength else { return nil }
    let body = data.subdata(in: bodyStart..<(bodyStart + contentLength))
    return HttpRequest(method: method, path: rawPath, headers: headers, body: body)
}

/// Header names are case-insensitive under HTTP/1.1. The socket read loop uses
/// this while waiting for larger bodies so lowercase clients are not mistaken
/// for unsupported streaming requests.
public func hasContentLengthHeader(_ data: Data) -> Bool {
    guard let headerEnd = data.range(of: Data("\r\n\r\n".utf8)),
          let headerText = String(
            data: data.subdata(in: data.startIndex..<headerEnd.lowerBound),
            encoding: .utf8
          ) else {
        return false
    }
    return headerText.components(separatedBy: "\r\n").dropFirst().contains { line in
        guard let colon = line.firstIndex(of: ":") else { return false }
        return line[..<colon].trimmingCharacters(in: .whitespaces)
            .localizedCaseInsensitiveCompare("content-length") == .orderedSame
    }
}

public func corsHeaders(for origin: String?) -> [String: String] {
    guard let origin, HelperSecurity.isAllowedOrigin(origin) else { return [:] }
    return [
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Folio-Token",
        "Access-Control-Max-Age": "600",
        // Chrome Private Network Access: allow the HTTPS Folio site to reach
        // the loopback bridge after preflight. Harmless elsewhere.
        "Access-Control-Allow-Private-Network": "true",
    ]
}

public func encodeResponse(_ res: HttpResponse, origin: String?) -> Data {
    var head = "HTTP/1.1 \(res.status) \(reasonPhrase(res.status))\r\n"
    head += "Content-Type: application/json\r\n"
    head += "Connection: close\r\n"
    for (k, v) in corsHeaders(for: origin) { head += "\(k): \(v)\r\n" }
    let body = (try? JSONSerialization.data(withJSONObject: res.json)) ?? Data("{}".utf8)
    head += "Content-Length: \(body.count)\r\n\r\n"
    var out = Data(head.utf8)
    out.append(body)
    return out
}

public func errorResponse(_ error: ConversionError, status: Int? = nil) -> HttpResponse {
    let code = error.code
    let fallback: [String: Int] = [
        "bad_request": 400, "forbidden": 403, "too_large": 413,
        "app_missing": 422, "open_failed": 422, "convert_failed": 500,
        "damaged": 422, "permission_denied": 403,
    ]
    // Map app-level failures to HTTP: 422 isn't in reasonPhrase; use 400/500.
    var httpStatus = status ?? fallback[code] ?? 400
    if httpStatus == 422 { httpStatus = 400 }
    return HttpResponse(status: httpStatus, json: ["error": code, "hint": error.hint])
}

/// Route a parsed request. Pure except for `capabilities` + token inputs.
/// Conversion I/O happens in main.swift after validation succeeds.
public func routeRequest(_ req: HttpRequest, capabilities: HelperCapabilities, expectedToken: String) -> HttpResponse {
    // DNS-rebinding defense: reject requests whose Host header is not a
    // loopback literal (an attacker domain resolving to 127.0.0.1 still
    // sends its own Host). Checked before any endpoint logic.
    guard HelperSecurity.isAllowedHost(req.headers["host"]) else {
        return HttpResponse(status: 403, json: ["error": "forbidden", "hint": "Unexpected Host."])
    }
    guard HelperSecurity.isAllowedOrigin(req.headers["origin"]) else {
        return HttpResponse(status: 403, json: ["error": "forbidden", "hint": "Unknown origin."])
    }
    if req.method == "OPTIONS" {
        return HttpResponse(status: 204, json: [:])
    }
    if req.path == "/v1/status", req.method == "GET" {
        return HttpResponse(status: 200, json: [
            "name": HelperConfig.name,
            "version": HelperConfig.version,
            "platform": "macOS",
        ])
    }
    if req.path == "/v1/pair", req.method == "GET" {
        return HttpResponse(status: 200, json: ["token": expectedToken])
    }
    if req.path == "/v1/capabilities", req.method == "GET" {
        let enc = try? JSONEncoder().encode(capabilities)
        if let enc, let obj = try? JSONSerialization.jsonObject(with: enc) as? [String: Any] {
            return HttpResponse(status: 200, json: obj)
        }
        return HttpResponse(status: 500, json: ["error": "convert_failed", "hint": "Could not read capabilities."])
    }
    if req.path == "/v1/convert", req.method == "POST" {
        guard HelperSecurity.tokensMatch(provided: req.headers["x-folio-token"], expected: expectedToken) else {
            return HttpResponse(status: 403, json: ["error": "forbidden", "hint": "Invalid or missing pairing token. GET /v1/pair from Folio first."])
        }
        guard req.body.count <= HelperConfig.maxBase64Chars + 4096 else {
            return HttpResponse(status: 413, json: ["error": "too_large", "hint": ConversionError.tooLarge.hint])
        }
        guard let payload = try? JSONDecoder().decode(ConvertPayload.self, from: req.body) else {
            return errorResponse(.badRequest(hint: "Malformed JSON payload."))
        }
        do {
            let v = try validateConvertPayload(payload)
            // Validation passed; main.swift performs the conversion.
            return HttpResponse(status: 200, json: ["ok": true, "from": v.from, "to": v.to, "filename": v.filename])
        } catch let e as ConversionError {
            return errorResponse(e)
        } catch {
            return HttpResponse(status: 400, json: ["error": "bad_request", "hint": "Invalid request."])
        }
    }
    return HttpResponse(status: 404, json: ["error": "bad_request", "hint": "Unknown endpoint."])
}
