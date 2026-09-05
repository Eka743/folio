import Foundation

/// Shared configuration. Single source of truth for the helper side;
/// the web allowlist in `lib/formatMatrix.ts` must stay in sync.
public enum HelperConfig {
    public static let name = "Folio Helper for macOS"
    public static let version = "0.2.0"
    public static let host = "127.0.0.1"
    public static let port = 17391
    /// Absolute cap per conversion payload (decoded bytes).
    public static let maxBytes = 100 * 1024 * 1024
    /// Base64 length cap (~4/3 of maxBytes plus JSON overhead margin).
    public static let maxBase64Chars = 140_000_000

    public static let allowedOrigins: Set<String> = [
        "https://folio.tools",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

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
