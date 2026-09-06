import Foundation

/// Security primitives. All functions are pure and unit-tested.
/// The networking layer must call these before touching the filesystem
/// or spawning any converter process.
public enum HelperSecurity {
    /// Mirror of the web `sanitizeHelperFilename`. Strips directories,
    /// NUL/control chars and traversal segments; keeps a safe subset.
    public static func sanitizeFilename(_ name: String, fallback: String = "document") -> String {
        var base = name
        // Strip any directory components (both separators).
        base = base.split(whereSeparator: { $0 == "/" || $0 == "\\" }).last.map(String.init) ?? ""
        // Remove NUL and control characters.
        base = base.filter { !$0.isNewline && ($0.unicodeScalars.allSatisfy { $0.value >= 0x20 && $0.value != 0x7F }) }
        base = base.trimmingCharacters(in: .whitespacesAndNewlines)
        // Strip leading dots (hidden files / traversal).
        while base.hasPrefix(".") { base.removeFirst() }
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._- ()[]"))
        base = String(base.unicodeScalars.filter { allowed.contains($0) }.map { Character($0) })
        // Collapse repeated dashes.
        while base.contains("--") { base = base.replacingOccurrences(of: "--", with: "-") }
        base = base.trimmingCharacters(in: CharacterSet(charactersIn: ".- "))
        if base.count > 100 { base = String(base.prefix(100)) }
        // Reject bare extensions, traversal leftovers and empty names.
        if base.isEmpty || base == "." || base == ".." || base.lowercased() == "localhost" {
            return fallback
        }
        return base
    }

    /// Origin validation. `nil`/empty origins are rejected (non-browser
    /// clients must pair explicitly; browsers always send Origin on fetch).
    /// Exact matches come from `HelperConfig.allowedOrigins`; https preview
    /// deployments under `allowedOriginSuffix` are accepted as a documented
    /// tradeoff (exact production origins stay pinned in the set above).
    public static func isAllowedOrigin(_ origin: String?) -> Bool {
        guard let origin, !origin.isEmpty else { return false }
        // Normalize to scheme://host (drop trailing slash / path).
        let trimmed = origin.hasSuffix("/") ? String(origin.dropLast()) : origin
        if HelperConfig.allowedOrigins.contains(trimmed) { return true }
        guard trimmed.hasPrefix("https://"),
              trimmed.hasSuffix(HelperConfig.allowedOriginSuffix) else { return false }
        // Reject origins with paths, ports, userinfo or empty labels:
        // suffix match must cover the whole host.
        let host = String(trimmed.dropFirst("https://".count))
        guard !host.isEmpty, !host.contains("/"), !host.contains(":"),
              !host.contains("@"), !host.contains("..") else { return false }
        let labels = host.split(separator: ".")
        guard labels.count >= 3, labels.allSatisfy({ !$0.isEmpty }) else { return false }
        return true
    }

    /// Host header validation — DNS-rebinding mitigation.
    /// Accepts loopback literals with or without an explicit port
    /// ("127.0.0.1", "127.0.0.1:17391", "localhost:17392"). Rejects
    /// everything else, including attacker domains resolving to 127.0.0.1
    /// and bare IPv6 forms (the server binds IPv4 loopback only).
    public static func isAllowedHost(_ host: String?) -> Bool {
        guard let host, !host.isEmpty else { return false }
        let bare = host.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        // Strip a single trailing :port if present.
        let hostOnly: String
        if let colon = bare.lastIndex(of: ":") {
            let after = bare[bare.index(after: colon)...]
            guard !after.isEmpty, after.allSatisfy({ $0.isNumber }) else { return false }
            hostOnly = String(bare[..<colon])
        } else {
            hostOnly = bare
        }
        return HelperConfig.allowedHosts.contains(hostOnly)
    }

    /// Constant-time token comparison to blunt timing side-channels.
    public static func tokensMatch(provided: String?, expected: String) -> Bool {
        guard let provided, !provided.isEmpty else { return false }
        let a = Array(provided.utf8)
        let b = Array(expected.utf8)
        guard a.count == b.count else { return false }
        var diff: UInt8 = 0
        for (x, y) in zip(a, b) { diff |= x ^ y }
        return diff == 0
    }

    public static func isAllowedPair(from: String, to: String) -> Bool {
        HelperConfig.allowlist.contains("\(from.lowercased())>\(to.lowercased())")
    }

    /// Quote a POSIX path for embedding in AppleScript `POSIX file "..."`.
    /// Backslashes and quotes are escaped; the result is always wrapped
    /// in double quotes by the caller.
    public static func appleScriptQuoted(_ path: String) -> String {
        path.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
    }

    /// Create a random per-conversion temp directory (0700).
    public static func makeTempDir() throws -> URL {
        let base = FileManager.default.temporaryDirectory
            .appendingPathComponent("folio-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        return base
    }

    /// Best-effort recursive cleanup. Never throws (called from defer).
    public static func cleanup(_ dir: URL) {
        try? FileManager.default.removeItem(at: dir)
    }

    public static func newPairingToken() -> String {
        UUID().uuidString + "-" + String(UUID().uuidString.prefix(8))
    }

    /// Rolling-window rate limiter (pure value type for testability).
    /// Tracks request timestamps; `shouldAllow(now:)` evicts entries older
    /// than the window and admits up to `maxRequests` per window.
    public struct RateLimiter {
        public var maxRequests: Int
        public var windowSeconds: Double
        private var stamps: [Double] = []
        public init(maxRequests: Int = HelperConfig.rateLimitMaxRequests,
                    windowSeconds: Double = HelperConfig.rateLimitWindowSeconds) {
            self.maxRequests = maxRequests
            self.windowSeconds = windowSeconds
        }
        public mutating func shouldAllow(now: Double) -> Bool {
            stamps = stamps.filter { now - $0 < windowSeconds }
            guard stamps.count < maxRequests else { return false }
            stamps.append(now)
            return true
        }
    }
}
