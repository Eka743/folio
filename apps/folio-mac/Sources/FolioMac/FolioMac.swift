import Foundation

/// Folio for Mac — user-facing macOS companion (no Terminal required).
///
/// Responsibilities:
/// 1. Launch the bundled FolioHelper bridge as a child process and keep it
///    supervised (restart on crash, stop on Quit).
/// 2. Show connection status, installed conversion engines, and privacy copy.
/// 3. Guide one-time setup: loopback certificate trust + Automation
///    permission explanation (before macOS prompts).
/// 4. Offer user-controlled Open at Login (SMAppService on macOS 13+).
///
/// The AppKit/SwiftUI interface lives in `Views.swift` (macOS only).
/// Everything here is platform-neutral so the target compiles on Linux CI;
/// macOS-only behavior is gated behind `#if os(macOS)` / `canImport`.
public enum FolioMac {
    public static let version = "0.2.0"
    public static let bundleID = "tools.folio.mac"
    public static let helperExecutableName = "FolioHelper"
    public static let helperPort = 17391
    public static let helperTLSPort = 17392

    /// Engines shown in the status UI. Availability is reported by the
    /// helper's GET /v1/capabilities endpoint at runtime.
    public static let engines: [(id: String, label: String, iWork: Bool)] = [
        ("pages", "Pages", true),
        ("keynote", "Keynote", true),
        ("numbers", "Numbers", true),
        ("word", "Microsoft Word", false),
        ("powerpoint", "Microsoft PowerPoint", false),
        ("excel", "Microsoft Excel", false),
        ("libreoffice", "LibreOffice (optional local fallback)", false),
    ]

    /// Automation permission explainer shown BEFORE macOS prompts, so the
    /// user understands why access is needed. Never spam prompts.
    public static func automationExplainer(appName: String) -> String {
        "Folio needs permission to control \(appName) so \(appName) can export this document locally. " +
        "Your files never leave this Mac."
    }

    /// Deep-link target for Automation settings (macOS 13+).
    public static let automationSettingsURL =
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
}

/// Supervises the bundled FolioHelper child process.
/// macOS-only process management is in `BridgeProcess.swift`; this type
/// holds the portable configuration + restart policy.
public struct BridgeSupervisor: Sendable {
    public var executableURL: URL?
    public var maxRestarts: Int = 3
    public init(executableURL: URL? = nil) {
        self.executableURL = executableURL
    }

    /// Expected localhost endpoints for health checks.
    public var statusEndpoints: [String] {
        [
            "https://127.0.0.1:\(FolioMac.helperTLSPort)/v1/status",
            "http://127.0.0.1:\(FolioMac.helperPort)/v1/status",
        ]
    }
}

#if os(macOS)
/// Entry point on macOS: AppKit delegate + SwiftUI menu-bar UI are defined
/// in Views.swift. This keeps `main.swift` free of platform conditionals.
#else
// Linux CI build: no-op entry so `swift build` validates the target.
@main
struct FolioMacLinuxStub {
    static func main() {
        print("FolioMac v\(FolioMac.version) (macOS UI unavailable on this platform)")
    }
}
#endif
