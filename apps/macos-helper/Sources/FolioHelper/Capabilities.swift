import Foundation

/// Capability snapshot exposed via GET /v1/capabilities.
/// No unnecessary system information is leaked.
public struct HelperCapabilities: Codable, Equatable {
    public var pages: Bool
    public var keynote: Bool
    public var numbers: Bool
    public var word: Bool
    public var powerpoint: Bool
    public var excel: Bool
    public var libreoffice: Bool
    public var platform: String

    public init(pages: Bool = false, keynote: Bool = false, numbers: Bool = false,
                word: Bool = false, powerpoint: Bool = false, excel: Bool = false,
                libreoffice: Bool = false, platform: String = "macOS") {
        self.pages = pages
        self.keynote = keynote
        self.numbers = numbers
        self.word = word
        self.powerpoint = powerpoint
        self.excel = excel
        self.libreoffice = libreoffice
        self.platform = platform
    }
}

/// Injectable probe so tests can simulate installed apps without a Mac.
public protocol AppProber {
    func isAppInstalled(bundleID: String) -> Bool
    func isExecutableOnPath(_ name: String) -> Bool
}

public struct DefaultAppProber: AppProber {
    public init() {}
    public func isAppInstalled(bundleID: String) -> Bool {
#if os(macOS)
        let fm = FileManager.default
        // Check well-known locations without launching anything.
        let candidates = [
            "/Applications",
            "/System/Applications",
            NSHomeDirectory() + "/Applications",
        ]
        // Map bundle IDs to app names for a cheap existence check.
        let appName = DefaultAppProber.appName(for: bundleID)
        for dir in candidates {
            if let appName, fm.fileExists(atPath: "\(dir)/\(appName).app") { return true }
        }
        return false
#else
        return false
#endif
    }

    public func isExecutableOnPath(_ name: String) -> Bool {
#if os(macOS)
        for dir in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"] {
            if FileManager.default.isExecutableFile(atPath: "\(dir)/\(name)") { return true }
        }
        if FileManager.default.fileExists(atPath: "/Applications/LibreOffice.app/Contents/MacOS/soffice") { return true }
        return false
#else
        return false
#endif
    }

    static func appName(for bundleID: String) -> String? {
        switch bundleID {
        case "com.apple.iWork.Pages": return "Pages"
        case "com.apple.iWork.Keynote": return "Keynote"
        case "com.apple.iWork.Numbers": return "Numbers"
        case "com.microsoft.Word": return "Microsoft Word"
        case "com.microsoft.Powerpoint": return "Microsoft PowerPoint"
        case "com.microsoft.Excel": return "Microsoft Excel"
        default: return nil
        }
    }
}

public struct MockAppProber: AppProber {
    public var installed: Set<String>
    public var executables: Set<String>
    public init(installed: Set<String> = [], executables: Set<String> = []) {
        self.installed = installed
        self.executables = executables
    }
    public func isAppInstalled(bundleID: String) -> Bool { installed.contains(bundleID) }
    public func isExecutableOnPath(_ name: String) -> Bool { executables.contains(name) }
}

public func detectCapabilities(prober: AppProber = DefaultAppProber()) -> HelperCapabilities {
    HelperCapabilities(
        pages: prober.isAppInstalled(bundleID: "com.apple.iWork.Pages"),
        keynote: prober.isAppInstalled(bundleID: "com.apple.iWork.Keynote"),
        numbers: prober.isAppInstalled(bundleID: "com.apple.iWork.Numbers"),
        word: prober.isAppInstalled(bundleID: "com.microsoft.Word"),
        powerpoint: prober.isAppInstalled(bundleID: "com.microsoft.Powerpoint"),
        excel: prober.isAppInstalled(bundleID: "com.microsoft.Excel"),
        libreoffice: prober.isExecutableOnPath("soffice"),
        platform: "macOS"
    )
}

/// Engine selection. Never silently substitutes LibreOffice for a native
/// app: the caller must surface `engine` in the UI.
public enum EngineSelection: Equatable {
    case native(String)
    case libreOffice
    case unavailable(appName: String)
}

public func selectEngine(from: String, caps: HelperCapabilities) -> EngineSelection {
    switch from.lowercased() {
    case "pages": return caps.pages ? .native("Pages") : .unavailable(appName: "Pages")
    case "key": return caps.keynote ? .native("Keynote") : .unavailable(appName: "Keynote")
    case "numbers": return caps.numbers ? .native("Numbers") : .unavailable(appName: "Numbers")
    case "doc", "docx":
        if caps.word { return .native("Microsoft Word") }
        if caps.libreoffice { return .libreOffice }
        return .unavailable(appName: "Microsoft Word")
    case "ppt", "pptx":
        if caps.powerpoint { return .native("Microsoft PowerPoint") }
        if caps.libreoffice { return .libreOffice }
        return .unavailable(appName: "Microsoft PowerPoint")
    case "xls", "xlsx":
        if caps.excel { return .native("Microsoft Excel") }
        if caps.libreoffice { return .libreOffice }
        return .unavailable(appName: "Microsoft Excel")
    default: return .unavailable(appName: "Unknown")
    }
}
