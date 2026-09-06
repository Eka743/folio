#if os(macOS)
import Foundation
#if canImport(ServiceManagement)
import ServiceManagement
#endif

/// Bridge child-process supervision + Open at Login (macOS only).
/// The helper binary is bundled inside Folio.app/Contents/MacOS/ and spawned
/// with fixed arguments — never with browser-supplied input.
@available(macOS 13, *)
public final class BridgeProcess: ObservableObject {
    @Published public private(set) var running = false
    private var task: Process?

    public init() {}

    /// Path of the bundled helper relative to the app bundle.
    public static func bundledHelperURL() -> URL? {
        Bundle.main.bundleURL
            .appendingPathComponent("Contents/MacOS/\(FolioMac.helperExecutableName)")
    }

    public func start() {
        guard task == nil || task?.isRunning == false else { return }
        guard let exe = Self.bundledHelperURL(),
              FileManager.default.isExecutableFile(atPath: exe.path) else { return }
        let p = Process()
        p.executableURL = exe
        p.arguments = []
        p.standardOutput = FileHandle.nullDevice
        p.standardError = FileHandle.nullDevice
        do {
            try p.run()
            task = p
            running = true
        } catch {
            running = false
        }
    }

    public func stop() {
        task?.terminate()
        task = nil
        running = false
    }
}

/// User-controlled Open at Login via SMAppService (macOS 13+).
/// State is always read from the system — never assumed.
@available(macOS 13, *)
public enum LoginItem {
    public static var isEnabled: Bool {
        #if canImport(ServiceManagement)
        return SMAppService.mainApp.status == .enabled
        #else
        return false
        #endif
    }

    public static func setEnabled(_ enabled: Bool) throws {
        #if canImport(ServiceManagement)
        if enabled {
            try SMAppService.mainApp.register()
        } else {
            try SMAppService.mainApp.unregister()
        }
        #endif
    }
}
#endif
