import Foundation

/// Shared configuration. Single source of truth for the helper side;
/// the web allowlist in `lib/formatMatrix.ts` must stay in sync.
public enum HelperConfig {
    public static let name = "Folio Helper for macOS"
    public static let version = "0.2.0"
    public static let host = "127.0.0.1"
    public static let port = 17391
    /// Production TLS bridge (loopback only). Plain HTTP on `port` is kept
    /// for `http://localhost` development only; https:// pages must use the
    /// TLS listener because browsers block https→http mixed-content fetches
    /// (Safari never even issues the request — see docs/MAC_BRIDGE_TLS.md).
    public static let tlsPort = 17392
    /// Per-install loopback certificate (friendly CN, SAN scoped to 127.0.0.1 /
    /// localhost), provisioned automatically or by
    /// scripts/provision-bridge-cert.sh with fixed openssl arguments.
    /// Private key must be 0600.
    public static let certFileName = "folio-bridge-cert.pem"
    public static let keyFileName = "folio-bridge-key.pem"
    public static let identityFileName = "folio-bridge-identity.p12"
    public static let bridgeDirName = ".folio/bridge"
    /// Host header allowlist — DNS-rebinding mitigation. The server only
    /// answers when Host is a loopback literal (optionally with port).
    public static let allowedHosts: Set<String> = [
        "127.0.0.1",
        "localhost",
    ]
    /// Rolling rate limit: max convert + pair requests per window.
    public static let rateLimitMaxRequests = 20
    public static let rateLimitWindowSeconds = 60.0
    /// Absolute cap per conversion payload (decoded bytes).
    public static let maxBytes = 100 * 1024 * 1024
    /// Base64 length cap (~4/3 of maxBytes plus JSON overhead margin).
    public static let maxBase64Chars = 140_000_000

    public static let allowedOrigins: Set<String> = [
        "https://foliotools.vercel.app",
        "https://folio.tools",
        "https://www.folio.tools",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    /// Vercel preview suffix accepted by the web client and documented here.
    /// Preview deployments match https://<name>-<hash>-<owner>.vercel.app.
    /// Exact-match origins stay in `allowedOrigins`; suffix matching is a
    /// deliberate, documented tradeoff (see docs/MAC_BRIDGE_TLS.md).
    public static let allowedOriginSuffix = ".vercel.app"

    /// Narrow typed conversion allowlist. No arbitrary format strings.
    public static let allowlist: Set<String> = [
        "pages>pdf",
        "pages>docx",
        "key>pdf",
        "key>pptx",
        "numbers>pdf",
        "numbers>xlsx",
        "doc>pdf",
        "docx>pdf",
        "ppt>pdf",
        "pptx>pdf",
        "xls>pdf",
        "xlsx>pdf",
    ]

    public static let allowedInputExtensions: Set<String> = [
        "pages", "key", "numbers",
        "doc", "docx", "ppt", "pptx", "xls", "xlsx",
    ]

    public static let outputMime: [String: String] = [
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]
}
